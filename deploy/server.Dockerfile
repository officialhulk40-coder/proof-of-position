# The API server and the recordExit keeper: @pop/server on Node, run from TypeScript source with tsx.
FROM node:22-bookworm-slim
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
ENV PORT=8787
EXPOSE 8787
CMD ["pnpm", "--filter", "@pop/server", "start"]
