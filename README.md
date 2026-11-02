# タスクボード

「やること」「進行中」「完了」の3列でタスクを管理するWebアプリです。スクール（RaiseTech）の課題として作っています。
データは PostgreSQL に保存するので、別のPCやスマホから開いても同じカードが表示されます。

- 要件定義書・設計書：[docs/](docs/README.md)
- 公開URL：（公開したらここに書く）

## 使っている技術
| 区分 | 技術 |
|------|------|
| 画面 | HTML / CSS / JavaScript（ライブラリなし） |
| サーバー | Node.js 22以上 / Express 5 |
| DB | PostgreSQL 17（ライブラリは `pg`） |
| テスト | Node.js 標準のテスト機能（`node --test`） |
| 公開 | Render（サーバー）＋ Neon（DB） |

## フォルダの中身
```
task-board/
├── docs/                   要件定義書・設計書
├── public/                 画面（ブラウザで動くもの）
│   ├── index.html
│   ├── style.css
│   └── script.js
├── src/                    サーバー
│   ├── server.js           起動するところ
│   ├── app.js              APIの入口（URLごとの処理）
│   ├── auth.js             ログイン（ベーシック認証）
│   ├── validation.js       入力チェック
│   ├── cards-repository.js DBの読み書き（SQLはここだけ）
│   ├── db.js               DBへの接続
│   └── migrate.js          テーブルを作る
├── db/schema.sql           テーブル定義
├── test/api.test.js        自動テスト
├── .env.example            設定のひな形
└── .env.test               自動テスト用の設定
```

## 手元で動かす（Mac）
```sh
# 1. Node.js と PostgreSQL を入れて、PostgreSQL を起動する（最初の1回だけ）
brew install node postgresql@17
brew services start postgresql@17

# 2. DBを作る（最初の1回だけ）
/opt/homebrew/opt/postgresql@17/bin/createdb task_board
/opt/homebrew/opt/postgresql@17/bin/createdb task_board_test

# 3. ライブラリを入れて、設定ファイルを作る（最初の1回だけ）
npm install
cp .env.example .env    # 必要なら .env の APP_PASSWORD を書きかえる

# 4. 起動する（ファイルを保存すると自動で再起動する）
npm run dev
```
ブラウザで http://localhost:3000 を開き、`.env` の `APP_USER` / `APP_PASSWORD` でログインします。
テーブルはサーバー起動時に自動で作られます。

### 自動テスト
```sh
npm test
```
テスト用DB（`task_board_test`）を使います。テストのたびにカードを全部消すので、開発用DBとは分けています。

## 設定（環境変数）
| 名前 | 必須 | 内容 |
|------|------|------|
| `DATABASE_URL` | ○ | DBの接続先。クラウドのDBでは末尾に `?sslmode=require` をつける |
| `APP_USER` | 本番は○ | ログインのユーザー名 |
| `APP_PASSWORD` | 本番は○ | ログインのパスワード。長くて推測されにくいものにする |
| `NODE_ENV` | 本番は○ | 本番では `production`。このとき `APP_USER` / `APP_PASSWORD` が無いと起動しない |
| `PORT` | | 待ち受けるポート番号（初期値 3000。Render では自動で入る） |

## API
すべてログインが必要です（`/api/health` 以外）。データの形はJSONです。

| メソッド | URL | 内容 | 送るもの | 成功 | 主なエラー |
|---------|-----|------|----------|------|-----------|
| GET | `/api/health` | 動いているかの確認 | － | 200 | 503（DBにつながらない） |
| GET | `/api/cards` | カード一覧（列の順・列の中の順） | － | 200 | 401 |
| POST | `/api/cards` | カード追加（「やること」の一番下） | `{"title":"宿題"}` | 201 | 400（空・51文字以上） |
| PATCH | `/api/cards/:id` | となりの列へ移動（移動先の一番下） | `{"status":"doing"}` | 200 | 400（となりでない列）・404 |
| DELETE | `/api/cards/:id` | カード削除 | － | 204 | 404 |

エラーのときは `{"error":"メッセージ"}` が返ります。

## 公開する（Render ＋ Neon）
どちらも無料で始められます。無料の範囲や条件は変わることがあるので、登録するときに各サービスの料金ページで確認してください。

1. **GitHub に push する**
2. **Neon でDBを作る**（https://neon.tech）
   - プロジェクトを作り、接続文字列（`postgresql://...?sslmode=require`）をコピーする
3. **Render でサーバーを作る**（https://render.com）
   - New → Web Service → GitHub の `task-board` リポジトリを選ぶ
   - Build Command：`npm install` ／ Start Command：`npm start`
   - Health Check Path：`/api/health`
   - Environment に `DATABASE_URL`（Neon の接続文字列）・`APP_USER`・`APP_PASSWORD`・`NODE_ENV=production` を入れる
4. 発行されたURL（`https://〜.onrender.com`）を開いてログインできれば完了。README の「公開URL」に書く

以後は `main` ブランチに push すると、自動で公開しなおされます。

## 運用
| やること | タイミング | 方法 |
|---------|-----------|------|
| 動いているか確認 | 使うとき | `https://〜/api/health` が `{"status":"ok"}` を返す |
| エラーの確認 | おかしいとき | Render の Logs 画面を見る |
| バックアップ | 月1回 | `pg_dump "$DATABASE_URL" > backup-YYYYMMDD.sql`（Neon の画面からも復元できる） |
| ライブラリの更新 | 月1回 | `npm outdated` → `npm update` → `npm test` が通ってから push |
| パスワード変更 | 漏れたかもしれないとき | Render の Environment で `APP_PASSWORD` を変える |

注意：Render の無料プランでは、しばらく使わないとサーバーが止まり、次に開くときに表示まで時間がかかります（データは消えません）。
