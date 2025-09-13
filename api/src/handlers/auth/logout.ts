import type { FastifyReply, FastifyRequest } from 'fastify';
import { getRefreshCookie, clearRefreshCookie } from '../../lib/cookies';
import { verify as verifyRefresh, revokeByJti } from '../../lib/refreshStore';

/**
 * ログアウト処理を行うFastifyハンドラです。
 * リフレッシュトークンの検証・失効、Cookieのクリアを実施します。
 *
 * @param request FastifyRequestオブジェクト
 * @param reply FastifyReplyオブジェクト
 * @return レスポンス
 */
export default async function logoutAuth(request: FastifyRequest, reply: FastifyReply) {
  // リフレッシュトークンをCookieから取得
  const token = getRefreshCookie(request);

  if (token) {
    try {
      // トークンの検証とJTIによる失効
      const { jti } = verifyRefresh(token);
      revokeByJti(jti);
    } catch (e) {
      // 検証失敗時はログのみ記録し、処理を継続
      request.log?.info({ err: e }, 'logout: refresh verify/revoke skipped');
    }
  }

  // リフレッシュトークンCookieをクリア
  clearRefreshCookie(reply);
  // 204 No Contentでレスポンス
  return reply.code(204).send();
}
