#!/bin/sh
set -e
echo "[stibo-hub] entrypoint starting…"

if [ -n "$DATABASE_URL" ]; then
  echo "[stibo-hub] syncing database schema (prisma db push)…"
  npx prisma db push --schema prisma/schema.prisma --accept-data-loss --skip-generate
  if [ "$SEED_ON_START" != "0" ]; then
    echo "[stibo-hub] seeding reference data (idempotent)…"
    node prisma/seed.bundle.cjs || echo "[stibo-hub] seed skipped: $?"
  fi
fi

echo "[stibo-hub] starting server on :${PORT:-3000}"
exec node server.js
