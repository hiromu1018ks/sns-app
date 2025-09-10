// リフレッシュトークンのインメモリ管理・発行・検証・ローテーション・失効を行うユーティリティ
import crypto from 'node:crypto';

// リフレッシュトークン発行時の返却型
export type RefreshIssueResult = {
  token: string; // クライアントへ渡す不透明トークン（Cookieに入る）
  jti: string; // トークンID（内部識別子）
  userId: string; // AppUser UUID v7
  expiresAt: number; // UNIX秒
};

// 検証時の返却型
export type RefreshVerifyResult = {
  jti: string;
  userId: string;
  expiresAt: number;
};

// 内部で管理するリフレッシュトークンレコード
// rotatedTo: ローテーション先のjti（再利用検知用）
// revoked: 無効化フラグ
// tokenHash: 生トークンは保存せずハッシュのみ保持
// expiresAt: 有効期限（UNIX秒）
type Record = {
  jti: string;
  userId: string;
  tokenHash: string; // トークンのハッシュ（生値は保存しない）
  expiresAt: number;
  rotatedTo?: string; // ローテーション先の jti（再利用検知用）
  revoked?: boolean;
};

// TTL（有効期限）を秒単位でパースする関数
// 例: '30d', '1h', '900s' などをサポート。不正値は30日。
function parseTtlSeconds(input: string | undefined, fallback: string): number {
  const s = input ?? fallback;
  const m = s.match(/^(\d+)(ms|s|m|h|d)?$/i);
  if (!m) return 30 * 24 * 3600; // 30d
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

// リフレッシュトークンの有効期限（秒）
const REFRESH_TTL_SECONDS = parseTtlSeconds(process.env.REFRESH_TOKEN_TTL, '30d');

// 32バイト乱数をbase64urlエンコードしたトークンを生成
// base64url: +→-, /→_, =削除（URL安全な文字列）
function randomToken(): string {
  const b = crypto.randomBytes(32);
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 生トークンは保存せずハッシュ化して持つ（漏洩対策）
// DB等が漏洩しても生トークンは復元できない
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// トークンの有効期限切れ判定
function isExpired(nowSec: number, expiresAt: number): boolean {
  return nowSec >= expiresAt;
}

// ===== インメモリ実装（本番ではDB等に置き換え推奨） =====
const byJti = new Map<string, Record>(); // jti→Record
const byTokenHash = new Map<string, string>(); // tokenHash→jti

// 発行: 新規refreshを発行し保存
// 1ユーザーに複数発行も可能（多端末対応など）
export function issue(userId: string): RefreshIssueResult {
  const token = randomToken();
  const tokenHash = hashToken(token);
  const jti = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const rec: Record = {
    jti,
    userId,
    tokenHash,
    expiresAt: now + REFRESH_TTL_SECONDS,
  };
  byJti.set(jti, rec);
  byTokenHash.set(tokenHash, jti);

  return { token, jti, userId, expiresAt: rec.expiresAt };
}

// 検証: トークン生値→ハッシュ照合→有効性チェック
// revoked, expiresAt, 存在チェックをすべて行う
export function verify(token: string): RefreshVerifyResult {
  const jti = byTokenHash.get(hashToken(token));
  if (!jti) throw new Error('INVALID_REFRESH');
  const rec = byJti.get(jti);
  if (!rec) throw new Error('INVALID_REFRESH');
  if (rec.revoked) throw new Error('REVOKED_REFRESH');
  const now = Math.floor(Date.now() / 1000);
  if (isExpired(now, rec.expiresAt)) throw new Error('EXPIRED_REFRESH');
  return { jti: rec.jti, userId: rec.userId, expiresAt: rec.expiresAt };
}

// ローテーション: 古いrefreshを無効化し、新しいrefreshを発行
// 再利用検知: すでに rotatedTo がある古いトークンを再提出 → それは「再利用」
//   → 呼び出し側でユーザーの強制再ログイン等の対処が可能
export function rotate(oldToken: string): { result: RefreshIssueResult; reused: boolean } {
  const jti = byTokenHash.get(hashToken(oldToken));
  if (!jti) throw new Error('INVALID_REFRESH');
  const rec = byJti.get(jti);
  if (!rec) throw new Error('INVALID_REFRESH');

  const reused = !!rec.rotatedTo; // すでにローテーション済みなら再利用
  // 古いトークンはただちに失効扱い
  rec.revoked = true;

  // 新規発行
  const next = issue(rec.userId);
  rec.rotatedTo = next.jti;
  return { result: next, reused };
}

// 失効: jti指定で無効化（ログアウトなど）
export function revokeByJti(jti: string): void {
  const rec = byJti.get(jti);
  if (!rec) return;
  rec.revoked = true;
}
