/**
 * Google/AppleのIDトークンによる認証ブートストラップを処理します。
 * IDトークンの検証、ユーザー・アカウントのDB upsert、認証情報の返却を行います。
 */
import { prisma } from '../../lib/prisma';
import { FastifyReply, FastifyRequest } from 'fastify';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';

/**
 * 外部認証プロバイダで検証済みのユーザープロファイル情報。
 */
type VerifiedProfile = {
  providerAccountId: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
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
 * @param idToken GoogleのIDトークン文字列
 * @returns 検証済みプロファイル情報
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
 * @param idToken AppleのIDトークン文字列
 * @returns 検証済みプロファイル情報
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
 * @param request FastifyRequestオブジェクト
 * @param reply FastifyReplyオブジェクト
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

    // 成功レスポンスを返却
    return reply.code(200).send({
      verified: true,
      provider,
      providerAccountId: verified.providerAccountId,
      authUserId: user.id,
      email: verified.email ?? null,
      emailVerified: verified.emailVerified,
    });
  } catch (e) {
    // 検証失敗時のエラーハンドリング
    request.log?.warn({ err: e }, 'bootstrap verify failed');
    return reply.code(401).send({ error: 'ID_TOKEN_INVALID' });
  }
}

/**
 * providerとprofile情報に基づき、ユーザー・アカウントをDBにupsertします。
 * 既存アカウントがあれば紐づくユーザーを返却。
 * なければユーザー新規作成（必要時）とアカウント新規作成。
 * @param provider 'google' または 'apple'
 * @param p 検証済みプロファイル情報
 * @returns Userエンティティ
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
