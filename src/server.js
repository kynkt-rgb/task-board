import { createApp } from './app.js';
import { createPool } from './db.js';
import { migrate } from './migrate.js';

const { APP_USER, APP_PASSWORD, NODE_ENV } = process.env;
const port = Number(process.env.PORT ?? 3000);

let auth = null;
if (APP_USER && APP_PASSWORD) {
  auth = { user: APP_USER, password: APP_PASSWORD };
} else if (NODE_ENV === 'production') {
  // 本番でパスワードを設定し忘れると誰でも使えてしまうので、起動しない
  console.error('本番環境では APP_USER と APP_PASSWORD の設定が必要です');
  process.exit(1);
} else {
  console.warn('APP_USER / APP_PASSWORD が未設定のため、ログインなしで起動します（開発用）');
}

const pool = createPool();
await migrate(pool);

const app = createApp({ pool, auth });
const server = app.listen(port, () => {
  console.log(`タスクボードを起動しました: http://localhost:${port}`);
});

// 公開先から停止の合図が来たら、処理中のリクエストを終えてから止める
function shutdown() {
  server.close(() => pool.end().then(() => process.exit(0)));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
