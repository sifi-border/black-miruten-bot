# ---- Build stage: TypeScriptをコンパイルする ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json vitest.config.ts eslint.config.mjs .prettierrc.json .prettierignore ./
COPY src ./src
RUN npm run typecheck && npm run lint && npm run format:check && npm test && npm run build

# ---- Runtime stage: 本番依存関係とビルド成果物のみを含む ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# @discordjs/voiceがIPv6優先の名前解決でDiscordのボイスサーバーに接続できずタイムアウトする
# 既知の問題への対策(コンテナ環境でよく発生する)。IPv4を優先させる。
ENV NODE_OPTIONS=--dns-result-order=ipv4first

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# yt-dlpはスタンドアロンバイナリ(PyInstaller onefile)ではなくvenv経由でインストールする。
# onefileバイナリは起動のたびに同梱Pythonランタイムを一時ディレクトリへ自己展開するオーバー
# ヘッドがあり(本番で最初のデバッグ出力まで約9-10秒、ネットワークI/O開始前の純粋な起動コスト)、
# これが解消対象。詳細はCLAUDE.md参照。build-essential等のネイティブビルドツールチェーンは
# 不要(yt-dlp[default]の依存はすべてprebuilt wheelで揃う)。
# venv作成・インストールはuv(高速なRust製パッケージマネージャ)を使う。uvはensurepip不要で
# venvを作成できるため、python3-venv/python3-pipのapt依存が省ける(pipより高速でもある)。
COPY --from=ghcr.io/astral-sh/uv:0.12.1 /uv /uvx /bin/
ARG YTDLP_VERSION=2026.07.04
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 && \
    rm -rf /var/lib/apt/lists/* && \
    uv venv /opt/yt-dlp-venv && \
    VIRTUAL_ENV=/opt/yt-dlp-venv uv pip install --no-cache "yt-dlp[default]==${YTDLP_VERSION}" && \
    ln -s /opt/yt-dlp-venv/bin/yt-dlp /usr/local/bin/yt-dlp

COPY --from=builder /app/dist ./dist
COPY assets ./assets

EXPOSE 8080

CMD ["node", "dist/index.js"]
