// cards テーブルの読み書きをまとめたもの。SQLはこのファイルの中だけに書く

const CARD_COLUMNS = 'c.id, c.title, c.status, c.created_at, c.updated_at';

function toCard(row) {
  return {
    id: Number(row.id),
    title: row.title,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** すべてのカードを、列の順（やること→進行中→完了）・列の中の順で返す */
export async function listCards(pool) {
  const { rows } = await pool.query(
    `SELECT ${CARD_COLUMNS}
       FROM cards c
       JOIN columns col ON col.id = c.status
      ORDER BY col.sort_order, c.position`,
  );
  return rows.map(toCard);
}

/** 「やること」列の一番下にカードを追加する */
export async function createCard(pool, title) {
  const { rows } = await pool.query(
    `INSERT INTO cards AS c (title) VALUES ($1)
     RETURNING ${CARD_COLUMNS}`,
    [title],
  );
  return toCard(rows[0]);
}

/**
 * カードをとなりの列へ動かし、移動先の列の一番下に入れる。
 * 結果は { result: 'moved', card } / { result: 'not_found' } / { result: 'not_adjacent' } のどれか。
 */
export async function moveCard(pool, id, status) {
  const { rows } = await pool.query(
    `UPDATE cards c
        SET status = dst.id,
            position = nextval('cards_position_seq'),
            updated_at = now()
       FROM columns cur, columns dst
      WHERE c.id = $1
        AND cur.id = c.status
        AND dst.id = $2
        AND abs(cur.sort_order - dst.sort_order) = 1
     RETURNING ${CARD_COLUMNS}`,
    [id, status],
  );
  if (rows.length > 0) {
    return { result: 'moved', card: toCard(rows[0]) };
  }
  const exists = await pool.query('SELECT 1 FROM cards WHERE id = $1', [id]);
  return { result: exists.rowCount > 0 ? 'not_adjacent' : 'not_found' };
}

/**
 * F-09 カードを同じ列の1つ上（up）・1つ下（down）のカードと入れかえる。
 * 2枚の position を交換する。途中で失敗しても半分だけ変わらないよう、トランザクションで行う。
 * 結果は { result: 'reordered', card } / 'not_found' / 'not_sortable'（完了列） / 'at_edge'（端にいる）のどれか。
 */
export async function reorderCard(pool, id, direction, sortableStatuses) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 動かすカードを読み、ほかの操作に書きかえられないようロックする
    const current = await client.query(
      'SELECT id, status, position FROM cards WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (current.rowCount === 0) {
      await client.query('ROLLBACK');
      return { result: 'not_found' };
    }
    const card = current.rows[0];
    if (!sortableStatuses.includes(card.status)) {
      await client.query('ROLLBACK');
      return { result: 'not_sortable' };
    }

    // 同じ列で、すぐ上（position が小さい中で一番大きい）またはすぐ下のカードを探す
    const neighborSql = direction === 'up'
      ? `SELECT id, position FROM cards
          WHERE status = $1 AND position < $2
          ORDER BY position DESC LIMIT 1 FOR UPDATE`
      : `SELECT id, position FROM cards
          WHERE status = $1 AND position > $2
          ORDER BY position ASC LIMIT 1 FOR UPDATE`;
    const neighbor = await client.query(neighborSql, [card.status, card.position]);
    if (neighbor.rowCount === 0) {
      await client.query('ROLLBACK');
      return { result: 'at_edge' };
    }

    // 2枚の position を入れかえる
    await client.query(
      `UPDATE cards
          SET position = CASE WHEN id = $1 THEN $4::bigint ELSE $3::bigint END,
              updated_at = now()
        WHERE id IN ($1, $2)`,
      [card.id, neighbor.rows[0].id, card.position, neighbor.rows[0].position],
    );
    const updated = await client.query(
      `SELECT ${CARD_COLUMNS} FROM cards c WHERE c.id = $1`,
      [card.id],
    );
    await client.query('COMMIT');
    return { result: 'reordered', card: toCard(updated.rows[0]) };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** カードを削除する。削除できたら true、見つからなければ false */
export async function deleteCard(pool, id) {
  const { rowCount } = await pool.query('DELETE FROM cards WHERE id = $1', [id]);
  return rowCount > 0;
}
