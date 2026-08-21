FROM oven/bun:1.3-slim AS base
WORKDIR /repo

COPY package.json bun.lock ./
COPY apps/github-app/package.json apps/github-app/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/config/package.json packages/config/package.json

RUN bun install --frozen-lockfile

COPY apps/worker apps/worker
COPY packages/db packages/db
COPY packages/shared-types packages/shared-types

WORKDIR /repo/apps/worker
ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "run", "src/serve.ts"]