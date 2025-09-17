/**
 * Google/AppleのIDトークンによる認証ブートストラップを処理します。
 * IDトークンの検証、ユーザー・アカウントのDB upsert、認証情報の返却を行います。
 */
import { prisma } from '../../lib/prisma';
import { FastifyReply, FastifyRequest } from 'fastify';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';
import { v7 as uuidv7 } from 'uuid';
import { issue } from '../../lib/refreshStore';
import { setRefreshCookie } from '../../lib/cookies';
import { signAccessToken } from '../../lib/jwt';

/**
 * 外部認証プロバイダで検証済みのユーザープロファイル情報を表します。
 */
type VerifiedProfile = {
  /** プロバイダアカウントID */
  providerAccountId: string;
  /** メールアドレス */
  email?: string;
  /** メールアドレスが検証済みかどうか */
  emailVerified: boolean;
  /** ユーザー名 */
  name?: string;
  /** プロフィール画像URL */
  image?: string;
};

/**
 * 認証ブートストラップエンドポイントのリクエストボディスキーマ。
 */
const BodySchema = z.object({
  provider: z.enum(['google', 'apple']),
  idToken: z.string().min(1),
});

type Body = z.infer<typeof BodySchema>;

/**
 * GoogleのIDトークンを検証し、ユーザープロファイル情報を抽出します。
 *
 * @param idToken GoogleのIDトークン文字列
 * @return 検証済みプロファイル情報
 * @throws audienceやissuerが不正な場合はエラー
 */
async function verifyGoogleIdToken(idToken: string): Promise<VerifiedProfile> {
  const aud = process.env.OIDC_GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID;
  if (!aud) throw new Error('GOOGLE_AUDIENCE_NOT_CONFIGURED');

  // Googleの公開JWKセットを取得しJWTを検証
  const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
  const { payload } = await jwtVerify(idToken, jwks, { audience: aud });

  // issuerの検証
  const iss = payload.iss;
  if (iss !== 'https://accounts.google.com' && iss !== 'accounts.google.com') {
    throw new Error('GOOGLE_ISS_MISMATCH');
  }

  // プロファイル情報を抽出
  return {
    providerAccountId: String(payload.sub),
    email: typeof payload.email === 'string' ? payload.email : undefined,
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    image: typeof payload.picture === 'string' ? payload.picture : undefined,
  };
}

/**
 * AppleのIDトークンを検証し、ユーザープロファイル情報を抽出します。
 *
 * @param idToken AppleのIDトークン文字列
 * @return 検証済みプロファイル情報
 * @throws audienceやissuerが不正な場合はエラー
 */
async function verifyAppleIdToken(idToken: string): Promise<VerifiedProfile> {
  const aud = process.env.OIDC_APPLE_CLIENT_ID ?? process.env.AUTH_APPLE_ID;
  if (!aud) throw new Error('APPLE_AUDIENCE_NOT_CONFIGURED');

  // Appleの公開JWKセットを取得しJWTを検証
  const jwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
  const { payload } = await jwtVerify(idToken, jwks, { audience: aud });

  // issuerの検証
  if (payload.iss !== 'https://appleid.apple.com') {
    throw new Error('APPLE_ISS_MISMATCH');
  }

  // プロファイル情報を抽出（Appleはname, imageを提供しない）
  return {
    providerAccountId: String(payload.sub),
    email: typeof payload.email === 'string' ? payload.email : undefined,
    emailVerified: payload.email_verified === true,
    name: undefined,
    image: undefined,
  };
}

/**
 * Fastify用の認証ブートストラップエンドポイントハンドラ。
 * リクエスト検証、IDトークン検証、ユーザー・アカウントupsert、結果返却を行います。
 *
 * @param request FastifyRequestオブジェクト
 * @param reply FastifyReplyオブジェクト
 * @return レスポンス
 */
export default async function bootstrapAuth(request: FastifyRequest, reply: FastifyReply) {
  // リクエストボディのバリデーション
  const parsed = BodySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'INVALID_BODY' });
  }

  const { provider, idToken } = parsed.data as Body;

  try {
    // プロバイダごとにIDトークンを検証
    const verified =
      provider === 'google'
        ? await verifyGoogleIdToken(idToken)
        : await verifyAppleIdToken(idToken);

    // ユーザー・アカウントをDBにupsert
    const user = await upsertAuthUserAndAccount(provider, verified);

    // AppUserを取得/作成
    const appUser = await getOrCreateAppUser(user.id);

    // Refresh発行 → Cookieに設定（maxAgeは残存秒数）
    const refresh = issue(appUser.id);
    const nowSec = Math.floor(Date.now() / 1000);
    const maxAgeSec = Math.max(0, refresh.expiresAt - nowSec);
    setRefreshCookie(reply, refresh.token, maxAgeSec);

    // アクセスJWT発行（sub=AppUser.id）
    const accessToken = await signAccessToken(appUser.id);

    // 表示名（name→emailローカル部→空文字を回避）
    const displayName = user.name ?? (user.email ? user.email.split('@')[0] : '');

    // OpenAPI: AuthResponseで返却
    return reply.code(200).send({
      user: {
        id: appUser.id,
        ...(user.email ? { email: user.email } : {}),
        ...(displayName ? { displayName } : {}),
        createdAt: appUser.createdAt.toISOString(),
      },
      token: accessToken,
    });
  } catch (e) {
    // 検証失敗時のエラーハンドリング
    request.log?.warn({ err: e }, 'bootstrap verify failed');
    return reply.code(401).send({ error: 'ID_TOKEN_INVALID' });
  }
}

/**
 * providerとprofile情報に基づき、ユーザー・アカウントをDBにupsertします。
 * 既存アカウントがあれば紐づくユーザーを返却します。
 * なければユーザー新規作成（必要時）とアカウント新規作成を行います。
 *
 * @param provider 'google' または 'apple'
 * @param p 検証済みプロファイル情報
 * @return Userエンティティ
 */
async function upsertAuthUserAndAccount(provider: 'google' | 'apple', p: VerifiedProfile) {
  // provider/providerAccountIdで既存アカウントを検索
  const existing = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId: p.providerAccountId } },
    include: { user: true },
  });
  if (existing) return existing.user;

  // emailで既存ユーザーを検索
  let user = p.email ? await prisma.user.findUnique({ where: { email: p.email } }) : null;

  // ユーザーがなければ新規作成
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: p.email ?? undefined,
        emailVerified: p.emailVerified ? new Date() : null,
        name: p.name ?? undefined,
        image: p.image ?? undefined,
      },
    });
  }

  // アカウントを新規作成
  await prisma.account.create({
    data: {
      userId: user.id,
      type: 'oidc',
      provider,
      providerAccountId: p.providerAccountId,
    },
  });

  return user;
}

/**
 * 指定したauthUserIdに対応するAppUserを取得または新規作成します。
 *
 * @param authUserId 認証ユーザーID
 * @return AppUserエンティティ
 */
async function getOrCreateAppUser(authUserId: string) {
  const existing = await prisma.appUser.findUnique({ where: { authUserId } });
  if (existing) return existing;

  const id = uuidv7();

  return prisma.appUser.create({
    data: { id, authUserId },
  });
}
