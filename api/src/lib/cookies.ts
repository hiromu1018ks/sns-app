// Cookie操作（リフレッシュトークン用）のユーティリティ
import { FastifyReply, FastifyRequest } from 'fastify';

// リフレッシュトークンのCookie名（環境変数で上書き可）
export const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME ?? 'refresh_token';

// Cookieのドメイン指定（環境変数で指定可）
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

// セキュア属性: 本番環境ではtrue（HTTPSのみ送信）
const IS_SECURE = process.env.APP_ENV === 'prod' || process.env.NODE_ENV === 'production';

// Cookieの基本オプション型
// httpOnly: JSからアクセス不可, sameSite: lax, secure: HTTPSのみ, domain: 任意, path: '/', maxAge: 任意
// maxAgeは秒単位
// pathは'/'固定
// domainは未指定ならundefined
// secureは環境依存
// httpOnlyは常にtrue
// sameSiteはlax固定
type BaseOptions = {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  domain?: string;
  path: '/';
  maxAge?: number;
};

// Cookieの基本オプションを生成する関数
function baseCookieOptions(maxAgeSec?: number): BaseOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_SECURE,
    domain: COOKIE_DOMAIN,
    path: '/',
    ...(typeof maxAgeSec === 'number' ? { maxAge: maxAgeSec } : {}),
  };
}

// リフレッシュトークンをCookieにセットする
export function setRefreshCoolie(reply: FastifyReply, token: string, maxAgeSec?: number) {
  reply.setCookie(REFRESH_COOKIE_NAME, token, baseCookieOptions(maxAgeSec));
}

// リフレッシュトークンCookieを削除する（ログアウト等）
export function clearRefreshCookie(reply: FastifyReply) {
  reply.clearCookie(REFRESH_COOKIE_NAME, {
    ...baseCookieOptions(),
    maxAge: 0,
  });
}

// リクエストからリフレッシュトークンCookieを取得する
export function getRefreshCookie(req: FastifyRequest): string | undefined {
  return req.cookies?.[REFRESH_COOKIE_NAME];
}
