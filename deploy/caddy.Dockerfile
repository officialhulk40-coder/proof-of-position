# Builds the static feed with Vite, then serves it with Caddy (which also routes /api and /agent).
FROM node:22-bookworm-slim AS web
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
ARG VITE_REGISTRY_ADDRESS
ARG VITE_RPC_URLS=""
ENV VITE_REGISTRY_ADDRESS=$VITE_REGISTRY_ADDRESS VITE_RPC_URLS=$VITE_RPC_URLS VITE_API_BASE=""
RUN pnpm --filter @pop/web run build

FROM caddy:2
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=web /app/apps/web/dist /srv/web
