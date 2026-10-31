# syntax=docker/dockerfile:1
# Boikonika website (Next.js standalone). Build from platform/:
#   docker build -f infrastructure/docker/web.Dockerfile \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://boikonika.com --build-arg NEXT_PUBLIC_API_URL=https://boikonika.com \
#     --build-arg API_INTERNAL_URL=http://api:4000 -t boikonika-web .
# NEXT_PUBLIC_* values are compiled into the browser bundle, so each environment needs its own build.
# Pin a digest or point at a registry mirror with --build-arg NODE_IMAGE=…
ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY shared/package.json shared/
COPY database/package.json database/
COPY backend/package.json backend/
COPY web/package.json web/
COPY mobile/package.json mobile/
COPY tests/package.json tests/
RUN pnpm install --frozen-lockfile --filter @boikonika/web...
COPY shared shared
COPY web web
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ARG NEXT_PUBLIC_ASSETS_URL=
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ARG API_INTERNAL_URL=http://api:4000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_PUBLIC_ASSETS_URL=$NEXT_PUBLIC_ASSETS_URL \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID API_INTERNAL_URL=$API_INTERNAL_URL
RUN pnpm --filter @boikonika/shared build && pnpm --filter @boikonika/web build

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN groupadd --system boikonika && useradd --system --gid boikonika --home-dir /app boikonika
COPY --from=build --chown=boikonika:boikonika /app/web/.next/standalone ./
COPY --from=build --chown=boikonika:boikonika /app/web/.next/static ./web/.next/static
COPY --from=build --chown=boikonika:boikonika /app/web/public ./web/public
USER boikonika
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/robots.txt').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "web/server.js"]
