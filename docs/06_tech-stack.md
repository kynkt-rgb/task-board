# 技術選定

> 起動方法・公開手順は [README](../README.md)

## 使う技術
| 区分 | 選んだもの | 理由 |
|------|-----------|------|
| 画面 | HTML / CSS / JavaScript（ライブラリなし） | まずは基本を理解するため |
| サーバーの言語 | Node.js（22以上） | 画面と同じJavaScriptで書けるので、覚えることが少ない |
| サーバーのしくみ | Express 5 | Node.jsで一番使われていて、情報が多い。小さく始められる |
| DB | PostgreSQL 17 | 表を使う本格的なDB。仕事でもよく使われ、ER図の設計をそのまま使える |
| DBとの接続 | pg（node-postgres） | SQLを自分で書くことで、DBのしくみを理解できる |
| テスト | Node.js 標準のテスト（`node --test`） | 追加のライブラリがいらない |
| サーバーの公開先 | Render（無料プラン） | GitHubとつなぐだけで公開でき、pushすると自動で更新される |
| DBの公開先 | Neon（無料プラン） | PostgreSQLを無料で使い続けられる |
| 手元の開発環境 | Homebrew で入れた Node.js・PostgreSQL | Macで手軽に入れられる |
| バージョン管理 | Git / GitHub | 課題の提出と変更の記録のため |
| エディタ | Cursor | 普段使っているため |

## 比べたもの（選ばなかった理由）
| 検討したもの | 選ばなかった理由 |
|-------------|-----------------|
| localStorage（ブラウザに保存） | 端末ごとにデータが分かれ、PCとスマホで同じ内容を見られない |
| Supabase / Firebase | サーバーを自分で作らなくて済むが、今回はバックエンドを作るのが目的 |
| SQLite | 手軽だが、無料の公開先ではファイルが消えることがあり、運用に向かない |
| MySQL | PostgreSQLと同じくらい使えるが、無料で使い続けられる公開先が少ない |
| Prisma などのORM | 便利だが、まずはSQLを自分で書いて理解したい |
| React / Vue | 画面が1つで機能も少ないので不要 |
| ログイン画面を自作（セッション） | 利用者が1人なので、ブラウザ標準のベーシック認証で十分。HTTPSなら安全に使える |

## ファイル構成
```
task-board/
├── public/                 画面
│   ├── index.html
│   ├── style.css
│   └── script.js
├── src/                    サーバー
│   ├── server.js           起動・設定の読みこみ
│   ├── app.js              APIの入口
│   ├── auth.js             ログイン
│   ├── validation.js       入力チェック
│   ├── cards-repository.js DBの読み書き
│   ├── db.js               DBへの接続
│   └── migrate.js          テーブルの作成
├── db/schema.sql           テーブル定義
├── test/api.test.js        自動テスト
├── .env.example            設定のひな形
├── docs/                   要件定義書・設計書（docs/README.md が目次）
└── README.md               起動方法・公開手順・運用手順
```
