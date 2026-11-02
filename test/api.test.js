import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { createPool } from '../src/db.js';
import { migrate } from '../src/migrate.js';

// テスト用DB（.env.test の DATABASE_URL）を使う。開発用DBのデータは消さない
assert.match(process.env.DATABASE_URL ?? '', /_test\b/, 'テストはテスト用DBで実行してください');

const auth = { user: 'tester', password: 'secret' };
const authHeader = `Basic ${Buffer.from('tester:secret').toString('base64')}`;

let pool;
let server;
let baseUrl;

before(async () => {
  pool = createPool();
  await migrate(pool);
  server = createApp({ pool, auth }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

beforeEach(async () => {
  await pool.query('TRUNCATE cards');
});

/** ログイン済みでAPIを呼ぶ */
async function call(method, path, body) {
  const response = await fetch(baseUrl + path, {
    method,
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

const addCard = (title) => call('POST', '/api/cards', { title });
const titles = async () => (await call('GET', '/api/cards')).body.map((c) => `${c.status}:${c.title}`);

describe('ログイン', () => {
  test('ヘルスチェックはログインなしで使える', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });

  test('ログインしていないとAPIも画面も使えない', async () => {
    for (const path of ['/api/cards', '/']) {
      const response = await fetch(baseUrl + path);
      assert.equal(response.status, 401, path);
      assert.match(response.headers.get('www-authenticate'), /^Basic/);
    }
  });

  test('パスワードがちがうと使えない', async () => {
    const wrong = `Basic ${Buffer.from('tester:wrong').toString('base64')}`;
    const response = await fetch(`${baseUrl}/api/cards`, { headers: { Authorization: wrong } });
    assert.equal(response.status, 401);
  });

  test('ログインすると画面が表示される', async () => {
    const response = await fetch(`${baseUrl}/`, { headers: { Authorization: authHeader } });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<title>タスクボード<\/title>/);
  });
});

describe('カード追加 F-02', () => {
  test('前後の空白を取りのぞいて「やること」に追加する', async () => {
    const { status, body } = await addCard('  宿題  ');
    assert.equal(status, 201);
    assert.equal(body.title, '宿題');
    assert.equal(body.status, 'todo');
    assert.equal(typeof body.id, 'number');
  });

  test('空・空白だけ・文字以外は追加しない', async () => {
    for (const title of ['', '   ', '　', 123, null, undefined]) {
      const { status } = await call('POST', '/api/cards', { title });
      assert.equal(status, 400, JSON.stringify(title));
    }
    assert.deepEqual(await titles(), []);
  });

  test('50文字まではOK、51文字はエラー（絵文字も1文字と数える）', async () => {
    assert.equal((await addCard('あ'.repeat(50))).status, 201);
    assert.equal((await addCard('😀'.repeat(50))).status, 201);
    assert.equal((await addCard('あ'.repeat(51))).status, 400);
  });

  test('タグを入れても文字のまま保存される', async () => {
    const { body } = await addCard('<b>テスト</b>');
    assert.equal(body.title, '<b>テスト</b>');
  });

  test('形の正しくないJSONはエラー', async () => {
    const response = await fetch(`${baseUrl}/api/cards`, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: '{"title":',
    });
    assert.equal(response.status, 400);
  });
});

describe('一覧 F-01', () => {
  test('列の順、列の中では追加した順にならぶ', async () => {
    await addCard('A');
    const b = (await addCard('B')).body;
    await addCard('C');
    await call('PATCH', `/api/cards/${b.id}`, { status: 'doing' });
    assert.deepEqual(await titles(), ['todo:A', 'todo:C', 'doing:B']);
  });
});

describe('カード移動 F-03', () => {
  test('やること → 進行中 → 完了 → 進行中 と動かせる', async () => {
    const { id } = (await addCard('宿題')).body;
    for (const status of ['doing', 'done', 'doing']) {
      const { status: code, body } = await call('PATCH', `/api/cards/${id}`, { status });
      assert.equal(code, 200);
      assert.equal(body.status, status);
    }
  });

  test('動かしたカードは移動先の列の一番下に入る', async () => {
    const a = (await addCard('A')).body;
    await addCard('B');
    await call('PATCH', `/api/cards/${a.id}`, { status: 'doing' });
    await call('PATCH', `/api/cards/${a.id}`, { status: 'todo' });
    assert.deepEqual(await titles(), ['todo:B', 'todo:A']);
  });

  test('となりでない列には動かせない', async () => {
    const { id } = (await addCard('宿題')).body;
    const { status } = await call('PATCH', `/api/cards/${id}`, { status: 'done' });
    assert.equal(status, 400);
    assert.deepEqual(await titles(), ['todo:宿題']);
  });

  test('同じ列への移動・存在しない列はエラー', async () => {
    const { id } = (await addCard('宿題')).body;
    assert.equal((await call('PATCH', `/api/cards/${id}`, { status: 'todo' })).status, 400);
    assert.equal((await call('PATCH', `/api/cards/${id}`, { status: 'archive' })).status, 400);
  });

  test('存在しないカード・正しくない番号はエラー', async () => {
    assert.equal((await call('PATCH', '/api/cards/999999', { status: 'doing' })).status, 404);
    assert.equal((await call('PATCH', '/api/cards/abc', { status: 'doing' })).status, 400);
  });
});

describe('カード削除 F-04', () => {
  test('削除すると一覧から消え、2回目は見つからない', async () => {
    const { id } = (await addCard('宿題')).body;
    assert.equal((await call('DELETE', `/api/cards/${id}`)).status, 204);
    assert.deepEqual(await titles(), []);
    assert.equal((await call('DELETE', `/api/cards/${id}`)).status, 404);
  });
});

describe('保存 F-05', () => {
  test('サーバーを作りなおしてもデータが残っている', async () => {
    await addCard('宿題');
    const otherPool = createPool();
    try {
      const other = createApp({ pool: otherPool, auth }).listen(0);
      await new Promise((resolve) => other.once('listening', resolve));
      const response = await fetch(`http://localhost:${other.address().port}/api/cards`, {
        headers: { Authorization: authHeader },
      });
      assert.deepEqual((await response.json()).map((c) => c.title), ['宿題']);
      await new Promise((resolve) => other.close(resolve));
    } finally {
      await otherPool.end();
    }
  });
});
