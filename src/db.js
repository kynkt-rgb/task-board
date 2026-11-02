import pg from 'pg';

/**
 * PostgreSQL への接続プールを作る。
 * 接続先は環境変数 DATABASE_URL で指定する（例: postgres://localhost:5432/task_board）。
 * クラウドのDBでは URL の末尾に ?sslmode=require をつけて暗号化通信にする。
 */
export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error('環境変数 DATABASE_URL が設定されていません');
  }
  return new pg.Pool({ connectionString });
}
