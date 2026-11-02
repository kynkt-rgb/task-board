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

/** カードを削除する。削除できたら true、見つからなければ false */
export async function deleteCard(pool, id) {
  const { rowCount } = await pool.query('DELETE FROM cards WHERE id = $1', [id]);
  return rowCount > 0;
}
