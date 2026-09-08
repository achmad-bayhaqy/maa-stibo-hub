/**
 * Documentation pages seed — STIBO Hub v2.0 Documentation Center.
 * Markdown-ish body: headings (#, ##, ###), lists, pipe tables, ``` code blocks, **bold**, `inline`.
 * Language: English.
 */
export const DOCS = [
  {
    slug: "getting-started", title: "Getting Started Guide", category: "Guide", order: 10,
    summary: "Quick orientation: roles, the core workflow, and your first transformation.",
    body: `# Getting Started Guide

STIBO Hub is a master data integration portal connecting the brands of PT. MAP Aktif Adiperkasa Tbk (0888) with the **Stibo STEP** MDM platform. It standardizes what was previously a manual process: preparing per-brand article data files, mapping columns to Stibo attributes, validating, and then sending to the correct IIEP endpoint.

## Core workflow

1. **Upload** — upload an Excel file (.xlsx/.xls/.csv) with a file name that follows the file naming convention. The system automatically detects brand, flow, gender, season, country, and the destination endpoint.
2. **Metadata wizard** — complete/confirm Country, SBU, Brand, Season. The system validates that combination against the RNA table (Brand Reporting Structure).
3. **Transform** — the mapping engine applies 5,900+ mapping rules (10 types) to every row. You see a per-column preview of the transformation result: source value, resulting value, mapping type, and warnings.
4. **Confirm & send** — the STEPXML is built according to the PIM.xsd schema. Two-step send (2-phase confirm): MOCK (simulation) or LIVE (POST to the Stibo IIEP).

## User roles

| Role | Permissions |
| --- | --- |
| **ADMIN** | Full access + user management + master data deletion + data import |
| **EDITOR** | Master data CRUD, upload, transform, send |
| **VIEWER** | Read-only: dashboard, upload history, documentation, master data |

## Your first transformation

1. Open the **Assistant** menu → **Pipeline** tab (or click the *New Transformation* button in the top right).
2. Drag & drop your Excel file. Make sure the file name follows the [File Naming Convention](/doc/file-naming-convention).
3. Complete the metadata wizard that appears.
4. Review the transformation result — green columns mean auto-mapped, orange means attention needed (MANUAL/AI_ASSIST), red means error.
5. Click **Send to Stibo** and confirm in the two-phase dialog.

> **Tip**: Use the **Command Palette** (⌘K / Ctrl+K) to jump to any page or to search brands, attributes, and LOVs without manual navigation.`,
  },
  {
    slug: "assistant-guide", title: "Assistant Guide (Q&A)", category: "Guide", order: 20,
    summary: "How to ask the Assistant: recognized intents, example questions, and its limitations.",
    body: `# Assistant Guide

The Assistant has two modes, selectable at the top of the page:

- **Pipeline** — a guided mode for upload → map → preview → send (the main workflow).
- **Q&A** — a free-form conversational mode: ask anything about master data, mapping rules, the file naming convention, pipeline status, and documentation.

## What you can ask in Q&A mode

| Topic | Example questions |
| --- | --- |
| **Brand** | "which brands are in the SPORTS division?", "details for brand ELL" |
| **Attribute** | "which AT_ attributes are required?", "find attribute color" |
| **Mapping rules** | "mapping rule for adidas on AT_BRAND?", "how many rules are of type MANUAL?" |
| **LOV** | "LOV values for season", "find LOV size grid" |
| **Naming** | "what is the file name format?", "endpoint for ELL recap sample?" |
| **RNA** | "SBU for brand lotto in Indonesia?", "comp code 0888" |
| **Pipeline status** | "what are my latest uploads?", "how many sends today?" |
| **Documentation** | "explain the SYSTEM_FORMULA mapping type", "what is IIEP?" |
| **Statistics** | "how many brands in total?", "dashboard summary" |

## How the Q&A engine works

1. Your question is classified into an **intent** (brand, attribute, lov, rule, naming, rna, upload, stats, docs, help).
2. The engine runs a **live query against the master data database** — answers always reflect the latest data, not static text.
3. Results are shown as **data cards** (tables/badges) together with the **source of information** and follow-up links.
4. The entire conversation is stored per user and can be deleted at any time.

## Limitations

- The Q&A engine is **deterministic** — it reads internal data, not the internet. Questions outside the system's scope are redirected to the available topics.
- For data changes, use the **Data Master** pages (requires the EDITOR/ADMIN role); the Assistant is read-only.
- Chat history is per user and is not visible to other users.`,
  },
  {
    slug: "file-naming-convention", title: "File Naming Convention", category: "Reference", order: 30,
    summary: "The mandatory file name format, a decoder for each segment, and the routing table of 88 naming routes.",
    body: `# File Naming Convention

The file name is the **first contract** between you and the transformation engine. From the file name alone the system determines: brand, data type (flow), season, country, and the destination IIEP endpoint.

## Format

\`\`\`
{COMP}-{FLOW}-{GENDER}-{SEASON}-{COUNTRY}-{SEQ}.xlsx
\`\`\`

## Segment decoder

| Segment | Meaning | Example | Notes |
| --- | --- | --- | --- |
| COMP | Company code | 0888 | MAP Aktif Adiperkasa company code |
| FLOW | Data type | RecapSample, EAN, ... | Determines the IIEP endpoint |
| GENDER | Line gender | M, W, K, U | Men / Women / Kids / Unisex |
| SEASON | Season code | AU26, SP27 | Autumn 2026, Spring 2027 |
| COUNTRY | Country code | ID | Indonesia |
| SEQ | Sequence number | 001 | Zero-padded |

## Valid examples

\`\`\`
0888-RecapSample-M-AU26-ID-001.xlsx   → ARTICLE_PLANNING
0888-EAN-U-SP27-ID-003.xlsx           → EAN_UPDATE
\`\`\`

## Endpoint routing

The system maintains **88 naming routes** that can be managed in **Data Master → Naming Routes**. A route maps the combination \`(brand, flow, trigger)\` → endpoint:

| Common flows | Endpoint | Purpose |
| --- | --- | --- |
| RecapSample | ARTICLE_PLANNING | Upload of new article plans per season |
| EAN | EAN_UPDATE | Update EAN barcodes for existing articles |
| Maintenance | ARTICLE_MAINTENANCE | Changes to existing article attributes |

## If the file name is invalid

- The wizard will set \`filenameValid = false\` and show issues per segment.
- You can still continue by completing the metadata manually, but the best practice is to fix the file name so that automatic routing stays accurate.
- Get the list of official brand codes from **Data Master → Brands**.`,
  },
  {
    slug: "iiep-endpoints", title: "IIEP Endpoints & Routing", category: "Integration", order: 40,
    summary: "The three inbound Stibo STEP endpoints, how their functions differ, and how the system chooses one.",
    body: `# IIEP Endpoints & Routing

Stibo STEP receives inbound data through **Inbound Integration Endpoints (IIEP)**. The MAP system knows the following three endpoints:

## 1. ARTICLE_PLANNING

- **Purpose**: intake of new articles during the planning phase (pre-season).
- **Typical input**: Recap Sample per brand/gender/season.
- **Characteristics**: the largest volume; core planning attributes (brand, division, category, gender, season, color, size grid).

## 2. EAN_UPDATE

- **Purpose**: updating EAN barcodes for articles that already exist in STEP.
- **Typical input**: EAN files per brand.
- **Characteristics**: delta update; only changes \`AT_EAN\` and barcode-related attributes.

## 3. ARTICLE_MAINTENANCE

- **Purpose**: article maintenance — attribute corrections, status changes, hierarchy adjustments.
- **Characteristics**: limited delta update; usually triggered by requests from the Brand/COE team.

## How the system chooses an endpoint

1. The file name parser extracts the FLOW segment.
2. The routing engine looks for a match in the **Naming Routes** table (brand + flow + trigger).
3. If there is no exact match, the per-flow default is used (RecapSample → ARTICLE_PLANNING, EAN → EAN_UPDATE).
4. The final endpoint is shown in the wizard and you can confirm it before sending.

## URL configuration

Endpoint URLs are stored in Settings (the \`stiboEndpoints\` table) and populated from environment variables at deploy time:

\`\`\`
STIBO_INBOUND_URL_ARTICLE_PLANNING
STIBO_INBOUND_URL_EAN_UPDATE
STIBO_INBOUND_URL_ARTICLE_MAINTENANCE
\`\`\`

In **MOCK** mode, no POST ever leaves the system — a simulated bgId is generated (\`MOCK-XXXX\`) and the response is treated as success. LIVE mode requires configured OIDC credentials.`,
  },
  {
    slug: "mapping-rule-types", title: "Mapping Rule Types", category: "Reference", order: 50,
    summary: "The 10 mapping types (SYSTEM_FORMULA through EXTERNAL_SOURCE), their behavior, and how to handle them.",
    body: `# Mapping Rule Types

The transformation engine maps source columns to Stibo attributes (\`AT_*\`) using **5,900+ rules** extracted from the Brand Mapping Template. Each rule has a type that determines how it is filled:

## List of types

| Type | Behavior | Example |
| --- | --- | --- |
| **SYSTEM_FORMULA** | Filled automatically by a system formula | bgId, timestamp, hash |
| **DIRECT** | Copied directly from the source column | AT_PRODUCT_NAME ← column B |
| **MAPPING** | Transformation via an LOV/lookup table | color name → LOV code |
| **MANUAL_PORTAL** | Must be entered manually in the portal | campaign-specific attributes |
| **MANUAL / MANUAL_DIRECT** | Manual input by operations | brand-specific notes |
| **AI_ASSIST** | AI-suggested, requires human review | ambiguous category classification |
| **EXTERNAL_SOURCE** | From an external system (ERP/RNA) | comp code, SBU |
| **NOT_AVAILABLE** | Not yet available in the brand template | new attributes with no source yet |
| **OTHER** | Special cases outside the classification | — |

## Color interpretation in the preview

- **Green (SYSTEM_FORMULA / DIRECT / MAPPING)** — filled automatically, no action needed.
- **Orange (MANUAL*, AI_ASSIST)** — requires human decision input; the wizard highlights these cells.
- **Gray (NOT_AVAILABLE)** — not mapped; safe to ignore, or follow up by adding a new rule.
- **Red** — a validation error on the value.

## Managing rules

- All rules can be viewed and filtered in **Data Master → Mapping Rules** (filter by brand + type + text search).
- EDITOR/ADMIN can add new rules, change \`mappingType\`, \`sourceField\`, \`logic\`, or deactivate a rule (\`active = false\`) without erasing the audit trail.
- Deactivated rules are skipped by the transformation engine but remain visible with an INACTIVE badge.`,
  },
  {
    slug: "lov-reference-data", title: "LOV & Reference Data", category: "Reference", order: 60,
    summary: "47 LOV tables (3,800+ values), the RNA structure, and the role they play in transformation.",
    body: `# LOV & Reference Data

## List of Values (LOV)

LOVs are controlled value dictionaries used by the **MAPPING** engine to translate free-form values from brand files into standard Stibo codes.

- **47 LOV tables** containing **3,800+ values** (extracted from the MDD workbook).
- Example tables: \`SEASON\`, \`COLOR\`, \`SIZE_GRID\`, \`GENDER\`, \`DIVISION\`, \`PRODUCT_TYPE\`.
- Manage them in **Data Master → LOV Tables**: add/edit/delete tables and values (EDITOR role and above).

### MAPPING transformation example

\`\`\`
Source: "Navy Blue"  →  LOV COLOR  →  "NVY"  →  AT_COLOR_CODE
Source: "AU26"       →  LOV SEASON →  "AU26" →  AT_SEASON
\`\`\`

If a source value is not found in the LOV, the row is flagged with a **warning** and the preview shows suggestions for the nearest values.

## RNA (Brand Reporting Structure)

The RNA table (2,364 rows) is the company's official reporting structure:

| Column | Example | Used for |
| --- | --- | --- |
| country | ID | Wizard Country |
| compCode | 0888 | File name COMP segment |
| sbu / subSbu / sbuGrouping | SPORTS | Wizard SBU |
| brandCode / brandName | ELL / Ellesse | Brand validation |
| reportingBrandCode | ELL-ID | bgId composition |

The wizard validates your **Country + SBU + Brand** combination against RNA. Unknown combinations are rejected with suggestions for the nearest entries — this prevents orphan data from entering STEP.

## Source of truth

Priority order in case of conflict: **1)** the RNA & LOV tables in this system (extracted from the official workbooks), **2)** your manual input, **3)** per-brand rules. Whenever an official workbook is updated, re-run the seed or use Bulk Import to synchronize.`,
  },
  {
    slug: "attributes-mdd", title: "Attributes (MDD Core)", category: "Reference", order: 70,
    summary: "167 AT_* attributes, validation types, and the Stibo attribute naming convention.",
    body: `# Attributes (MDD Core)

The attribute master data is taken from the Stibo **MDD (Master Data Definition)** — the 167 \`AT_*\` attributes that are the final targets of the transformation.

## Naming convention

\`\`\`
AT_PRODUCT_NAME, AT_COLOR_CODE, AT_SEASON, AT_EAN, ...
└┬┘ └────┬─────┘
 prefix   Stibo attribute name
\`\`\`

## Validation types

| Validation | Meaning | Example attributes |
| --- | --- | --- |
| \`text\` | Free text | AT_PRODUCT_NAME |
| \`lov\` | Must be a member of a specific LOV | AT_COLOR_CODE → LOV COLOR |
| \`number\` | Numeric | AT_PRICE |
| \`date\` | Date (ISO) | AT_LAUNCH_DATE |
| \`boolean\` | true/false | AT_IS_ACTIVE |
| \`regex\` | Custom pattern | AT_EAN (13 digits) |

## Viewing & managing

- **Data Master → Attributes**: search by \`AT_*\` code or name, edit name/validation/description (EDITOR and above).
- Adding a new attribute requires a code prefixed with \`AT_\` — the system rejects other codes to keep consistency with the MDD.
- Attributes used by per-brand mapping rules can be traced in the **Mapping Rules** tab (filter by attribute).

> **Note**: The attribute list in the portal must be synchronized whenever the Stibo MDM team changes the official MDD. Use Bulk Import for mass synchronization.`,
  },
  {
    slug: "pipeline-architecture", title: "Pipeline Architecture", category: "Integration", order: 80,
    summary: "From upload in the portal to data arriving in STEP: components, data flow, and control points.",
    body: `# Pipeline Architecture

## Big picture

\`\`\`
[Browser: STIBO Hub]
   │  upload (Excel) + metadata wizard
   ▼
[STIBO Hub API]  ── parse → validate → map → preview
   │  user confirmation (2-phase)
   ▼
[STEPXML builder]  (PIM.xsd compliant)
   │  POST (LIVE) / simulate (MOCK)
   ▼
[Stibo STEP IIEP endpoint]  →  bgId → import queue
\`\`\`

## Components

| Component | Technology | Role |
| --- | --- | --- |
| Web portal | Next.js 16 + Prisma | UI, API, transformation engine |
| Database | SQLite (dev) / PostgreSQL (prod) | Master data, uploads, audit |
| File storage | Local / S3 \`stibo-hub-artifacts-*\` | Upload artifacts |
| STEPXML builder | Server lib (\`stepxml.ts\`) | Serializes mapping results into PIM.xsd XML |
| Stibo connector | OIDC client + REST POST (\`stibo.ts\`) | Authenticates & sends to the IIEP |

## Control points (quality gates)

1. **File name validation** — wrong routing = data sent to the wrong destination.
2. **RNA validation** — the Country/SBU/Brand combination must be known.
3. **Transformation preview** — you see the result per row before sending.
4. **Two-phase confirmation** — an explicit dialog shows the mode, endpoint, row count, and endpoint URL before the POST.
5. **Audit log** — every action (upload/transform/send/master data CRUD) is recorded with actor + time + details.

## Relationship with the legacy (Lambda) pipeline

This portal is the **new** path that complements the already-running pipeline (MAP Portal → S3 → EventBridge → Lambda). The legacy path remains valid for brands that are already onboarded; the new path adds interactive control + a preview before sending.`,
  },
  {
    slug: "stibo-api-integration", title: "Stibo STEP API Integration", category: "Integration", order: 90,
    summary: "OIDC authentication, the IIEP POST format, the bgId structure, and MOCK vs LIVE mode differences.",
    body: `# Stibo STEP API Integration

## Authentication (OIDC)

The portal is an OIDC confidential client of the Stibo identity provider:

\`\`\`
POST /oauth/token
grant_type=client_credentials
client_id=*** (Secrets Manager: stibo/prod/...)
client_secret=***
\`\`\`

- Tokens are cached until they expire (lazy fetch, TTL).
- Credentials are **never** kept in code or the repository — only environment variables / AWS Secrets Manager.

## Sending data (IIEP)

\`\`\`
POST {STIBO_INBOUND_URL_ARTICLE_PLANNING}
Content-Type: multipart/form-data
  file  = <STEPXML>
  bgId  = {reportingBrand}-{flow}-{season}-{seq}
\`\`\`

The STEPXML structure is serialized according to **PIM.xsd**: a single \`Products\` root, attributes per \`Product\` (\`ID\`, \`AT_*\`), with LOV values validated on the portal side before sending.

## MOCK vs LIVE mode

| Aspect | MOCK (default) | LIVE |
| --- | --- | --- |
| Outbound POST | No — simulated | Yes, to the IIEP endpoint |
| bgId | \`MOCK-XXXXXXXX\` | a real bgId |
| Audit | Fully recorded | Fully recorded |
| Requirements | Can run without credentials | OIDC + endpoint URL filled in |

The mode is controlled in **Settings** and shown as a badge in the topbar. Best practice: always test in MOCK first, review the STEPXML preview, then switch to LIVE during a go-live supervised by the MDM team.

## Handling failures

- Non-2xx HTTP → the job is marked FAILED, the response snippet is stored, and a retry button is available in **Uploads**.
- Timeout → increase the connection timeout in Settings and check network/VPC connectivity to STEP.
- All failures go into the **Audit Log** for COE team analysis.`,
  },
  {
    slug: "roles-permissions", title: "Roles & Permissions", category: "Governance", order: 100,
    summary: "The ADMIN/EDITOR/VIEWER matrix per module and the underlying auditing principles.",
    body: `# Roles & Permissions

## Permission matrix

| Module / Action | ADMIN | EDITOR | VIEWER |
| --- | --- | --- | --- |
| Dashboard, Uploads, Docs, Assistant | ✔ | ✔ | ✔ (read) |
| Upload & transform & send | ✔ | ✔ | ✖ |
| Master data: create/edit | ✔ | ✔ | ✖ |
| Master data: delete | ✔ | ✖ | ✖ |
| Bulk import | ✔ | ✔ | ✖ |
| User management | ✔ | ✖ | ✖ |
| Settings (mode, endpoint URL) | ✔ | ✖ | ✖ |
| Audit log | ✔ | ✔ | ✖ |

## Principles

1. **Least privilege** — grant the smallest role that still allows the work. VIEWER for brand teams, EDITOR for COE analysts, ADMIN limited to the COE lead + IT.
2. **Auditability** — every state change (master data CRUD, import, send) writes an AuditLog with actor, action, target, and JSON details (old value → new value for edits).
3. **Two-phase send** — sending to Stibo always goes through the two-phase confirmation dialog, regardless of role.
4. **Shared accounts are forbidden** — one account per person; deactivated accounts cannot log in even if a token still exists.

## Managing users

- **User Management** (ADMIN): add accounts, change roles, deactivate accounts.
- Passwords are stored as scrypt hashes (per-user salt).
- HMAC cookie sessions last 12 hours; logout clears the cookie.`,
  },
  {
    slug: "bulk-import-guide", title: "Bulk Import Guide", category: "Guide", order: 110,
    summary: "CSV formats per entity, the preview → apply flow, and row-level error handling.",
    body: `# Bulk Import Guide

Bulk Import allows master data to be updated in bulk (e.g. synchronizing the results of a revised official workbook) without editing records one by one.

## Two-phase flow

1. **PREVIEW** — the file is parsed and every row is validated (required columns, duplicates, references). You see a summary: *Total / Valid / Failed* plus per-row error details. Nothing is written yet.
2. **APPLY** — runs only once you approve the summary. Valid rows are written; failed rows are skipped and reported.

## CSV format per entity

**Brands** (\`code,name,division,status\`):
\`\`\`csv
ELL,Ellesse,SPORTS,ACTIVE
NIK,Nike,SPORTS,ACTIVE
\`\`\`

**Attributes** (\`code,name,validation,description\`) — codes must be prefixed with \`AT_\`:
\`\`\`csv
AT_TEST_COLOR,Test Color,lov,Test attribute for color
\`\`\`

**Mapping Rules** (\`brandSheet,attributeId,attribute,mappingType,sourceField,logic\`):
\`\`\`csv
adidas,AT_BRAND,Brand,DIRECT,colBrand,
\`\`\`

**LOV Values** (\`tableKey,code,label\`):
\`\`\`csv
SEASON,SS27,Spring 2027
\`\`\`

## Important rules

- **Duplicate rows** (e.g. the brand code already exists) are updated when the *upsert* flag is active; otherwise they are rejected.
- **References must exist**: the LOV \`tableKey\` must refer to an available table; the rule \`attributeId\` should refer to a registered attribute.
- Every apply is recorded in the **Audit Log** with the inserted/updated/failed counts per entity.
- Download the CSV template using the **Download template** button in the import dialog.`,
  },
  {
    slug: "faq", title: "FAQ", category: "Guide", order: 120,
    summary: "Frequently asked questions about upload, transformation, and sending.",
    body: `# FAQ

**My upload fails to parse — what are the common causes?**
Make sure the .xlsx/.xls/.csv file has no protected sheets and has column headers in the first row. The system picks the best sheet automatically; if the workbook has many empty sheets, remove the non-data sheets.

**Why are many columns of type MANUAL?**
Some brand templates deliberately mark attributes as manual input ("Manual Input in Portal"). Fill in the orange cells in the wizard; the values you enter are carried into the STEPXML.

**Can I change the mapping result before sending?**
Yes — the transformation preview allows per-cell overrides (click the value). Overrides are recorded in the audit log.

**What is the difference between MOCK and LIVE?**
MOCK simulates the send (bgId \`MOCK-*\`, no outbound traffic). LIVE performs a real POST to the Stibo IIEP. The mode badge is always visible in the topbar.

**I sent to LIVE by mistake — what should I do?**
Contact the Stibo MDM team to withdraw the batch via its bgId (recorded in the Audit Log), then fix the data and resend. Best practice: always test in MOCK first for new files/brands.

**Why is my Country/SBU/Brand combination rejected?**
The wizard validates against the RNA table. Make sure the combination exists in **Data Master → RNA**; if the organizational structure changes, ask the COE to update RNA via Bulk Import.

**Who can delete master data?**
ADMIN only. Editors can add/edit but not delete — this keeps the audit trail secure.

**How do I add a new brand to the pipeline?**
1) Add the brand in Data Master → Brands; 2) make sure its RNA entry exists; 3) add a Naming Route if the flow is specific; 4) upload a sample file and test in MOCK.`,
  },
  {
    slug: "glossary", title: "Glossary", category: "Reference", order: 130,
    summary: "Stibo, master data, and MAP-internal terms used throughout the portal.",
    body: `# Glossary

| Term | Meaning |
| --- | --- |
| **Stibo STEP** | The MDM platform (Product Master Data Management) that is the final destination of all article data |
| **IIEP** | Inbound Integration Endpoint — the entry point for data into STEP |
| **STEPXML** | The standard Stibo XML format (PIM.xsd) for data imports |
| **bgId** | Background Process ID — the batch import identifier in STEP |
| **MDD** | Master Data Definition — the official attribute definitions in STEP |
| **AT_* ** | Stibo attribute prefix (e.g. AT_COLOR_CODE) |
| **LOV** | List of Values — a controlled value dictionary |
| **RNA** | Brand Reporting Structure — the company/SBU/brand reference table |
| **SBU** | Strategic Business Unit — a business group (e.g. SPORTS) |
| **compCode** | Company code (0888 = MAP Aktif Adiperkasa Tbk) |
| **Recap Sample** | The per-season product sample recap data flow |
| **EAN** | European Article Number — a 13-digit barcode |
| **MOCK mode** | Simulated send mode (no traffic to STEP) |
| **LIVE mode** | Real send mode to the STEP IIEP |
| **Mapping rule** | A rule mapping a source column → a Stibo attribute |
| **Direct mapping** | A direct copy without transformation |
| **2-phase confirm** | A two-step confirmation before destructive actions (send) |
| **COE** | Center of Excellence — the team that owns the master data process |
| **Season code** | Season code (AU26 = Autumn 2026, SP27 = Spring 2027) |
| **Naming route** | A routing rule (brand+flow) → IIEP endpoint |`,
  },
  {
    slug: "changelog", title: "Changelog", category: "Governance", order: 140,
    summary: "Release history of the STIBO Hub portal.",
    body: `# Changelog

## v2.0 — Feature release based on the maa-btool review

**Documentation Center**
- 14 structured documentation pages (Guide / Reference / Integration / Governance) with full-text search and a content editor for ADMIN/EDITOR.

**Assistant v2**
- **Q&A mode**: ask anything about master data, rules, LOVs, naming, RNA, pipeline status, and documentation — answers based on real-time database queries with data cards + sources.
- Conversation history stored per user; suggested prompts; delete history.

**Data Master — full CRUD**
- Attributes: create/edit/delete (+ description).
- LOV: table + value CRUD.
- Mapping Rules: create/edit/deactivate/delete.
- **New tabs**: Naming Routes (88 routes, CRUD) and RNA (2,364 rows, CRUD).
- CSV export for all tables; Bulk Import (preview → apply) for brands/attributes/rules/LOV values.

**Platform**
- Command Palette (⌘K) in the style of maa-btool: navigation, cross-entity search, quick actions.
- Sidebar navigation grouped by section.
- Onboarding checklist on the Dashboard.

## v1.0 — Initial release

- SPA shell: Assistant (pipeline wizard), Dashboard, Uploads, Data Master (read-mostly), Users, Audit, Settings.
- Transformation engine with 5,925 rules (29 brand sheets), 47 LOV tables, 2,364 RNA rows, 88 naming routes.
- File name parser + IIEP routing; PIM.xsd STEPXML builder; MOCK/LIVE send with two-phase confirmation.
- Seeded from the official workbooks: brands, attributes, LOVs, rules, RNA, naming.
- Deployed on AWS EC2 (docker compose) — all resources prefixed/tagged \`stibo\`.`,
  },
];
