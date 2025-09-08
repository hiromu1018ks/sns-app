// Fastify本体とプラグインのインポート
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';

// Fastifyインスタンスの作成（ロガー有効化）
const app = Fastify({
  logger: {
    level: 'info',
  },
});

// 環境変数から許可するCORSオリジンを配列で取得
const origins = (process.env.CORS_ALLOWED_ORIGIN ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// CORSプラグインの登録
// 許可されたオリジンのみアクセス可能にする
await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // origin未指定は許可
    if (origin.length === 0 || origins.includes(origin)) {
      return cb(null, true); // 許可リストに含まれる場合は許可
    }
    return cb(new Error('CORS not allowed'), false); // それ以外は拒否
  },
  credentials: (process.env.CORS_ALLOW_CREDENTIALS ?? 'true') === 'true',
});

// Cookieプラグインの登録
await app.register(cookie, {});

// ヘルスチェック用エンドポイント
app.get('/healthz', async () => {
  return { status: 'ok' };
});

// サーバーのポートとホスト設定
const port = Number(process.env.PORT ?? 8080);
const host = '0.0.0.0';

// サーバー起動
app
  .listen({ port, host })
  .then(() => {
    app.log.info({ port }, 'API started'); // 起動成功時のログ
  })
  .catch((err) => {
    app.log.error(err, 'API failed to start'); // 起動失敗時のログ
    process.exit(1);
  });
