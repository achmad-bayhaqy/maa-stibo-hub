# ── STIBO Hub — production image (Next.js 16 standalone + Prisma/Postgres) ──
FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g bun@1

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
# switch Prisma datasource to PostgreSQL for the container build
RUN sed 's/provider = "sqlite"/provider = "postgres"/' prisma/schema.prisma > prisma/schema.aws.prisma \
 && npx prisma generate --schema prisma/schema.aws.prisma
# compile seed for plain-node runtime (keep prisma client external — engine lives in node_modules)
RUN bun build prisma/seed.mjs --target=node --format=cjs --external @prisma/client --external prisma --outfile=prisma/seed.bundle.cjs \
 || bun build prisma/seed.mjs --target=node --external @prisma/client --external prisma --outfile=prisma/seed.bundle.mjs
RUN if [ ! -f prisma/seed.bundle.cjs ]; then mv prisma/seed.bundle.mjs prisma/seed.bundle.cjs; fi
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# ── runner ──
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# run as the unprivileged `node` user (files writable: .next/cache only)
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
# full node_modules (standalone's own modules get merged) — prisma CLI needs its runtime deps (effect, etc.)
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/prisma/schema.aws.prisma ./prisma/schema.prisma
COPY --from=builder --chown=node:node /app/prisma/seed-data ./prisma/seed-data
COPY --from=builder --chown=node:node /app/prisma/seed.bundle.cjs ./prisma/seed.bundle.cjs
COPY --chown=node:node docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER node
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
