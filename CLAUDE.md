# CLAUDE.md

`black-miruten-bot` — TypeScript + discord.js のDiscord Bot。コードから読み取れない前提知識をここにまとめる。
使い方や機能の説明は `README.md` / `docs/commands/*.md` を参照。

## 開発環境の制約

- この開発環境にはNode.js/npmがローカルインストールされていない。`typecheck` / `lint` / `format` / `build` / 動作確認はすべてDocker経由で行う。

  ```bash
  docker run --rm -v "$(pwd)":/app -w /app node:20-bookworm \
    bash -lc "npm install && npm run typecheck && npm run lint && npm run format:check && npm test && npm run build"
  ```

  本番相当の確認(コンテナ起動・ヘルスチェック等)は `docker compose build` / `docker compose up -d` を使う。

- DockerデーモンへのアクセスはDocker Desktopの起動 + このWSLディストロのWSL Integration有効化に依存している。`docker ps` が失敗する場合は、ユーザーにDocker Desktopの状態を確認してもらう。
- 実際の `DISCORD_TOKEN` を使ってDiscordに接続する操作(`npm run deploy-commands`、`npm start` など)は、このセッションの自動権限判定でブロックされることがある。その場合は無理に回避せず、実行すべきコマンドを提示してユーザー自身のターミナルで実行してもらう。

## GitHub運用

- SSH鍵ベースのpush認証がこの環境ですでに設定済みのため、追加のトークン発行やログイン操作は不要(`git remote -v` で登録先を確認できる)。
- `gh` CLIでのリポジトリ作成・操作は基本的に避ける(認証すると会社Organizationのリポジトリにもアクセス可能なスコープが付与されうるため)。新規リポジトリが必要な場合は、ユーザーにGitHub Web UIで空リポジトリを作成してもらい、`git remote add` + `git push` で対応する。
- コミットは関心事ごとに分ける(例: 機能追加とlint/formatter導入の一括反映は別コミットにする)。

## デプロイ

- デプロイ先: Northflank(Developer Sandbox, `nf-compute-20`)。
- `Dockerfile` はマルチステージビルド(ビルド用ステージ + 本番依存関係のみの実行ステージ)。ビルド用ステージでは `tsc`(typecheck)→ ESLint → Prettier(format:check)→ Vitest(test)→ `tsc -p tsconfig.build.json`(build)を順に実行しており、いずれか1つでも失敗すると `docker build` 自体が失敗する。Northflankのビルドもこの `Dockerfile` を使うため、これがそのままデプロイ前のCIゲートとして機能する(壊れたコードはイメージが作られずデプロイされない)。
- `src/health.ts` が `GET /health` にHTTP 200を返す軽量サーバーを提供する(Node標準の `http` のみ、追加依存なし)。discord.jsのgateway接続はHTTPポート不要だが、Northflankのポート監視によるヘルスチェックに対応するために追加した。ポートは環境変数 `PORT`(未設定時 `8080`)。bot本体のログイン処理とは独立して動作し、どちらかの失敗がもう一方に影響しない。
- コマンド登録(`src/deploy-commands.ts` → `npm run deploy-commands` / `node dist/deploy-commands.js`)はbot本体の起動から独立したスクリプト。Northflank上では別の「Job」として手動トリガーする運用(常時稼働中のBotを再起動せずにコマンド定義を反映するため)。
- `DISCORD_GUILD_ID` はカンマ区切りで複数ギルドIDを指定でき、それぞれに順番に登録する(未設定ならグローバル登録)。サーバーを追加するたびにIDを追記してJobを再実行する運用。
- イントロクイズの問題データ(`src/introquiz/questionStore.ts`)はNorthflankの **MongoDB Addon** に保存する(永続ボリューム上のJSONファイルではない。Volumeは1インスタンスに固定されHAが効かない制約があり、Northflankも極力Addon利用を推奨しているため採用)。接続文字列は環境変数 `MONGODB_URI`。ローカル/バルクでの問題投入は `npm run seed-questions -- <questions.jsonのパス>`(`src/seedQuestions.ts`)を使うか、`mongosh`/MongoDB Compassで接続文字列に直接繋いで操作する。

## コーディング規約

- 日本語の文言(コマンド説明文・返信メッセージ・ログ出力)はすべて `src/messages.ts` に集約し、コード側からは変数として参照する。新しい文言もここに追記する。
- 新しいコマンドは `src/commands/` に1ファイル追加するだけでよい。`export default { data, execute } satisfies SlashCommand;` 形式で書けば `src/loadCommands.ts` が自動で走査・登録するため、`index.ts` / `deploy-commands.ts` の修正は不要。
- コマンド固有のドキュメント(使用例・設定方法など)は `docs/commands/<コマンド名>.md` に書き、`README.md` からはリンクするだけにする。スクリーンショットは `screenshots/` に置き、`.dockerignore` で本番イメージから除外している。
- ESLint(flat config, typescript-eslint推奨ルール) + Prettierを導入済み。コミット前に `npm run lint` と `npm run format:check` を通す。
