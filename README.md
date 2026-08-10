# black-miruten-bot

TypeScript + discord.js で実装した、複数のスラッシュコマンドをまとめて運用するDiscord Botです。

## セットアップ

```bash
npm install
cp .env.example .env
```

`.env` に以下を設定してください。

| 変数名              | 必須 | 説明                                                                                                                |
| ------------------- | ---- | ------------------------------------------------------------------------------------------------------------------- |
| `DISCORD_TOKEN`     | ○    | BotのToken                                                                                                          |
| `DISCORD_CLIENT_ID` | ○    | アプリケーション(Client) ID。コマンド登録に使用                                                                     |
| `DISCORD_GUILD_ID`  | -    | 指定するとそのギルドのみにコマンドを登録(反映が速い)。複数ギルドはカンマ区切り(`111,222`)。未指定ならグローバル登録 |

## コマンド登録

```bash
npm run deploy-commands
```

`DISCORD_GUILD_ID` にカンマ区切りで複数のギルドIDを指定すると、それぞれに対して順番に登録します(並列実行によるレート制限を避けるため1件ずつ実行)。
一部のギルドで登録に失敗した場合、成功したギルドの登録はそのまま活かしつつ、失敗したギルドIDをログに出力してスクリプトは非ゼロの終了コードで終了します。
サーバーを追加するたびに `DISCORD_GUILD_ID` にIDを追記して再実行する運用になります。

`src/commands/` 配下のファイルは `src/loadCommands.ts` が自動で走査して登録します。
新しいコマンドを追加したい場合は、`src/commands/` に `export default { data, execute }` 形式のファイルを1つ置くだけで、
`index.ts` / `deploy-commands.ts` 側の修正なしに読み込まれます。

## 起動

```bash
npm run dev    # 開発時 (tsx watch)
npm run build && npm start  # 本番向け (tsc → node)
```

## Lint / Format

```bash
npm run lint          # ESLint (typescript-eslint推奨ルール)
npm run lint:fix      # 自動修正可能な指摘を修正
npm run format        # Prettierで整形
npm run format:check  # 整形が必要な箇所がないかCIなどで確認
```

## Dockerでの運用(推奨)

ホストにNode.jsを入れずに、Dockerだけで常時起動・運用できます。`.env` は事前に用意しておいてください(上記参照)。

```bash
# イメージをビルド
docker compose build

# コマンド登録(初回、またはコマンド定義を変更した時だけでよい)
docker compose run --rm bot node dist/deploy-commands.js

# 常時起動(バックグラウンド、再起動時も自動起動: restart: unless-stopped)
docker compose up -d

# ログ確認
docker compose logs -f

# 停止
docker compose down
```

`Dockerfile` はマルチステージビルドになっており、ビルド用ステージ(`npm ci` + `tsc`)と実行用ステージ(本番依存のみ + `dist/` + `assets/`)を分けているため、実行イメージには開発用の依存関係やソースの `.ts` ファイルは含まれません。
`.env` はイメージには焼き込まず、`docker-compose.yml` の `env_file` で実行時に読み込みます(トークンを含むイメージを誤って配布してしまうリスクを避けるため)。

将来的に外部のホスティングサービスにデプロイする場合も、多くのPaaS(Railway, Fly.ioなど)はこの `Dockerfile` をそのまま利用してビルドできます。

### ヘルスチェックエンドポイント

`GET /health` に `{"status":"ok"}` (HTTP 200) を返す軽量サーバーが `src/health.ts` で起動します。
discord.jsのgateway接続はHTTPポートを必要としませんが、Northflankのようにポート監視でプロセスの生存確認を行うPaaSにデプロイする際に使うためのものです。
ポートは環境変数 `PORT` から取得し(PaaS側が自動注入する想定)、未設定時は `8080` にフォールバックします。ボット本体のログイン処理・コマンド実行とは独立して動くため、どちらかの失敗がもう一方に影響することはありません。

## コマンド

| コマンド       | 説明                                                                   | 詳細                                                         |
| -------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| `/miruten-say` | メッセージを罫線囲みの吹き出しに整形し、固定画像を添付して投稿します。 | [docs/commands/miruten-say.md](docs/commands/miruten-say.md) |

## 新しいコマンドの追加方法

- コマンドを追加する場合は `src/commands/` に新しいファイルを1つ追加するだけです。
- 吹き出しテキスト生成ロジック(`src/utils/bubble.ts` の `buildBubbleText` / `getDisplayWidth`)はDiscord非依存の純粋関数として切り出してあるため、
  別の新しいコマンドからもそのままimportして再利用できます。

### コマンドファイルの形式

各コマンドファイルは discord.js公式ガイドに準拠し、次の形式で `data` と `execute` をセットでdefault exportします。
コマンドの説明文・返信メッセージなど日本語の文言は `src/messages.ts` に追加し、コード側からは変数として参照してください
(文言だけを見直したいときにロジックのファイルを触らずに済むようにするため)。

```typescript
import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { messages } from "../messages";
import type { SlashCommand } from "../types";

const data = new SlashCommandBuilder()
  .setName("example")
  .setDescription(messages.example.commandDescription);

async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.reply(messages.example.reply);
}

export default { data, execute } satisfies SlashCommand;
```

## ディレクトリ構成

```
src/
  index.ts              Bot起動・ログイン処理、interactionのディスパッチ
  deploy-commands.ts    スラッシュコマンドをDiscordに登録するスクリプト
  loadCommands.ts       commands/ 配下を自動走査してコマンドを収集する仕組み
  messages.ts           コマンド説明文・返信メッセージ・ログ文言を一元管理
  types.ts              コマンドの型定義 (SlashCommand)
  commands/
    miruten-say.ts       /miruten-say のコマンド定義+実行ロジック
  config/
    images.ts            画像パスなどの設定
  utils/
    bubble.ts             吹き出しテキスト生成ロジック(表示幅計算・罫線組み立て、Discord非依存)
assets/images/
  character.png         添付するプレースホルダー画像(要差し替え)
docs/commands/
  miruten-say.md         /miruten-say の実行例・画像差し替え方法・罫線幅計算ロジック
screenshots/            ドキュメント用のスクリーンショット(ビルドイメージには含めない)
Dockerfile              マルチステージビルド(ビルド用/実行用)
docker-compose.yml      常時起動用のcompose設定
.dockerignore           イメージに含めないファイル(node_modules, .env, dist, docs等)
```
