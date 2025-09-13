import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../../lib/prisma';
import { getRefreshCookie, setRefreshCookie } from '../../lib/cookies';
import { rotate as rotateRefresh } from '../../lib/refreshStore';
import { signAccessToken } from '../../lib/jwt';

/**
 * リクエストのOriginヘッダーが許可リストに含まれているか判定します。
 *
 * @param req FastifyRequestオブジェクト
 * @return 許可されていればtrue、そうでなければfalse
 */
function isAllowedOrigin(req: FastifyRequest): boolean {
  // Originヘッダーを取得
  const origin = req.headers.origin;
  // Originがなければ許可
  if (!origin) return true;
  // 許可されたOriginリストを環境変数から取得
  const origins = (process.env.CORS_ALLOWED_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // 許可リストが空、またはリストに含まれていれば許可
  return origins.length === 0 || origins.includes(origin);
}

/**
 * リフレッシュトークンを用いた認証リフレッシュエンドポイントのハンドラです。
 * トークンの検証・ローテーション、アクセストークンの発行、ユーザー情報の返却を行います。
 *
 * @param request FastifyRequestオブジェクト
 * @param reply FastifyReplyオブジェクト
 * @return レスポンス
 */
export default async function refreshAuth(request: FastifyRequest, reply: FastifyReply) {
  // CSRF対策: Originチェック
  if (!isAllowedOrigin(request)) {
    return reply.code(401).send({ error: 'CSRF_ORIGIN' });
  }

  // リフレッシュトークンをCookieから取得
  const old = getRefreshCookie(request);
  if (!old) {
    return reply.code(401).send({ error: 'NO_REFRESH' });
  }

  try {
    // リフレッシュトークンをローテーション
    const { result: next, reused } = rotateRefresh(old);

    // 新しいリフレッシュトークンの有効期限を計算
    const nowSec = Math.floor(Date.now() / 1000);
    const maxAgeSec = Math.max(0, next.expiresAt - nowSec);
    // 新しいリフレッシュトークンをCookieにセット
    setRefreshCookie(reply, next.token, maxAgeSec);

    // appUser情報をDBから取得
    const appUser = await prisma.appUser.findUnique({
      where: { id: next.userId },
      include: { authUser: true },
    });
    if (!appUser) {
      return reply.code(401).send({ error: 'INVALID_REFRESH' });
    }

    // 新しいアクセストークンを発行
    const accessToken = await signAccessToken(appUser.id);

    // ユーザー情報の整形
    const email = appUser.authUser?.email ?? undefined;
    const name = appUser.authUser?.name ?? undefined;
    const displayName = name ?? (email ? email.split('@')[0] : '');

    // トークン再利用が検出された場合は警告ログ
    if (reused) {
      request.log?.warn({ appUserId: appUser.id }, 'refresh token reused detected');
    }

    // レスポンスとしてユーザー情報とアクセストークンを返却
    return reply.code(200).send({
      user: {
        id: appUser.id,
        ...(email ? { email } : {}),
        ...(displayName ? { displayName } : {}),
        createdAt: appUser.createdAt.toISOString(),
      },
      token: accessToken,
    });
  } catch (e) {
    // 例外発生時はエラーレスポンス
    request.log?.warn({ err: e }, 'refresh failed');
    return reply.code(401).send({ error: 'INVALID_REFRESH' });
  }
}
