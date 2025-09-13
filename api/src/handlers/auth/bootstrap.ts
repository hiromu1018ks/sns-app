// Google/AppleのIDトークンを検証し、認証情報を返すエンドポイントのハンドラ
import { FastifyReply, FastifyRequest } from 'fastify';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import z from 'zod';

// リクエストボディのバリデーションスキーマ
const BodySchema = z.object({
  provider: z.enum(['google', 'apple']),
  idToken: z.string().min(1),
});

type Body = z.infer<typeof BodySchema>;

// GoogleのIDトークンを検証し、ユーザー情報を抽出
async function verifyGoogleIdToken(idToken: string) {
  const aud = process.env.OIDC_GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID;
  if (!aud) throw new Error('GOOGLE_AUDIENCE_NOT_CONFIGURED');

  // Googleの公開鍵セットを取得し、JWT検証
  const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
  const { payload } = await jwtVerify(idToken, jwks, { audience: aud });

  // issuer(iss)の検証
  const iss = payload.iss;
  if (iss !== 'https://accounts.google.com' && iss !== 'accounts.google.com') {
    throw new Error('GOOGLE_ISS_MISMATCH');
  }

  // 必要な情報を返却
  return {
    providerAccountId: String(payload.sub),
    email: typeof payload.email === 'string' ? payload.email : undefined,
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    image: typeof payload.picture === 'string' ? payload.picture : undefined,
  };
}

// AppleのIDトークンを検証し、ユーザー情報を抽出
async function verifyAppleIdToken(idToken: string) {
  const aud = process.env.OIDC_APPLE_CLIENT_ID ?? process.env.AUTH_APPLE_ID;
  if (!aud) throw new Error('APPLE_AUDIENCE_NOT_CONFIGURED');

  // Appleの公開鍵セットを取得し、JWT検証
  const jwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
  const { payload } = await jwtVerify(idToken, jwks, { audience: aud });

  // issuer(iss)の検証
  if (payload.iss !== 'https://appleid.apple.com') {
    throw new Error('APPLE_ISS_MISMATCH');
  }

  // 必要な情報を返却（Appleはname, imageは提供しない）
  return {
    providerAccountId: String(payload.sub),
    email: typeof payload.email === 'string' ? payload.email : undefined,
    emailVerified: payload.email_verified === true,
    name: undefined,
    image: undefined,
  };
}

// Google/AppleのIDトークンを検証し、認証情報を返すエンドポイント
export default async function bootstrapAuth(request: FastifyRequest, reply: FastifyReply) {
  // リクエストボディのバリデーション
  const parsed = BodySchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send({ error: 'INVALID_BODY' });
  }

  const { provider, idToken } = parsed.data as Body;

  try {
    // プロバイダごとに検証処理を分岐
    const result =
      provider === 'google'
        ? await verifyGoogleIdToken(idToken)
        : await verifyAppleIdToken(idToken);

    // 検証成功時のレスポンス
    return reply.code(200).send({
      verify: true,
      provider,
      providerAccountId: result.providerAccountId,
      email: result.email ?? null,
      emailVerified: result.emailVerified,
    });
  } catch (e) {
    // 検証失敗時のエラーハンドリング
    request.log?.warn({ err: e }, 'bootstrap verify failed');
    return reply.code(401).send({ error: 'ID_TOKEN_INVALID' });
  }
}
