# ---- Build stage: TypeScriptをコンパイルする ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json vitest.config.ts eslint.config.mjs .prettierrc.json .prettierignore ./
COPY src ./src
RUN npm run typecheck && npm run lint && npm run format:check && npm test && npm run build

# ---- Runtime stage: 本番依存関係とビルド成果物のみを含む ----
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY assets ./assets

EXPOSE 8080

CMD ["node", "dist/index.js"]
