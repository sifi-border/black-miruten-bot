# miruten-say

`/miruten-say` スラッシュコマンドで、メッセージを罫線囲みの吹き出しに整形し、固定画像を添付して投稿するDiscord Botです。

## セットアップ

```bash
npm install
cp .env.example .env
```

`.env` に以下を設定してください。

| 変数名              | 必須 | 説明                                                                                   |
| ------------------- | ---- | -------------------------------------------------------------------------------------- |
| `DISCORD_TOKEN`     | ○    | BotのToken                                                                             |
| `DISCORD_CLIENT_ID` | ○    | アプリケーション(Client) ID。コマンド登録に使用                                        |
| `DISCORD_GUILD_ID`  | -    | 指定するとそのギルドのみにコマンドを登録(反映が速く開発向き)。未指定ならグローバル登録 |

## コマンド登録

```bash
npm run deploy-commands
```

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

## 画像の差し替え

`assets/images/character.png` はプレースホルダー画像です。実際に添付したいキャラクター画像に差し替えてください。
画像のパスは `src/config/images.ts` で管理しており、コード中にはハードコードしていません。

```typescript
export const DEFAULT_IMAGE_ID = "default";

export const BUBBLE_IMAGES: BubbleImageConfig[] = [
  { id: "default", label: "デフォルト", path: "assets/images/character.png" },
];
```

## 将来の拡張(複数画像から選択・コマンド追加)

- 画像を増やす場合は `BUBBLE_IMAGES` にエントリを追加し、`src/commands/miruten-say.ts` に `image` という文字列選択肢オプション(`addStringOption` + `addChoices`)を追加、
  `getImageById(選ばれたid)` を呼ぶように変更するだけで対応できます。
- 吹き出しテキスト生成ロジック(`src/utils/bubble.ts` の `buildBubbleText` / `getDisplayWidth`)はDiscord非依存の純粋関数として切り出してあるため、
  別の新しいコマンドからもそのままimportして再利用できます。
- コマンドを追加する場合は `src/commands/` に新しいファイルを1つ追加するだけです(下記「コマンドファイルの形式」を参照)。

## コマンドファイルの形式

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

## 罫線幅の計算ロジックについて

- 表示幅は全角(Unicode East Asian Width の Wide/Fullwidth 相当)を2、それ以外を1、結合文字・異体字セレクタを0として計算します。
- 上部罫線の `━` 本数は、メッセージの表示幅(複数行の場合は最大値)から2を引いた値(最低1本)としています。
- 下部罫線の `ｖ` は先頭から6本目の `━` の位置に固定し、罫線幅がそれより短い極端なケースでは収まる範囲に丸めます。
- この計算式は、仕様に示された例文 `知識って、財産だよね‼️` から実際の罫線幅を逆算し、一致するように検証済みです。

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
Dockerfile              マルチステージビルド(ビルド用/実行用)
docker-compose.yml      常時起動用のcompose設定
.dockerignore           イメージに含めないファイル(node_modules, .env, dist等)
```
