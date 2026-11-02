import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createPool } from './db.js';

const schemaPath = fileURLToPath(new URL('../db/schema.sql', import.meta.url));

/** db/schema.sql を実行して、テーブルを用意する */
export async function migrate(pool) {
  const sql = await readFile(schemaPath, 'utf8');
  await pool.query(sql);
}

// `npm run db:migrate` で直接実行されたときだけ動く
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = createPool();
  try {
    await migrate(pool);
    console.log('テーブルの準備ができました');
  } finally {
    await pool.end();
  }
}
