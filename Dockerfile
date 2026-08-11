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

# yt-dlpの公式スタンドアロンLinuxバイナリ(Python不要)を取得する。バージョンは固定し、
# 定期的に手動更新する(CLAUDE.md参照)。ADDのURLはビルド時ではなく初回フェッチ時にのみ
# キャッシュされるため、"latest"ではなくタグを固定しないと更新が反映されない。
ARG YTDLP_VERSION=2026.07.04
ADD https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp_linux /usr/local/bin/yt-dlp
RUN chmod +x /usr/local/bin/yt-dlp

COPY --from=builder /app/dist ./dist
COPY assets ./assets

EXPOSE 8080

CMD ["node", "dist/index.js"]
