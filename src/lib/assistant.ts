import { db } from "@/lib/db";

/**
 * Map Portal Assistant — deterministic Q&A engine (v2.1, English UI).
 *
 * Design (best practice, cf. maa-btool assistant):
 *  1. Classify the question into an intent via weighted keyword scoring
 *     (English primary; Indonesian aliases still route correctly).
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
  stats: ["statistic", "summary", "dashboard", "kpi", "how many total", "total data", "overview", "statistik", "ringkasan"],
  brands: ["brand", "merk", "merek", "division", "active brand", "brand list", "divisi"],
  attributes: ["attribute", "at_", "mdd", "field", "target column", "atribut", "kolom target"],
  lov: ["lov", "list of values", "season code", "color code", "size grid", "lookup value", "nilai terkontrol", "kamus"],
  rules: ["rule", "mapping", "manual input", "ai assist", "system_formula", "aturan", "pemetaan"],
  naming: ["file name", "naming", "file format", "naming route", "routing", "endpoint for", "nama file", "penamaan", "format file"],
  rna: ["rna", "sbu", "comp code", "company code", "reporting", "0888", "struktur"],
  uploads: ["upload", "my file", "my upload", "upload history", "last upload", "upload status", "unggah", "riwayat", "transformasi saya"],
  sends: ["send", "sent", "bgid", "bg id", "sendjob", "kirim", "terkirim"],
  docs: ["explain", "what is", "what does", "how do i", "how to", "documentation", "guide", "faq", "glossary", "changelog", "jelaskan", "apa itu", "panduan"],
  help: ["help", "what can you do", "hello", "hi", "hey", "assistant", "start", "bantuan", "bisa apa", "halo", "mulai"],
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
  const stop = new Set([
    // English
    "the", "what", "how", "which", "is", "are", "for", "to", "of", "in", "on", "show", "me", "list", "find", "give", "and", "with", "from", "are", "there", "does", "many", "much", "all",
    // Indonesian
    "apa", "itu", "yang", "bagaimana", "cara", "berapa", "adalah", "dan", "untuk", "dengan", "di", "ke", "dari", "ada", "apa saja", "tolong", "mohon", "cari", "tunjukkan", "lihat",
  ]);
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
    answer: `Current master-data & pipeline snapshot:\n\n- **${brands} brands** registered\n- **${attributes} Stibo attributes** (MDD core)\n- **${lovTables} LOV tables** holding ${lovValues.toLocaleString("en-US")} values\n- **${rules.toLocaleString("en-US")} mapping rules** — top types: ${byType.slice(0, 3).map((t) => `${t.mappingType} (${t._count.mappingType})`).join(", ")}\n- **${rna.toLocaleString("en-US")} RNA rows**, ${naming} naming routes\n- Pipeline: ${uploads} uploads, ${sends} sends (${sendsOk} successful)`,
    table: {
      title: "Top mapping rule types",
      columns: ["Type", "Count"],
      rows: byType.slice(0, 8).map((t) => [t.mappingType, t._count.mappingType]),
    },
    sources: ["Master-data database (live)"],
    chips: ["Which brands are active?", "How many MANUAL rules?", "Show my recent uploads"],
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
        answer: `**${b.name} (${b.code})** — division ${b.division}, status ${b.status}.\n\n- Mapping rules: **${ruleCount}** (${typeCounts.map((t) => `${t.mappingType}: ${t._count.mappingType}`).join(" · ")})\n- RNA entries: **${rnaRows}**\n- Naming routes: ${routes.length ? routes.map((r) => `${r.fileType || r.inline || "?"} → ${r.endpoint}`).join(" · ") : "uses the default flow"}\n- File types: ${JSON.parse(b.fileTypes || "[]").join(", ") || "—"}`,
        sources: ["Data Master → Brands", "Mapping Rules", "RNA"],
        chips: [`MANUAL mapping rules for ${b.code}`, `Attributes for ${b.code}`, `SBU for ${b.code}`],
        deepLink: { view: "master", tab: "brands" },
      };
    }
  }
  const where: Record<string, unknown> = division ? { division } : {};
  const brands = await db.brand.findMany({ where, orderBy: { code: "asc" }, take: 30 });
  return {
    intent: "brands",
    answer: `There are **${brands.length} brands**${division ? ` in the ${division} division` : ""}. Here is the list:`,
    table: {
      title: `Brand list${division ? ` (${division})` : ""}`,
      columns: ["Code", "Name", "Division", "Status"],
      rows: brands.map((b) => [b.code, b.name, b.division, b.status]),
    },
    sources: ["Data Master → Brands"],
    chips: ["Details for brand ELL", "Brands in the FASHION division", "How many brands in total?"],
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
        answer: `**${a.code}** — ${a.name}\n\n- Validation: \`${a.validation}\`\n- Description: ${a.description || "—"}\n- Used in **${ruleRefs}** mapping rules`,
        sources: ["Data Master → Attributes", "Mapping Rules"],
        chips: [`Which brands use ${a.code}?`, "Attributes of type lov", "Search color attribute"],
        deepLink: { view: "master", tab: "attributes" },
      };
    }
    return { intent: "attributes", answer: `Attribute \`${attrCode}\` was not found in the master data. It may not have been synced from the MDD yet — check **Data Master → Attributes** or try other keywords.`, sources: ["Data Master → Attributes"], chips: ["Search color attribute", "How many attributes in total?"] };
  }
  const words = cleanWords(q);
  const needle = words[0] ?? "";
  const where = needle ? { OR: [{ code: { contains: needle } }, { name: { contains: needle } }] } : {};
  const total = await db.attribute.count({});
  const items = await db.attribute.findMany({ where, orderBy: { code: "asc" }, take: 12 });
  return {
    intent: "attributes",
    answer: needle
      ? `Found **${items.length} attributes** matching "${needle}" (out of ${total} MDD attributes):`
      : `**${total} Stibo attributes** in total (MDD core). Here is a sample:`,
    table: {
      title: "Attributes",
      columns: ["Code", "Name", "Validation"],
      rows: items.map((a) => [a.code, a.name, a.validation]),
    },
    sources: ["Data Master → Attributes"],
    chips: ["Details for AT_COLOR_CODE", "Search season attribute", "How many attributes in total?"],
    deepLink: { view: "master", tab: "attributes" },
  };
}

async function answerLov(q: string): Promise<AskResult> {
  const tables = await db.lovTable.findMany({ select: { key: true, sheetName: true, _count: { select: { values: true } } } });
  const ql = q.toLowerCase();
  // Generic words that must never drive table selection (e.g. "lov" appears in every sheet name)
  const generic = new Set(["lov", "value", "values", "table", "tables", "list", "code", "nilai", "tabel", "daftar", "isi"]);
  const words = cleanWords(q).filter((w) => !generic.has(w));
  // find table by key/sheet mention (exact first, then partial on meaningful words)
  const hit =
    tables.find((t) => ql.includes(t.key.toLowerCase()) && t.key.length > 3) ??
    tables.find((t) => !generic.has(t.sheetName.toLowerCase()) && words.some((w) => w.length > 2 && t.sheetName.toLowerCase().includes(w))) ??
    tables.find((t) => words.some((w) => w.length > 2 && t.key.toLowerCase().includes(w)));
  if (hit) {
    const values = await db.lovValue.findMany({ where: { tableKey: hit.key }, orderBy: { code: "asc" }, take: 20 });
    return {
      intent: "lov",
      answer: `The LOV table **${hit.sheetName}** (\`${hit.key}\`) holds **${hit._count.values} values**. First 20:`,
      table: { title: `${hit.sheetName} — LOV values`, columns: ["Code", "Label"], rows: values.map((v) => [v.code, v.label]) },
      sources: ["Data Master → LOV Tables"],
      chips: [`Search values in ${hit.key}`, "List all LOV tables", "What is a LOV?"],
      deepLink: { view: "master", tab: "lov" },
    };
  }
  const totalValues = tables.reduce((s, t) => s + t._count.values, 0);
  return {
    intent: "lov",
    answer: `There are **${tables.length} LOV tables** (${totalValues.toLocaleString("en-US")} values total). Name a table (e.g. SEASON, COLOR, SIZE_GRID) to see its contents — here is the list:`,
    table: { title: "LOV tables", columns: ["Key", "Sheet", "Values"], rows: tables.slice(0, 20).map((t) => [t.key, t.sheetName, t._count.values]) },
    sources: ["Data Master → LOV Tables"],
    chips: ["SEASON LOV values", "COLOR LOV values", "What is a LOV?"],
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
    const scope = [brandCode && `brand ${brandCode}`, attrCode && `attribute ${attrCode}`, typeHit && `type ${typeHit}`].filter(Boolean).join(" + ");
    return {
      intent: "rules",
      answer: `There are **${total.toLocaleString("en-US")} rules**${scope ? ` for ${scope}` : ""}. Sample:`,
      table: {
        title: "Mapping rules",
        columns: ["Brand", "Attribute", "Type", "Source", "Logic"],
        rows: items.map((r) => [r.brandCode || "—", r.attributeId, r.mappingType, r.sourceField || "—", (r.logic || "—").slice(0, 60)]),
      },
      sources: ["Data Master → Mapping Rules"],
      chips: [brandCode ? `Details for attribute ${items[0]?.attributeId ?? "AT_BRAND"}` : "Rules for brand ELL", "Rules of type AI_ASSIST", "How many rules in total?"],
      deepLink: { view: "master", tab: "rules" },
    };
  }
  const byType = await db.mappingRule.groupBy({ by: ["mappingType"], _count: { mappingType: true }, orderBy: { _count: { mappingType: "desc" } } });
  const total = byType.reduce((s, t) => s + t._count.mappingType, 0);
  return {
    intent: "rules",
    answer: `**${total.toLocaleString("en-US")} mapping rules** in total. Distribution by type:`,
    table: { title: "Mapping type distribution", columns: ["Type", "Count"], rows: byType.map((t) => [t.mappingType, t._count.mappingType]) },
    sources: ["Data Master → Mapping Rules", "Doc: Mapping Rule Types"],
    chips: ["Explain the AI_ASSIST type", "MANUAL rules for adidas", "Rules for AT_BRAND"],
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
      answer: `Found **${routes.length} naming routes**${brandCode ? ` for ${brandCode}` : ""}${flow ? ` with flow ${flow}` : ""} (out of ${total} total):\n\nFile name format: \`{COMP}-{FLOW}-{GENDER}-{SEASON}-{COUNTRY}-{SEQ}.xlsx\``,
      table: {
        title: "Naming routes",
        columns: ["Brand", "Inline", "File type", "Trigger", "Endpoint"],
        rows: routes.map((r) => [r.brand, r.inline, r.fileType, r.trigger, r.endpoint]),
      },
      sources: ["Data Master → Naming Routes", "Doc: File Naming Convention"],
      chips: ["Endpoint for ELL recap sample", "Explain the file name format", "What is an IIEP?"],
      deepLink: { view: "master", tab: "naming" },
    };
  }
  return {
    intent: "naming",
    answer: `Follow the file naming convention so the system can route files automatically:\n\n\`\`\`\n{COMP}-{FLOW}-{GENDER}-{SEASON}-{COUNTRY}-{SEQ}.xlsx\n\`\`\`\n\nExample: \`0888-RecapSample-M-AU26-ID-001.xlsx\` → **ARTICLE_PLANNING**.\n\n- COMP = company code (0888) · FLOW decides the endpoint (RecapSample → ARTICLE_PLANNING, EAN → EAN_UPDATE)\n- The system has **${total} naming routes**, manageable in Data Master → Naming Routes.`,
    sources: ["Doc: File Naming Convention", "Data Master → Naming Routes"],
    chips: ["Endpoint for ELL recap sample", "List adidas naming routes", "What is an IIEP?"],
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
      answer: `Found **${total} RNA entries**${brandCode ? ` for brand ${brandCode}` : ""}${country ? ` in country ${country}` : ""}:`,
      table: {
        title: "RNA — Brand Reporting Structure",
        columns: ["Country", "Comp", "SBU", "Sub SBU", "Brand", "Code", "Reporting Brand"],
        rows: items.map((r) => [r.country, r.compCode, r.sbu, r.subSbu, r.brandName, r.brandCode, r.reportingBrandCode]),
      },
      sources: ["Data Master → RNA"],
      chips: ["SBU for brand LOTTO in ID", "How many RNA entries?", "File name format"],
      deepLink: { view: "master", tab: "rna" },
    };
  }
  const total = await db.rnaLookup.count();
  const countries = await db.rnaLookup.groupBy({ by: ["country"], _count: { country: true } });
  return {
    intent: "rna",
    answer: `The RNA table (Brand Reporting Structure) holds **${total.toLocaleString("en-US")} entries**:\n\n${countries.map((c) => `- ${c.country}: ${c._count.country}`).join("\n")}\n\nMention a brand code (e.g. "SBU for ELL") for a specific lookup.`,
    sources: ["Data Master → RNA", "Doc: LOV & Reference Data"],
    chips: ["SBU for brand ELL", "SBU for brand NIKE in ID", "What is RNA?"],
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
      ? `Your upload history (${mine} most recent out of ${total} in the system):`
      : total
        ? `You have no uploads yet. ${total} uploads exist in the system (all users):`
        : "No uploads in the system yet. Start from **Assistant**: attach an Excel file and follow the wizard.",
    table: uploads.length
      ? {
          title: "Recent uploads",
          columns: ["File", "Brand", "Season", "Endpoint", "Rows", "Status"],
          rows: uploads.map((u) => [u.filename.slice(0, 34), u.brandCode || "—", u.season || "—", u.endpoint, u.totalRows, u.status]),
        }
      : undefined,
    sources: ["Uploads", "Audit Log"],
    chips: ["How many sends today?", "How do I upload?", "File name format"],
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
    answer: `**${total} sends** in total — ${okCount} successful, ${failed} failed (${total ? Math.round((okCount / total) * 100) : 0}% success). Most recent:`,
    table: {
      title: "Recent send jobs",
      columns: ["File", "Endpoint", "Mode", "bgId", "HTTP", "Status"],
      rows: recent.map((s) => [s.filename.slice(0, 30), s.endpoint, s.mode, s.bgId, s.httpStatus, s.status]),
    },
    sources: ["Uploads → Send history", "Audit Log"],
    chips: ["My recent uploads", "MOCK vs LIVE difference?", "How do I send to Stibo?"],
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
      answer: `From the documentation — **${best.page.title}**:\n\n${bodyExcerpt}…`,
      sources: [`Documentation → ${best.page.title}`],
      chips: ["Open the getting-started guide", "What is an IIEP?", "Mapping rule types"],
      deepLink: { view: "docs", tab: best.page.slug },
    };
  }
  return {
    intent: "docs",
    answer: `The Documentation Center has **${pages.length} pages** — none matched those keywords. Try one of these pages:`,
    table: { title: "Documentation pages", columns: ["Category", "Title", "Summary"], rows: pages.slice(0, 12).map((p) => [p.category, p.title, p.summary.slice(0, 70)]) },
    sources: ["Documentation Center"],
    chips: ["Getting-started guide", "File naming convention", "FAQ"],
    deepLink: { view: "docs" },
  };
}

function answerHelp(): AskResult {
  return {
    intent: "help",
    answer: `Hi! I'm the **Map Portal Assistant** — one thread for everything:\n\n1. **Pipeline** — attach an Excel/CSV (or an image of a table), confirm the sheet, run the LOV wizard, review/edit the full template mapping, then send to Stibo.\n2. **Q&A** — ask me anything:\n   - **Brands** — "which brands are in the SPORTS division?"\n   - **Attributes** — "search color attribute", "details for AT_COLOR_CODE"\n   - **Mapping rules** — "MANUAL rules for adidas", "how many AI_ASSIST rules?"\n   - **LOV** — "SEASON LOV values"\n   - **Naming & routing** — "file name format", "endpoint for ELL"\n   - **RNA** — "SBU for brand NIKE in ID"\n   - **Pipeline status** — "my recent uploads", "how many sends today?"\n   - **Documentation** — "what is an IIEP?", "explain the MAPPING type"\n\nUse **New chat** to reset the thread anytime.`,
    sources: ["Documentation → Assistant Guide"],
    chips: ["Which brands are active?", "File name format", "SEASON LOV values", "My recent uploads"],
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
  if (/(upload|riwayat|file saya|my upload)/i.test(q) && /(saya|my|last|terakhir|status|history)/i.test(q)) return answerUploads(user.email, user.name);
  if (/(send|kirim|bgid)/i.test(q)) return answerSends();
  if (/(nama file|naming|penamaan|format file|routing|endpoint untuk|endpoint for)/i.test(q)) return answerNaming(q);
  if (/rna\b|\bsbu\b|comp code|reporting|0888/i.test(q)) return answerRna(q);
  if (/(lov|list of values|nilai terkontrol)/i.test(q)) return answerLov(q);
  if (/(rule|mapping|pemetaan)/i.test(q)) return answerRules(q);
  if (/(atribut|attribute|at_)/i.test(q)) return answerAttributes(q);
  if (/brand|merk|merek|divisi|division/i.test(q)) return answerBrands(q);

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
