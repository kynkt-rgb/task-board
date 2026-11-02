-- タスクボードのテーブル定義
-- 何度実行しても同じ結果になるように書いている（サーバー起動時に毎回実行する）

-- 列（やること・進行中・完了）。決まった3件だけを入れるマスタ表
CREATE TABLE IF NOT EXISTS columns (
  id         TEXT    PRIMARY KEY,
  name       TEXT    NOT NULL,
  sort_order INTEGER NOT NULL UNIQUE
);

INSERT INTO columns (id, name, sort_order) VALUES
  ('todo',  'やること', 1),
  ('doing', '進行中',   2),
  ('done',  '完了',     3)
ON CONFLICT (id) DO NOTHING;

-- 列の中での並び順に使う番号。追加・移動のたびに新しい番号を振り、列の一番下に来るようにする
CREATE SEQUENCE IF NOT EXISTS cards_position_seq;

-- カード
CREATE TABLE IF NOT EXISTS cards (
  id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title      TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 50),
  status     TEXT        NOT NULL DEFAULT 'todo' REFERENCES columns (id),
  position   BIGINT      NOT NULL DEFAULT nextval('cards_position_seq'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cards_status_position_idx ON cards (status, position);
