import { db } from "@/lib/db";

/**
 * STIBO Hub Assistant — deterministic Q&A engine (v2).
 *
 * Design (best practice, cf. maa-btool assistant):
 *  1. Classify user question into an intent via weighted keyword scoring.
 *  2. Execute REAL database queries for that intent (answers always reflect live data).
 *  3. Compose an answer + optional data table + source references + follow-up chips.
 *  4. Optional LLM narration layer (env ASSISTANT_LLM=on) may rewrite the narrative —
 *     never the data. When unavailable, template narration is used (default).
 */

export interface AskTable {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}
export interface AskResult {
  intent: string;
  answer: string;
  table?: AskTable;
  sources: string[];
  chips: string[];
  deepLink?: { view: string; tab?: string };
}

/* ───────────────────────── intent scoring ───────────────────────── */

const INTENT_KEYWORDS: Record<string, string[]> = {
  stats: ["statistik", "ringkasan", "summary", "dashboard", "kpi", "berapa total", "total data", "jumlah data", "overview"],
  brands: ["brand", "merk", "merek", "divisi", "division", "active brand", "daftar brand"],
  attributes: ["atribut", "attribute", "at_", "mdd", "field", "kolom target"],
  lov: ["lov", "list of values", "nilai terkontrol", "kamus", "season code", "color code", "size grid", "lookup value"],
  rules: ["rule", "rules", "aturan", "mapping", "pemetaan", "manual input", "ai assist", "system_formula"],
  naming: ["nama file", "penamaan", "naming", "format file", "nama file yang benar", "naming route", "routing", "endpoint untuk"],
  rna: ["rna", "sbu", "comp code", "company code", "reporting", "struktur", "0888"],
  uploads: ["upload", "unggah", "file saya", "riwayat", "transformasi saya", "status upload", "upload terakhir"],
  sends: ["send", "kirim", "bgid", "bg id", "terkirim", "sendjob"],
  docs: ["jelaskan", "apa itu", "apa arti", "bagaimana cara", "gimana cara", "dokumentasi", "documentation", "panduan", "guide", "faq", "glosarium", "glossary", "changelog"],
  help: ["bantuan", "help", "bisa apa", "halo", "hai", "hello", "hi", "assistant", "mulai"],
};

function classify(question: string): { intent: string; score: number } {
  const q = question.toLowerCase();
  let best = { intent: "help", score: 0 };
  for (const [intent, words] of Object.entries(INTENT_KEYWORDS)) {
    let score = 0;
    for (const w of words) if (q.includes(w)) score += w.length > 6 ? 2 : 1;
    if (score > best.score) best = { intent, score };
  }
  return best;
}

/* ───────────────────────── param extraction ───────────────────────── */

async function extractBrandCode(q: string): Promise<string> {
  const codes = await db.brand.findMany({ select: { code: true, name: true } });
  const upper = q.toUpperCase();
  for (const c of codes) {
    if (new RegExp(`\\b${c.code}\\b`).test(upper)) return c.code;
  }
  const ql = q.toLowerCase();
  for (const c of codes) if (c.name && ql.includes(c.name.toLowerCase())) return c.code;
  // sheet-name style e.g. "adidas" → ADI
  const known: Record<string, string> = { adidas: "ADI", lotto: "LOT", nike: "NIK", crocs: "CCR", ellesse: "ELL", "new balance": "NEW", anta: "ATA", aldo: "AOD", asics: "ASI", reebok: "REE" };
  for (const [k, v] of Object.entries(known)) if (ql.includes(k)) return v;
  return "";
}

function extractAttrCode(q: string): string {
  const m = q.toUpperCase().match(/AT_[A-Z0-9_]+/);
  return m ? m[0] : "";
}

function extractSeason(q: string): string {
  const m = q.toUpperCase().match(/\b(AU|SP|SU|HO)\d{2}\b/);
  return m ? m[0] : "";
}

function extractFlow(q: string): string {
  const ql = q.toLowerCase();
  if (ql.includes("recap") || ql.includes("sample")) return "RecapSample";
  if (ql.includes("ean")) return "EAN";
  if (ql.includes("maintenance")) return "Maintenance";
  return "";
}

function extractCountry(q: string): string {
  const m = q.toUpperCase().match(/\b(ID|MY|SG|PH|TH|VN|JP|KR|CN|IN|AE|AU)\b/);
  return m ? m[0] : "";
}

function cleanWords(q: string): string[] {
  const stop = new Set(["apa", "itu", "yang", "bagaimana", "cara", "berapa", "adalah", "dan", "untuk", "dengan", "di", "ke", "dari", "ada", "apa saja", "tolong", "mohon", "the", "what", "how", "is", "are", "for", "to", "of", "in", "on", "show", "me", "list", "cari", "tunjukkan", "lihat"]);
  return q.toLowerCase().replace(/[^a-z0-9_ ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !stop.has(w));
}

/* ───────────────────────── answer builders ───────────────────────── */

async function answerStats(): Promise<AskResult> {
  const [brands, attributes, lovTables, lovValues, rules, rna, naming, uploads, sends] = await Promise.all([
    db.brand.count(), db.attribute.count(), db.lovTable.count(), db.lovValue.count(),
    db.mappingRule.count(), db.rnaLookup.count(), db.namingRoute.count(),
    db.upload.count(), db.sendJob.count(),
  ]);
  const byType = await db.mappingRule.groupBy({ by: ["mappingType"], _count: { mappingType: true }, orderBy: { _count: { mappingType: "desc" } } });
  const sendsOk = await db.sendJob.count({ where: { status: "SUCCESS" } });
  return {
    intent: "stats",
    answer: `Ringkasan data master & pipeline saat ini:\n\n- **${brands} brand** aktif terdaftar\n- **${attributes} atribut** Stibo (MDD core)\n- **${lovTables} tabel LOV** berisi ${lovValues.toLocaleString("id-ID")} nilai\n- **${rules.toLocaleString("id-ID")} mapping rule** — terbanyak: ${byType.slice(0, 3).map((t) => `${t.mappingType} (${t._count.mappingType})`).join(", ")}\n- **${rna.toLocaleString("id-ID")} baris RNA**, ${naming} naming routes\n- Pipeline: ${uploads} upload, ${sends} send (${sendsOk} sukses)`,
    table: {
      title: "Tipe mapping rule (teratas)",
      columns: ["Tipe", "Jumlah"],
      rows: byType.slice(0, 8).map((t) => [t.mappingType, t._count.mappingType]),
    },
    sources: ["Database master data (live)"],
    chips: ["Brand apa saja yang aktif?", "Rule MANUAL ada berapa?", "Upload terakhir saya apa saja?"],
    deepLink: { view: "dashboard" },
  };
}

async function answerBrands(q: string): Promise<AskResult> {
  const ql = q.toLowerCase();
  const division = ["SPORTS", "FASHION", "OUTDOOR", "KIDS"].find((d) => ql.includes(d.toLowerCase()));
  const brandCode = await extractBrandCode(q);
  if (brandCode) {
    const b = await db.brand.findUnique({ where: { code: brandCode } });
    if (b) {
      const [ruleCount, typeCounts, rnaRows, routes] = await Promise.all([
        db.mappingRule.count({ where: { brandCode: b.code } }),
        db.mappingRule.groupBy({ by: ["mappingType"], _count: { mappingType: true }, where: { brandCode: b.code } }),
        db.rnaLookup.count({ where: { brandCode: b.code } }),
        db.namingRoute.findMany({ where: { brand: { contains: b.code } } }),
      ]);
      return {
        intent: "brands",
        answer: `**${b.name} (${b.code})** — divisi ${b.division}, status ${b.status}.\n\n- Mapping rules: **${ruleCount}** (${typeCounts.map((t) => `${t.mappingType}: ${t._count.mappingType}`).join(" · ")})\n- Entri RNA: **${rnaRows}**\n- Naming routes: ${routes.length ? routes.map((r) => `${r.fileType || r.inline || "?"} → ${r.endpoint}`).join(" · ") : "memakai default flow"}\n- File types: ${JSON.parse(b.fileTypes || "[]").join(", ") || "—"}`,
        sources: ["Data Master → Brands", "Mapping Rules", "RNA"],
        chips: [`Rule mapping ${b.code} bertipe MANUAL`, `Atribut untuk ${b.code}`, `SBU untuk ${b.code}`],
        deepLink: { view: "master", tab: "brands" },
      };
    }
  }
  const where: Record<string, unknown> = division ? { division } : {};
  const brands = await db.brand.findMany({ where, orderBy: { code: "asc" }, take: 30 });
  return {
    intent: "brands",
    answer: `Ada **${brands.length} brand**${division ? ` di divisi ${division}` : ""}. Berikut daftarnya:`,
    table: {
      title: `Daftar brand${division ? ` (${division})` : ""}`,
      columns: ["Code", "Name", "Division", "Status"],
      rows: brands.map((b) => [b.code, b.name, b.division, b.status]),
    },
    sources: ["Data Master → Brands"],
    chips: ["Detail brand ELL", "Brand di divisi FASHION", "Berapa total brand?"],
    deepLink: { view: "master", tab: "brands" },
  };
}

async function answerAttributes(q: string): Promise<AskResult> {
  const attrCode = extractAttrCode(q);
  if (attrCode) {
    const a = await db.attribute.findUnique({ where: { code: attrCode } });
    if (a) {
      const ruleRefs = await db.mappingRule.count({ where: { attributeId: a.code } });
      return {
        intent: "attributes",
        answer: `**${a.code}** — ${a.name}\n\n- Validation: \`${a.validation}\`\n- Deskripsi: ${a.description || "—"}\n- Dipakai di **${ruleRefs}** mapping rule`,
        sources: ["Data Master → Attributes", "Mapping Rules"],
        chips: [`${a.code} dipakai brand apa saja?`, "Atribut bertipe lov", "Cari atribut color"],
        deepLink: { view: "master", tab: "attributes" },
      };
    }
    return { intent: "attributes", answer: `Atribut \`${attrCode}\` tidak ditemukan di master data. Mungkin belum di-sync dari MDD — cek **Data Master → Attributes** atau tanyakan dengan kata kunci lain.`, sources: ["Data Master → Attributes"], chips: ["Cari atribut color", "Berapa total atribut?"] };
  }
  const words = cleanWords(q);
  const needle = words[0] ?? "";
  const where = needle ? { OR: [{ code: { contains: needle } }, { name: { contains: needle } }] } : {};
  const total = await db.attribute.count({});
  const items = await db.attribute.findMany({ where, orderBy: { code: "asc" }, take: 12 });
  return {
    intent: "attributes",
    answer: needle
      ? `Ditemukan **${items.length} atribut** yang cocok dengan "${needle}" (dari total ${total} atribut MDD):`
      : `Total **${total} atribut** Stibo (MDD core). Berikut sampelnya:`,
    table: {
      title: "Atribut",
      columns: ["Code", "Name", "Validation"],
      rows: items.map((a) => [a.code, a.name, a.validation]),
    },
    sources: ["Data Master → Attributes"],
    chips: ["Detail AT_COLOR_CODE", "Cari atribut season", "Berapa total atribut?"],
    deepLink: { view: "master", tab: "attributes" },
  };
}

async function answerLov(q: string): Promise<AskResult> {
  const tables = await db.lovTable.findMany({ select: { key: true, sheetName: true, _count: { select: { values: true } } } });
  const ql = q.toLowerCase();
  // Generic words that must never drive table selection (e.g. "lov" appears in every sheet name)
  const generic = new Set(["lov", "nilai", "value", "values", "tabel", "table", "daftar", "isi", "list", " untuk ", "code"]);
  const words = cleanWords(q).filter((w) => !generic.has(w) && w !== "untuk" && w !== "code" && w !== "nilai" && w !== "isi" && w !== "daftar");
  // find table by key/sheet mention (exact first, then partial on meaningful words)
  const hit =
    tables.find((t) => ql.includes(t.key.toLowerCase()) && t.key.length > 3) ??
    tables.find((t) => !generic.has(t.sheetName.toLowerCase()) && words.some((w) => w.length > 2 && t.sheetName.toLowerCase().includes(w))) ??
    tables.find((t) => words.some((w) => w.length > 2 && t.key.toLowerCase().includes(w)));
  if (hit) {
    const values = await db.lovValue.findMany({ where: { tableKey: hit.key }, orderBy: { code: "asc" }, take: 20 });
    return {
      intent: "lov",
      answer: `Tabel LOV **${hit.sheetName}** (\`${hit.key}\`) berisi **${hit._count.values} nilai**. Berikut 20 pertama:`,
      table: { title: `${hit.sheetName} — nilai LOV`, columns: ["Code", "Label"], rows: values.map((v) => [v.code, v.label]) },
      sources: ["Data Master → LOV Tables"],
      chips: [`Cari nilai di ${hit.key}`, "Daftar semua tabel LOV", "Apa itu LOV?"],
      deepLink: { view: "master", tab: "lov" },
    };
  }
  const totalValues = tables.reduce((s, t) => s + t._count.values, 0);
  return {
    intent: "lov",
    answer: `Ada **${tables.length} tabel LOV** (${totalValues.toLocaleString("id-ID")} nilai total). Sebutkan nama tabel (mis. SEASON, COLOR, SIZE_GRID) untuk melihat isinya — berikut daftarnya:`,
    table: { title: "Tabel LOV", columns: ["Key", "Sheet", "Nilai"], rows: tables.slice(0, 20).map((t) => [t.key, t.sheetName, t._count.values]) },
    sources: ["Data Master → LOV Tables"],
    chips: ["Nilai LOV SEASON", "Nilai LOV COLOR", "Apa itu LOV?"],
    deepLink: { view: "master", tab: "lov" },
  };
}

async function answerRules(q: string): Promise<AskResult> {
  const brandCode = await extractBrandCode(q);
  const attrCode = extractAttrCode(q);
  const ql = q.toLowerCase();
  const typeHit = (["SYSTEM_FORMULA", "DIRECT", "MANUAL_PORTAL", "MANUAL", "AI_ASSIST", "MAPPING", "NOT_AVAILABLE", "EXTERNAL_SOURCE"] as const)
    .find((t) => ql.includes(t.toLowerCase().replace("_", " ")) || ql.includes(t.toLowerCase()));
  const where: Record<string, unknown> = {};
  if (brandCode) where.brandCode = brandCode;
  if (attrCode) where.attributeId = attrCode;
  if (typeHit) where.mappingType = typeHit;

  if (Object.keys(where).length > 0) {
    const [total, items] = await Promise.all([
      db.mappingRule.count({ where }),
      db.mappingRule.findMany({ where, orderBy: [{ attributeId: "asc" }], take: 12 }),
    ]);
    const scope = [brandCode && `brand ${brandCode}`, attrCode && `atribut ${attrCode}`, typeHit && `tipe ${typeHit}`].filter(Boolean).join(" + ");
    return {
      intent: "rules",
      answer: `Ada **${total.toLocaleString("id-ID")} rule**${scope ? ` untuk ${scope}` : ""}. Sampel:`,
      table: {
        title: "Mapping rules",
        columns: ["Brand", "Attribute", "Tipe", "Source", "Logic"],
        rows: items.map((r) => [r.brandCode || "—", r.attributeId, r.mappingType, r.sourceField || "—", (r.logic || "—").slice(0, 60)]),
      },
      sources: ["Data Master → Mapping Rules"],
      chips: [brandCode ? `Detail atribut ${items[0]?.attributeId ?? "AT_BRAND"}` : "Rule brand ELL", "Rule bertipe AI_ASSIST", "Berapa total rule?"],
      deepLink: { view: "master", tab: "rules" },
    };
  }
  const byType = await db.mappingRule.groupBy({ by: ["mappingType"], _count: { mappingType: true }, orderBy: { _count: { mappingType: "desc" } } });
  const total = byType.reduce((s, t) => s + t._count.mappingType, 0);
  return {
    intent: "rules",
    answer: `Total **${total.toLocaleString("id-ID")} mapping rule**. Distribusi per tipe:`,
    table: { title: "Distribusi tipe mapping", columns: ["Tipe", "Jumlah"], rows: byType.map((t) => [t.mappingType, t._count.mappingType]) },
    sources: ["Data Master → Mapping Rules", "Doc: Mapping Rule Types"],
    chips: ["Jelaskan tipe AI_ASSIST", "Rule MANUAL brand adidas", "Rule untuk AT_BRAND"],
    deepLink: { view: "master", tab: "rules" },
  };
}

async function answerNaming(q: string): Promise<AskResult> {
  const brandCode = await extractBrandCode(q);
  const flow = extractFlow(q);
  const where: Record<string, unknown> = {};
  if (brandCode) where.brand = { contains: brandCode };
  if (flow) where.OR = [{ inline: { contains: flow } }, { fileType: { contains: flow } }, { trigger: { contains: flow } }];
  const routes = await db.namingRoute.findMany({ where, take: 15 });
  const total = await db.namingRoute.count();
  if (routes.length > 0) {
    return {
      intent: "naming",
      answer: `Ditemukan **${routes.length} naming route**${brandCode ? ` untuk ${brandCode}` : ""}${flow ? ` flow ${flow}` : ""} (dari ${total} route total):\n\nFormat nama file: \`{COMP}-{FLOW}-{GENDER}-{SEASON}-{COUNTRY}-{SEQ}.xlsx\``,
      table: {
        title: "Naming routes",
        columns: ["Brand", "Inline", "File type", "Trigger", "Endpoint"],
        rows: routes.map((r) => [r.brand, r.inline, r.fileType, r.trigger, r.endpoint]),
      },
      sources: ["Data Master → Naming Routes", "Doc: File Naming Convention"],
      chips: ["Endpoint untuk ELL recap sample", "Jelaskan format nama file", "Apa itu IIEP?"],
      deepLink: { view: "master", tab: "naming" },
    };
  }
  return {
    intent: "naming",
    answer: `Konvensi penamaan file wajib diikuti agar sistem dapat merouting otomatis:\n\n\`\`\`\n{COMP}-{FLOW}-{GENDER}-{SEASON}-{COUNTRY}-{SEQ}.xlsx\n\`\`\`\n\nContoh: \`0888-RecapSample-M-AU26-ID-001.xlsx\` → **ARTICLE_PLANNING**.\n\n- COMP = company code (0888) · FLOW menentukan endpoint (RecapSample → ARTICLE_PLANNING, EAN → EAN_UPDATE)\n- Sistem punya **${total} naming routes** yang dapat dikelola di Data Master → Naming Routes.`,
    sources: ["Doc: File Naming Convention", "Data Master → Naming Routes"],
    chips: ["Endpoint untuk ELL recap sample", "Daftar naming route adidas", "Apa itu IIEP?"],
    deepLink: { view: "master", tab: "naming" },
  };
}

async function answerRna(q: string): Promise<AskResult> {
  const brandCode = await extractBrandCode(q);
  const country = extractCountry(q);
  const where: Record<string, unknown> = {};
  if (brandCode) where.brandCode = brandCode;
  if (country) where.country = country;
  if (Object.keys(where).length > 0) {
    const [total, items] = await Promise.all([
      db.rnaLookup.count({ where }),
      db.rnaLookup.findMany({ where, take: 12 }),
    ]);
    return {
      intent: "rna",
      answer: `Ditemukan **${total} entri RNA**${brandCode ? ` untuk brand ${brandCode}` : ""}${country ? ` di country ${country}` : ""}:`,
      table: {
        title: "RNA — Brand Reporting Structure",
        columns: ["Country", "Comp", "SBU", "Sub SBU", "Brand", "Code", "Reporting Brand"],
        rows: items.map((r) => [r.country, r.compCode, r.sbu, r.subSbu, r.brandName, r.brandCode, r.reportingBrandCode]),
      },
      sources: ["Data Master → RNA"],
      chips: ["SBU untuk brand LOTTO di ID", "Berapa total entri RNA?", "Format nama file"],
      deepLink: { view: "master", tab: "rna" },
    };
  }
  const total = await db.rnaLookup.count();
  const countries = await db.rnaLookup.groupBy({ by: ["country"], _count: { country: true } });
  return {
    intent: "rna",
    answer: `Tabel RNA (Brand Reporting Structure) berisi **${total.toLocaleString("id-ID")} entri**:\n\n${countries.map((c) => `- ${c.country}: ${c._count.country}`).join("\n")}\n\nSebutkan brand code (mis. "SBU untuk ELL") untuk lookup spesifik.`,
    sources: ["Data Master → RNA", "Doc: LOV & Reference Data"],
    chips: ["SBU untuk brand ELL", "SBU untuk brand NIKE di ID", "Apa itu RNA?"],
    deepLink: { view: "master", tab: "rna" },
  };
}

async function answerUploads(userEmail: string, userName: string): Promise<AskResult> {
  const uploads = await db.upload.findMany({
    where: { OR: [{ createdBy: userEmail }, { createdBy: userName }] },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const total = await db.upload.count();
  const mine = uploads.length;
  return {
    intent: "uploads",
    answer: mine
      ? `Riwayat upload Anda (${mine} terakhir dari total ${total} di sistem):`
      : total
        ? `Anda belum punya upload. Total ${total} upload di sistem (semua pengguna):`
        : "Belum ada upload di sistem. Mulai dari menu **Assistant → Pipeline**: unggah Excel dan ikuti wizard.",
    table: uploads.length
      ? {
          title: "Uploads terbaru",
          columns: ["File", "Brand", "Season", "Endpoint", "Rows", "Status"],
          rows: uploads.map((u) => [u.filename.slice(0, 34), u.brandCode || "—", u.season || "—", u.endpoint, u.totalRows, u.status]),
        }
      : undefined,
    sources: ["Uploads", "Audit Log"],
    chips: ["Berapa send hari ini?", "Bagaimana cara upload?", "Format nama file"],
    deepLink: { view: "files" },
  };
}

async function answerSends(): Promise<AskResult> {
  const [total, okCount, failed] = await Promise.all([
    db.sendJob.count(), db.sendJob.count({ where: { status: "SUCCESS" } }), db.sendJob.count({ where: { status: "FAILED" } }),
  ]);
  const recent = await db.sendJob.findMany({ orderBy: { createdAt: "desc" }, take: 10 });
  return {
    intent: "sends",
    answer: `Total **${total} pengiriman** — ${okCount} sukses, ${failed} gagal (${total ? Math.round((okCount / total) * 100) : 0}% sukses). Terbaru:`,
    table: {
      title: "Send jobs terbaru",
      columns: ["File", "Endpoint", "Mode", "bgId", "HTTP", "Status"],
      rows: recent.map((s) => [s.filename.slice(0, 30), s.endpoint, s.mode, s.bgId, s.httpStatus, s.status]),
    },
    sources: ["Uploads → Send history", "Audit Log"],
    chips: ["Upload terakhir saya", "Bedanya MOCK dan LIVE?", "Bagaimana cara kirim ke Stibo?"],
    deepLink: { view: "files" },
  };
}

async function answerDocs(q: string): Promise<AskResult> {
  const pages = await db.docPage.findMany({});
  const words = cleanWords(q);
  let best: { page: (typeof pages)[number]; score: number } | null = null;
  for (const p of pages) {
    const hay = `${p.title} ${p.summary} ${p.body}`.toLowerCase();
    const score = words.reduce((s, w) => s + (hay.includes(w) ? (p.title.toLowerCase().includes(w) ? 3 : 1) : 0), 0);
    if (!best || score > best.score) best = { page: p, score };
  }
  if (best && best.score > 0) {
    const bodyExcerpt = best.page.body.split("\n").filter((l) => l && !l.startsWith("#")).slice(0, 6).join("\n").slice(0, 600);
    return {
      intent: "docs",
      answer: `Menurut dokumentasi **${best.page.title}**:\n\n${bodyExcerpt}…`,
      sources: [`Documentation → ${best.page.title}`],
      chips: ["Buka panduan memulai", "Apa itu IIEP?", "Tipe mapping rule"],
      deepLink: { view: "docs", tab: best.page.slug },
    };
  }
  return {
    intent: "docs",
    answer: `Documentation Center berisi **${pages.length} halaman** — saya belum menemukan yang cocok dengan kata kunci itu. Coba salah satu halaman berikut:`,
    table: { title: "Halaman dokumentasi", columns: ["Kategori", "Judul", "Ringkasan"], rows: pages.slice(0, 12).map((p) => [p.category, p.title, p.summary.slice(0, 70)]) },
    sources: ["Documentation Center"],
    chips: ["Panduan memulai", "Konvensi penamaan file", "FAQ"],
    deepLink: { view: "docs" },
  };
}

function answerHelp(): AskResult {
  return {
    intent: "help",
    answer: `Halo! Saya **STIBO Hub Assistant**. Ada dua mode:\n\n1. **Pipeline** — alur terpandu upload → map → preview → kirim ke Stibo.\n2. **Q&A** (mode ini) — tanyakan apa saja tentang:\n   - **Brand** — "brand apa saja di divisi SPORTS?"\n   - **Atribut** — "cari atribut color", "detail AT_COLOR_CODE"\n   - **Mapping rules** — "rule MANUAL brand adidas", "berapa rule AI_ASSIST?"\n   - **LOV** — "nilai LOV SEASON"\n   - **Naming & routing** — "format nama file", "endpoint untuk ELL"\n   - **RNA** — "SBU untuk brand NIKE di ID"\n   - **Status pipeline** — "upload terakhir saya", "berapa send hari ini?"\n   - **Dokumentasi** — "apa itu IIEP?", "jelaskan tipe MAPPING"`,
    sources: ["Documentation → Panduan Assistant"],
    chips: ["Brand apa saja yang aktif?", "Format nama file", "Nilai LOV SEASON", "Upload terakhir saya"],
    deepLink: { view: "docs", tab: "assistant-guide" },
  };
}

/* ───────────────────────── public API ───────────────────────── */

export async function ask(question: string, user: { email: string; name: string }): Promise<AskResult> {
  const q = question.trim();
  if (!q) return answerHelp();
  const { intent, score } = classify(q);

  // Strong signals take priority over generic keywords
  if (extractAttrCode(q)) return answerAttributes(q);
  if (/(upload|riwayat|file saya)/i.test(q) && /saya|last|terakhir|status|history/i.test(q)) return answerUploads(user.email, user.name);
  if (/(send|kirim|bgid)/i.test(q)) return answerSends();
  if (/(nama file|naming|penamaan|format file|routing|endpoint untuk)/i.test(q)) return answerNaming(q);
  if (/rna\b|\bsbu\b|comp code|reporting|0888/i.test(q)) return answerRna(q);
  if (/(lov|list of values|nilai terkontrol)/i.test(q)) return answerLov(q);
  if (/(rule|mapping|pemetaan)/i.test(q)) return answerRules(q);
  if (/(atribut|attribute|at_)/i.test(q)) return answerAttributes(q);
  if (/brand|merk|merek|divisi/i.test(q)) return answerBrands(q);

  switch (intent) {
    case "stats": return answerStats();
    case "brands": return answerBrands(q);
    case "attributes": return answerAttributes(q);
    case "lov": return answerLov(q);
    case "rules": return answerRules(q);
    case "naming": return answerNaming(q);
    case "rna": return answerRna(q);
    case "uploads": return answerUploads(user.email, user.name);
    case "sends": return answerSends();
    case "docs": return answerDocs(q);
    case "help": return answerHelp();
    default: return score >= 2 ? answerDocs(q) : answerHelp();
  }
}
