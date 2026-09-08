# STIBO Hub — MAP Master Data Integration Portal

Portal interaktif untuk tim Master Data CoE **PT. MAP Aktif Adiperkasa Tbk (0888)**:
upload file brand → validasi naming convention → auto-mapping ke atribut Stibo STEP →
preview STEPXML → konfirmasi → kirim ke Stibo IIEP endpoint.

> Semua resource AWS diberi prefix / tag **`stibo`** agar mudah dipisahkan dari resource lain.

## Fitur

| Menu | Fungsi |
|---|---|
| **Assistant** | Chat-style flow ala ChatGPT: upload Excel/CSV, deteksi otomatis brand/season/flow dari nama file, wizard Country/SBU/Brand/Season/Endpoint, preview hasil mapping (statistik + coverage + issues), preview STEPXML, konfirmasi 2-fase, kirim ke Stibo (MOCK/LIVE) |
| **Dashboard** | KPI pipeline, uploads per brand, endpoint stats, activity feed |
| **Uploads** | Riwayat transformasi + status pengiriman + bgId receipts |
| **Data Master** | CRUD Brands (30), Attributes MDD (167), LOV Tables (47 / 3.8k values), Mapping Rules (5.925 — diekstrak dari *Brand Mapping Template*) |
| **User Management** | Role ADMIN / EDITOR / VIEWER, activate/deactivate |
| **Audit Log** | Jejak login, upload, transform, send |
| **Settings** | Mode MOCK/LIVE, status endpoint IIEP & OIDC |

## Data asli yang dipakai engine

- **Brand mapping files Template.xlsx** → 5.925 mapping rules (29 brand sheet), tipe rule dinormalisasi:
  `SYSTEM_FORMULA`, `DIRECT`, `MANUAL(_PORTAL)`, `AI_ASSIST`, `MAPPING`, `NOT_AVAILABLE`, `EXTERNAL_SOURCE`
- **Source Mapping related RNA** (2.364 baris) → lookup BrandGroup/BrandType/BrandCategory by compCode+SBU+brand
- **Master Data Dictionary (MAA).xlsx** → atribut inti + 47 LOV (Country, Season, Brand, Size Code, Color, dst.)
- **Brand Input files & Naming convention.xlsx** → routing tipe file → endpoint IIEP

## Tech stack

Next.js 16 (App Router, standalone) · TypeScript · Tailwind 4 + shadcn/ui · Prisma (SQLite dev / PostgreSQL prod) · SheetJS · zero-dep auth (scrypt + HMAC cookie)

## Menjalankan lokal (dev)

```bash
bun install
bun run db:push        # sqlite
bun prisma/seed.ts     # seed data (or: node prisma/seed.mjs)
bun run dev            # http://localhost:3000
```

Login demo: `admin@map.co.id / Stibo@2026` (ADMIN) — `md.coe@map.co.id` (EDITOR) — `viewer@map.co.id` (VIEWER).

## Deploy ke AWS

Lihat **[docs/DEPLOYMENT_AWS.md](docs/DEPLOYMENT_AWS.md)** — EC2 + Docker Compose (semua resource bernama `stibo-*`, tag `project=stibo`), plus catat upgrade path ke ECS Fargate + RDS.

## Struktur

```
prisma/            schema + seed + seed-data (hasil ekstraksi Excel)
src/lib/           auth, naming parser, mapping engine, STEPXML builder, Stibo client
src/app/api/       REST API (auth, brands, attributes, lov, rules, uploads, transform, send, dashboard, audit, settings)
src/components/hub UI (sidebar, topbar, login, 7 views)
Dockerfile         production image (Next standalone + Prisma/Postgres)
docker-compose.aws.yml  stack all-in-one stibo-hub-web + stibo-hub-pg
```
