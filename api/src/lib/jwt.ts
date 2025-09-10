// JWT(JSON Web Token)の生成・検証を行うユーティリティ
import { jwtVerify, SignJWT } from 'jose';

// アクセストークンの署名に使うシークレットキーを環境変数から取得
// セキュリティのため、本番環境では必ず安全な値を設定すること
const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET ?? process.env.AUTH_SECRET ?? 'changeme-dev-secret';

// joseライブラリはUint8Array型のシークレットを要求するため、変換関数を用意
const toUint8 = (s: string) => new TextEncoder().encode(s);
const secret = toUint8(ACCESS_TOKEN_SECRET);

// 文字列で与えられたTTL(例: '15m', '1h', '30s')を秒数に変換する関数
// サポート単位: ms(ミリ秒), s(秒), m(分), h(時), d(日)
// 不正な値の場合は15分(900秒)をデフォルトとする
function parseTtlSeconds(input: string | undefined, fallback: string): number {
  const s = input ?? fallback;
  const m = s.match(/^(\d+)(ms|s|m|h|d)?$/i);
  if (!m) return 15 * 60;
  const n = parseInt(m[1], 10);
  const unit = (m[2] ?? 's').toLowerCase();
  switch (unit) {
    case 'ms':
      return Math.ceil(n / 1000);
    case 's':
      return n;
    case 'm':
      return n * 60;
    case 'h':
      return n * 3600;
    case 'd':
      return n * 86400;
    default:
      return n;
  }
}

// アクセストークンの有効期限(秒)。環境変数で上書き可能
const ACCESS_TTL_SECONDS = parseTtlSeconds(process.env.ACCESS_TOKEN_TTL, '15m');

// 指定したユーザーID(appUserId)をsub(サブジェクト)としてJWTを生成
// JWTの有効期限や発行時刻もここで設定
export async function signAccessToken(appUserId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({})
    .setSubject(appUserId)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TTL_SECONDS)
    .sign(secret);
}

// JWTトークンを検証し、sub(ユーザーID)を返す
// 不正なトークンやsubが存在しない場合は例外を投げる
export async function verifyAccessToken(token: string): Promise<{ sub: string }> {
  const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Invalid token: sub not found');
  }

  return { sub: payload.sub };
}
