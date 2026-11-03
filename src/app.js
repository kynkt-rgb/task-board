import express from 'express';
import { fileURLToPath } from 'node:url';
import { basicAuth } from './auth.js';
import { createCard, deleteCard, listCards, moveCard, reorderCard } from './cards-repository.js';
import {
  SORTABLE_STATUSES, isValidDirection, isValidStatus, parseId, validateTitle,
} from './validation.js';

const publicDir = fileURLToPath(new URL('../public', import.meta.url));

/**
 * Webアプリを組み立てる。
 * pool: PostgreSQL の接続プール
 * auth: { user, password }。null のときはログインなし（開発用）
 */
export function createApp({ pool, auth }) {
  const app = express();
  app.disable('x-powered-by');

  // 安全のためのレスポンスヘッダー
  app.use((req, res, next) => {
    res.set({
      'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    next();
  });

  // 動いているかの確認用（公開先のヘルスチェックで使うので、ログイン不要）
  app.get('/api/health', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'error' });
    }
  });

  if (auth) {
    app.use(basicAuth(auth));
  }

  app.use(express.json({ limit: '10kb' }));

  // カード一覧
  app.get('/api/cards', async (req, res) => {
    res.json(await listCards(pool));
  });

  // カード追加
  app.post('/api/cards', async (req, res) => {
    const title = validateTitle(req.body?.title);
    if (!title.ok) {
      return res.status(400).json({ error: title.error });
    }
    res.status(201).json(await createCard(pool, title.value));
  });

  // カード移動（status をとなりの列に変える）
  app.patch('/api/cards/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'カードの番号が正しくありません' });
    }
    const status = req.body?.status;
    if (!isValidStatus(status)) {
      return res.status(400).json({ error: '列の指定が正しくありません' });
    }
    const moved = await moveCard(pool, id, status);
    if (moved.result === 'not_found') {
      return res.status(404).json({ error: 'カードが見つかりません' });
    }
    if (moved.result === 'not_adjacent') {
      return res.status(400).json({ error: 'カードはとなりの列にしか動かせません' });
    }
    res.json(moved.card);
  });

  // カード並び替え F-09（同じ列の1つ上・1つ下のカードと入れかえる）
  app.post('/api/cards/:id/reorder', async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'カードの番号が正しくありません' });
    }
    const direction = req.body?.direction;
    if (!isValidDirection(direction)) {
      return res.status(400).json({ error: '並び替えの向きが正しくありません' });
    }
    const reordered = await reorderCard(pool, id, direction, SORTABLE_STATUSES);
    if (reordered.result === 'not_found') {
      return res.status(404).json({ error: 'カードが見つかりません' });
    }
    if (reordered.result === 'not_sortable') {
      return res.status(400).json({ error: 'この列は並び替えできません' });
    }
    if (reordered.result === 'at_edge') {
      return res.status(400).json({
        error: direction === 'up' ? 'すでに一番上です' : 'すでに一番下です',
      });
    }
    res.json(reordered.card);
  });

  // カード削除
  app.delete('/api/cards/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'カードの番号が正しくありません' });
    }
    if (!(await deleteCard(pool, id))) {
      return res.status(404).json({ error: 'カードが見つかりません' });
    }
    res.status(204).end();
  });

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'APIが見つかりません' });
  });

  // 画面（HTML・CSS・JavaScript）
  app.use(express.static(publicDir));

  // エラーのまとめ処理
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: '送られたデータの形が正しくありません' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: '送られたデータが大きすぎます' });
    }
    console.error(err);
    res.status(500).json({ error: 'サーバーでエラーが起きました' });
  });

  return app;
}
