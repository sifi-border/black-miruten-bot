# CLAUDE.md

`black-miruten-bot` — TypeScript + discord.js のDiscord Bot。コードから読み取れない前提知識をここにまとめる。
使い方や機能の説明は `README.md` / `docs/commands/*.md` を参照。

## 開発環境の制約

- この開発環境にはNode.js/npmがローカルインストールされていない。`typecheck` / `lint` / `format` / `build` / 動作確認はすべてDocker経由で行う。

  ```bash
  docker run --rm -v "$(pwd)":/app -w /app node:22-bookworm \
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
- **Node.jsは22系(`>=22.12.0`)が必須**(`Dockerfile`は`node:22-bookworm-slim`)。`@discordjs/voice`をDAVEプロトコル(DiscordのボイスチャンネルE2EE、2026年にDiscordが強制化)対応の`^0.19.x`系に上げた際に必要になった。`0.18.x`以下はDAVE未対応で、DAVE必須のチャンネルではボイス接続がVoice Gateway close code `4017`(E2EE/DAVE protocol required)で即座に切断される。この事象は`VoiceConnection`/`Networking`のstateChange/debug/closeイベントをログ出力してようやく特定できた(`src/introquiz/session.ts`)。
- **YouTube音源の取得は`yt-dlp`(公式スタンドアロンLinuxバイナリ)を使う**(`src/introquiz/youtubeResolver.ts`)。以前は`play-dl`を使っていたが、`play-dl`は実質メンテナンス終了(2023年9月公開の`1.9.7`が最新かつ最終版)しており、YouTube側の仕様変更で`TypeError: Invalid URL`と共に壊れた。`yt-dlp`はPython製だが、Python不要のスタンドアロンバイナリが公式配布されているためこちらを`Dockerfile`の実行ステージで`ADD`により直接取得している(`youtube-dl-exec`はシステムPython必須、`yt-dlp-wrap`/`yt-dlp-exec`は非サポート/archivedのため、npmラッパーはいずれも不採用)。
  - **`ffmpeg`(`ffmpeg-static`のバイナリ)にHTTPS URLを直接開かせるとこの環境ではセグフォルトする**(googlevideo.com固有ではなく、無関係な別のHTTPS URLでも即座に再現。`ffmpeg-static`のgnutlsリンクの問題と見られる、原因の完全特定はしていない)。そのため`yt-dlp`には単なるURL解決(`-g`)ではなく、`yt-dlp -f bestaudio -o - <url>`で音声データそのものをstdout経由でストリームさせ、`ffmpeg`にはそのローカルパイプ(`-i pipe:0`)経由でのみデータを渡す構成にしている(`createYoutubeAudioStream`が子プロセスのstdoutを返し、`audio.ts`側でffmpegの標準入力にpipeする)。`-ss`によるシークはこの非シーク可能なパイプ入力に対しては先頭からデコードして読み捨てる形になるため、`mode=random`で曲の後半にシークする場合はレイテンシが伸びる(既知のトレードオフ、`AUDIO_PLAYING_TIMEOUT_MS`で吸収)。
  - `Dockerfile`の`YTDLP_VERSION`は固定バージョンで、`latest`は使わない(Dockerの`ADD <url>`はURL文字列でレイヤーキャッシュされるため、`latest`のままだと2回目以降のビルドで実際には更新されない)。イントロクイズの再生が抽出エラーで壊れたら、まずこのバージョンをyt-dlpの最新安定版(https://github.com/yt-dlp/yt-dlp/releases)に上げてみる。
  - `yt-dlp`は`Dockerfile`の実行ステージにのみ同梱される(`ffmpeg-static`と違い、npm経由でどこでも自動的に使えるわけではない)。ローカルで`npm run dev`によりイントロクイズの音声再生を試す場合は、別途`yt-dlp`をローカルにインストールしPATHに通すか、環境変数`YTDLP_PATH`でバイナリの場所を指定する必要がある。
  - `opusscript`は不要になり削除した。以前はPCMをJS側でOpusエンコードするために使っていたが、今は`ffmpeg`が`-acodec libopus`で直接Opusエンコードしたものを`StreamType.OggOpus`として渡しているため、`@discordjs/voice`側でのエンコードが発生しない。
  - **yt-dlpの抽出フェーズ(YouTube側のページ/フォーマット解決)が本番で最初の音声データが出るまで約14秒かかる事象を確認した**(ローカル/Docker Desktop環境では2秒未満で再現せず、YouTube側のボット検知がソースIPの評判に依存するためと見られる)。参考実装(museofficial/muse)を調査したが、同じくyt-dlpを使っておりプリフェッチ等の高速化手段は持っていない(同一URL再生時のみ効くディスクキャッシュがあるのみで、毎回別動画のクイズには効かない)。実測診断の結果:
    - `-f bestaudio`が選ぶフォーマットは元々`https`直接配信で、HLS/DASHマニフェスト起因の遅延ではなかった。ただし`-f bestaudio/best`(音声専用が取れない場合のフォールバック)と`-S proto:https`(HLS/DASHよりhttps直接配信を優先)はmuseから転用、安全な改善として採用
    - `--extractor-args "youtube:player_client=ios"`のように特定クライアントに固定するのは**実際に試すと壊れる**(iosクライアントはGVS PO Tokenが無いと`https`フォーマットがスキップされ再生不能になる)。特定クライアント固定は不採用
    - `--js-runtimes node`はスタンドアロンバイナリ(`yt-dlp_linux`)でも動作すること、`yt_dlp_ejs`が同梱済みで追加インストール不要なことを実機確認済み。追加コストゼロで「JS実行環境が見つからない」警告と将来のフォーマット欠落/スロットリングを回避できるため採用した(Denoの別途インストールは、抽出フェーズ自体を速くする効果は薄いとの調査結果により見送った。JS実行コストはYouTubeプレイヤーのバージョンごとにディスクキャッシュされ、リクエストごとのコストではないため)
    - 14秒の根本原因(player clientの複数試行・リトライか、Northflank固有のネットワーク遅延か)はローカルでは再現できず未特定のまま。上記の改善は「低リスクで効果が見込める対策」であり、根本解決の保証ではない。再度遅延が問題になった場合は、`youtubeResolver.ts`/`audio.ts`に仕込んである診断ログ(`yt-dlpから最初の音声データを受信しました`等)のタイムスタンプ差分を見る

## コーディング規約

- 日本語の文言(コマンド説明文・返信メッセージ・ログ出力)はすべて `src/messages.ts` に集約し、コード側からは変数として参照する。新しい文言もここに追記する。
- 新しいコマンドは `src/commands/` に1ファイル追加するだけでよい。`export default { data, execute } satisfies SlashCommand;` 形式で書けば `src/loadCommands.ts` が自動で走査・登録するため、`index.ts` / `deploy-commands.ts` の修正は不要。
- コマンド固有のドキュメント(使用例・設定方法など)は `docs/commands/<コマンド名>.md` に書き、`README.md` からはリンクするだけにする。スクリーンショットは `screenshots/` に置き、`.dockerignore` で本番イメージから除外している。
- ESLint(flat config, typescript-eslint推奨ルール) + Prettierを導入済み。コミット前に `npm run lint` と `npm run format:check` を通す。
