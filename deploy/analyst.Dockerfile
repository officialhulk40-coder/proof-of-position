# The analyst: the Agent Studio app (its own pnpm workspace) linked to @pop/core, run with tsx.
# The keystore and WALLET_PASSWORD are mounted at runtime from agents/popanalyst/.studio, never baked in
# (.dockerignore excludes every .studio directory from the build context).
FROM node:22-bookworm-slim
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --dir agents/popanalyst/app/agent install --frozen-lockfile
EXPOSE 9000
CMD ["pnpm", "--dir", "agents/popanalyst/app/agent", "start"]
