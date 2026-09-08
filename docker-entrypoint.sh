#!/bin/sh
set -e
echo "[stibo-hub] entrypoint starting…"

PRISMA_CLI="./node_modules/.bin/prisma"
if [ ! -x "$PRISMA_CLI" ]; then
  PRISMA_CLI="node node_modules/prisma/build/index.js"
fi

if [ -n "$DATABASE_URL" ]; then
  echo "[stibo-hub] syncing database schema (prisma db push)…"
  $PRISMA_CLI db push --schema prisma/schema.prisma --accept-data-loss --skip-generate \
    || npx --no-install prisma db push --schema prisma/schema.prisma --accept-data-loss --skip-generate
  if [ "$SEED_ON_START" != "0" ]; then
    echo "[stibo-hub] seeding reference data (idempotent)…"
    node prisma/seed.bundle.cjs 2>/dev/null || node prisma/seed.bundle.mjs || echo "[stibo-hub] seed skipped"
  fi
fi

echo "[stibo-hub] starting server on :${PORT:-3000}"
exec node server.js
