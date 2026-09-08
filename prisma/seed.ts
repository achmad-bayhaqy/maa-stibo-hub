/**
 * Seed script — loads extracted Excel data into SQLite.
 * Run: bun prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes, scryptSync } from "crypto";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
const SD = path.join(__dirname, "seed-data");

function load(name: string): any {
  return JSON.parse(fs.readFileSync(path.join(SD, name), "utf-8"));
}

function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// brand sheet → brand code resolution
const SHEET_MAP: Record<string, string> = {
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

function resolveBrandCode(sheet: string): string {
  const key = sheet.toLowerCase().trim();
  if (SHEET_MAP[key]) return SHEET_MAP[key];
  for (const k of Object.keys(SHEET_MAP)) {
    if (key.includes(k)) return SHEET_MAP[k];
  }
  return "";
}

async function main() {
  console.log("Seeding…");
  const t0 = Date.now();

  // Users
  const users = [
    { email: "admin@map.co.id", name: "Admin COE", role: "ADMIN", pw: "Stibo@2026" },
    { email: "md.coe@map.co.id", name: "MD CoE Analyst", role: "EDITOR", pw: "Stibo@2026" },
    { email: "viewer@map.co.id", name: "Brand Viewer", role: "VIEWER", pw: "Stibo@2026" },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash: hashPassword(u.pw), role: u.role, active: true },
      create: { email: u.email, name: u.name, role: u.role, passwordHash: hashPassword(u.pw) },
    });
  }
  console.log("  users:", users.length);

  // Settings
  const settings = [
    { key: "sendMode", value: "MOCK" },
    { key: "stiboEndpoints", value: JSON.stringify({
        ARTICLE_PLANNING: process.env.STIBO_INBOUND_URL_ARTICLE_PLANNING ?? "",
        EAN_UPDATE: process.env.STIBO_INBOUND_URL_EAN_UPDATE ?? "",
        ARTICLE_MAINTENANCE: process.env.STIBO_INBOUND_URL_ARTICLE_MAINTENANCE ?? "",
      }) },
    { key: "oidcConfigured", value: process.env.STIBO_CLIENT_ID ? "yes" : "no" },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({ where: { key: s.key }, update: { value: s.value }, create: s });
  }

  // Brands
  const brands = load("brands_curated.json");
  for (const b of brands) {
    await prisma.brand.upsert({
      where: { code: b.code },
      update: { name: b.name, division: b.division, status: b.status, fileTypes: JSON.stringify(b.fileTypes ?? []) },
      create: { code: b.code, name: b.name, division: b.division ?? "SPORTS", status: b.status ?? "ACTIVE", fileTypes: JSON.stringify(b.fileTypes ?? []) },
    });
  }
  console.log("  brands:", brands.length);

  // Attributes
  const attributes = load("attributes.json");
  await prisma.attribute.deleteMany();
  for (let i = 0; i < attributes.length; i += 200) {
    await prisma.attribute.createMany({ data: attributes.slice(i, i + 200) });
  }
  console.log("  attributes:", attributes.length);

  // LOVs
  const lovs = load("lov.json");
  await prisma.lovValue.deleteMany();
  await prisma.lovTable.deleteMany();
  for (const l of lovs) {
    await prisma.lovTable.create({ data: { key: l.key, sheetName: l.sheetName } });
    for (let i = 0; i < l.values.length; i += 500) {
      await prisma.lovValue.createMany({
        data: l.values.slice(i, i + 500).map((v: any) => ({ tableKey: l.key, code: v.code, label: v.label })),
      });
    }
  }
  console.log("  lov tables:", lovs.length, "values:", lovs.reduce((s: number, l: any) => s + l.values.length, 0));

  // Mapping rules
  const rules = load("rules.json");
  await prisma.mappingRule.deleteMany();
  for (let i = 0; i < rules.length; i += 400) {
    await prisma.mappingRule.createMany({
      data: rules.slice(i, i + 400).map((r: any) => ({
        brandSheet: r.brandSheet,
        brandCode: resolveBrandCode(r.brandSheet),
        attribute: r.attribute,
        attributeId: r.attributeId,
        validation: r.validation,
        cluster: r.cluster,
        description: r.description,
        mappingType: r.mappingType,
        mappingTypeRaw: r.mappingTypeRaw,
        sourceField: r.sourceField,
        logic: r.logic,
        active: true,
      })),
    });
  }
  console.log("  mapping rules:", rules.length);

  // RNA
  const rna = load("rna.json");
  await prisma.rnaLookup.deleteMany();
  for (let i = 0; i < rna.length; i += 400) {
    await prisma.rnaLookup.createMany({ data: rna.slice(i, i + 400) });
  }
  console.log("  rna lookups:", rna.length);

  // Naming routes
  const naming = load("naming.json");
  await prisma.namingRoute.deleteMany();
  for (let i = 0; i < naming.length; i += 200) {
    await prisma.namingRoute.createMany({ data: naming.slice(i, i + 200) });
  }
  console.log("  naming routes:", naming.length);

  console.log(`Seed done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
