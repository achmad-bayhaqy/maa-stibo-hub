# ── STIBO Hub — production image (Next.js 16 standalone + Prisma/Postgres) ──
FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN npm install -g bun@1

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
# switch Prisma datasource to PostgreSQL for the container build
RUN sed 's/provider = "sqlite"/provider = "postgres"/' prisma/schema.prisma > prisma/schema.aws.prisma \
 && npx prisma generate --schema prisma/schema.aws.prisma
# compile seed for plain-node runtime
RUN bun build prisma/seed.mjs --target=node --outfile=prisma/seed.bundle.cjs
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# ── runner ──
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# prisma CLI + generated postgres client for db push / seed at start-up
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma/schema.aws.prisma ./prisma/schema.prisma
COPY --from=builder /app/prisma/seed-data ./prisma/seed-data
COPY --from=builder /app/prisma/seed.bundle.cjs ./prisma/seed.bundle.cjs
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
