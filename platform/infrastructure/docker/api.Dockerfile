# syntax=docker/dockerfile:1
# Boikonika API (NestJS). Build from platform/:  docker build -f infrastructure/docker/api.Dockerfile -t boikonika-api .
# The same image runs migrations and seeds:      node /app/database/dist/migrate.js | node /app/database/dist/seed/index.js
# Pin a digest or point at a registry mirror with --build-arg NODE_IMAGE=…
ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /app

FROM base AS build
# Every workspace manifest is copied so the lockfile matches; only the API's dependencies are installed.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY shared/package.json shared/
COPY database/package.json database/
COPY backend/package.json backend/
COPY web/package.json web/
COPY mobile/package.json mobile/
COPY tests/package.json tests/
RUN pnpm install --frozen-lockfile --filter @boikonika/backend... --filter @boikonika/database...
COPY shared shared
COPY database database
COPY backend backend
RUN pnpm --filter @boikonika/shared build && pnpm --filter @boikonika/database build && pnpm --filter @boikonika/backend build
# Self-contained folders with production dependencies only; the workspace packages are copied in.
RUN pnpm --filter @boikonika/backend deploy --legacy --prod /out/backend \
 && pnpm --filter @boikonika/database deploy --legacy --prod /out/database

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production PORT=4000
WORKDIR /app
RUN groupadd --system boikonika && useradd --system --gid boikonika --home-dir /app boikonika \
 && mkdir -p /app/storage && chown boikonika:boikonika /app /app/storage
COPY --from=build --chown=boikonika:boikonika /out/backend ./backend
COPY --from=build --chown=boikonika:boikonika /out/database ./database
USER boikonika
WORKDIR /app/backend
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/src/main.js"]
