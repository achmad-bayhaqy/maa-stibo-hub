/**
 * Seed script (plain JS — runs under node & bun).
 * Loads extracted Excel data into the database. Idempotent where possible.
 * Run: node prisma/seed.mjs   (or bun prisma/seed.mjs)
 */
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOCS } from "./seed-data/docs.mjs";

const prisma = new PrismaClient();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SD = path.join(HERE, "seed-data");

const load = (name) => JSON.parse(fs.readFileSync(path.join(SD, name), "utf-8"));

const hashPassword = (pw) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
};

const SHEET_MAP = {
  "adidas-api": "ADI", adidas: "ADI",
  lotto: "LOT", "sample lotto - inline": "LOT", "lotto inline (new format": "LOT",
  "2xu": "2XU", "sample - 2xu": "2XU",
  crocs: "CCR",
  nike: "NIK", "nik 360": "NIK",
  onr: "ONR",
  diadora: "DIA",
  svm: "SVM",
  pazzion: "PZZ",
  staccato: "SC7",
  "dr.martens": "DRM",
  birken: "BCK",
  clarks: "CKS",
  kswiss: "KSW",
  ellesse: "ELL",
  airwalk: "AIW",
  astec: "ASC",
  camper: "C4M",
  reebok: "REE",
  onitsuka: "ONT",
  "new era": "NRA",
  asics: "ASI",
  ptp: "PTP",
  implus: "IPL",
  vivaia: "VVA",
  "new balance": "NEW", "new balance linelist": "NEW", "new balance sample": "NEW",
  anta: "ATA",
  smiggle: "IGL",
  aldo: "AOD",
  sheet1: "GLOBAL",
  template: "GLOBAL",
};

function resolveBrandCode(sheet) {
  const key = sheet.toLowerCase().trim();
  if (SHEET_MAP[key]) return SHEET_MAP[key];
  for (const k of Object.keys(SHEET_MAP)) if (key.includes(k)) return SHEET_MAP[k];
  return "";
}

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function main() {
  console.log("Seeding…");
  const t0 = Date.now();

  for (const u of [
    { email: "admin@map.co.id", name: "Admin COE", role: "ADMIN", pw: "Stibo@2026" },
    { email: "md.coe@map.co.id", name: "MD CoE Analyst", role: "EDITOR", pw: "Stibo@2026" },
    { email: "viewer@map.co.id", name: "Brand Viewer", role: "VIEWER", pw: "Stibo@2026" },
  ]) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash: hashPassword(u.pw), role: u.role, active: true },
      create: { email: u.email, name: u.name, role: u.role, passwordHash: hashPassword(u.pw) },
    });
  }
  console.log("  users: 3");

  for (const s of [
    { key: "sendMode", value: "MOCK" },
    { key: "stiboEndpoints", value: JSON.stringify({
        ARTICLE_PLANNING: process.env.STIBO_INBOUND_URL_ARTICLE_PLANNING ?? "",
        EAN_UPDATE: process.env.STIBO_INBOUND_URL_EAN_UPDATE ?? "",
        ARTICLE_MAINTENANCE: process.env.STIBO_INBOUND_URL_ARTICLE_MAINTENANCE ?? "",
      }) },
    { key: "oidcConfigured", value: process.env.STIBO_CLIENT_ID ? "yes" : "no" },
  ]) {
    await prisma.setting.upsert({ where: { key: s.key }, update: { value: s.value }, create: s });
  }

  const brandCount = await prisma.brand.count();
  if (brandCount === 0) {
    const brands = load("brands_curated.json");
    for (const b of brands) {
      await prisma.brand.upsert({
        where: { code: b.code },
        update: { name: b.name, division: b.division, status: b.status, fileTypes: JSON.stringify(b.fileTypes ?? []) },
        create: { code: b.code, name: b.name, division: b.division ?? "SPORTS", status: b.status ?? "ACTIVE", fileTypes: JSON.stringify(b.fileTypes ?? []) },
      });
    }
    console.log("  brands:", brands.length);
  } else console.log("  brands: already seeded", brandCount);

  if ((await prisma.attribute.count()) === 0) {
    for (const c of chunk(load("attributes.json"), 200)) await prisma.attribute.createMany({ data: c });
    console.log("  attributes:", await prisma.attribute.count());
  }

  if ((await prisma.lovValue.count()) === 0) {
    const lovs = load("lov.json");
    for (const l of lovs) {
      await prisma.lovTable.upsert({ where: { key: l.key }, update: { sheetName: l.sheetName }, create: { key: l.key, sheetName: l.sheetName } });
      for (const c of chunk(l.values, 500)) await prisma.lovValue.createMany({ data: c.map((v) => ({ tableKey: l.key, code: v.code, label: v.label })) });
    }
    console.log("  lov tables:", lovs.length);
  }

  if ((await prisma.mappingRule.count()) === 0) {
    const rules = load("rules.json");
    for (const c of chunk(rules, 400)) {
      await prisma.mappingRule.createMany({
        data: c.map((r) => ({
          brandSheet: r.brandSheet, brandCode: resolveBrandCode(r.brandSheet),
          attribute: r.attribute, attributeId: r.attributeId, validation: r.validation,
          cluster: r.cluster, description: r.description, mappingType: r.mappingType,
          mappingTypeRaw: r.mappingTypeRaw, sourceField: r.sourceField, logic: r.logic, active: true,
        })),
      });
    }
    console.log("  mapping rules:", rules.length);
  }

  if ((await prisma.rnaLookup.count()) === 0) {
    for (const c of chunk(load("rna.json"), 400)) await prisma.rnaLookup.createMany({ data: c });
    console.log("  rna:", await prisma.rnaLookup.count());
  }

  if ((await prisma.namingRoute.count()) === 0) {
    for (const c of chunk(load("naming.json"), 200)) await prisma.namingRoute.createMany({ data: c });
    console.log("  naming routes:", await prisma.namingRoute.count());
  }

  for (const d of DOCS) {
    await prisma.docPage.upsert({
      where: { slug: d.slug },
      update: { title: d.title, category: d.category, order: d.order, summary: d.summary, body: d.body },
      create: { ...d },
    });
  }
  console.log("  doc pages:", DOCS.length);

  console.log(`Seed done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
