import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { audit, fail, handleError, ok } from "@/lib/api-helpers";

type Params = { params: Promise<{ entity: string }> };

const ENTITIES = ["brands", "attributes", "rules", "lov-values"] as const;
type Entity = (typeof ENTITIES)[number];

const REQUIRED: Record<Entity, string[]> = {
  brands: ["code", "name"],
  attributes: ["code", "name"],
  rules: ["brandSheet", "attributeId", "mappingType"],
  "lov-values": ["tableKey", "code"],
};

const VALID_RULE_TYPES = ["SYSTEM_FORMULA", "DIRECT", "MANUAL", "MANUAL_PORTAL", "MANUAL_DIRECT", "AI_ASSIST", "MAPPING", "NOT_AVAILABLE", "EXTERNAL_SOURCE", "OTHER"];
const VALID_VALIDATIONS = ["text", "lov", "number", "date", "boolean", "regex"];

/* ── minimal CSV parser (RFC-4180: quoted fields, escaped quotes, CRLF) ── */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  return rows;
}

interface RowError { row: number; error: string }

/** Validate one data row against an entity. Returns normalized payload or error string. */
async function validateRow(entity: Entity, rec: Record<string, string>, rowIdx: number, refs: { brandCodes: Set<string>; lovKeys: Set<string>; attrCodes: Set<string> }): Promise<{ data?: Record<string, string | boolean>; error?: string }> {
  const missing = REQUIRED[entity].filter((k) => !rec[k]?.trim());
  if (missing.length) return { error: `missing required field(s): ${missing.join(", ")}` };

  if (entity === "brands") {
    const code = rec.code.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,8}$/.test(code)) return { error: `invalid code "${code}" (2-8 A-Z0-9)` };
    return { data: { code, name: rec.name.trim(), division: rec.division?.trim() || "SPORTS", status: rec.status?.trim() || "ACTIVE" } };
  }
  if (entity === "attributes") {
    const code = rec.code.trim().toUpperCase();
    if (!code.startsWith("AT_")) return { error: `code must start with AT_ (got "${code}")` };
    const validation = rec.validation?.trim() || "text";
    if (!VALID_VALIDATIONS.includes(validation)) return { error: `invalid validation "${validation}" (${VALID_VALIDATIONS.join("|")})` };
    return { data: { code, name: rec.name.trim(), validation, description: rec.description?.trim() ?? "" } };
  }
  if (entity === "rules") {
    const mappingType = rec.mappingType.trim().toUpperCase();
    if (!VALID_RULE_TYPES.includes(mappingType)) return { error: `invalid mappingType "${mappingType}"` };
    const brandSheet = rec.brandSheet.trim();
    return {
      data: {
        brandSheet, brandCode: (rec.brandCode?.trim() || brandSheet).toUpperCase().slice(0, 8),
        attribute: rec.attribute?.trim() || rec.attributeId.trim(), attributeId: rec.attributeId.trim().toUpperCase(),
        validation: rec.validation?.trim() || "text", mappingType,
        sourceField: rec.sourceField?.trim() ?? "", logic: rec.logic?.trim() ?? "", active: true,
      },
    };
  }
  // lov-values
  const tableKey = rec.tableKey.trim().toUpperCase();
  if (!refs.lovKeys.has(tableKey)) return { error: `unknown LOV tableKey "${tableKey}"` };
  return { data: { tableKey, code: rec.code.trim(), label: rec.label?.trim() || rec.code.trim() } };
}

/** Bulk import: POST body { entity, csv, mode: "preview" | "apply", upsert?: boolean }. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole("ADMIN", "EDITOR");
    const { entity: raw } = await params;
    const entity = raw as Entity;
    if (!ENTITIES.includes(entity)) return fail(400, `entity must be one of: ${ENTITIES.join(", ")}`);

    const body = (await req.json()) as { csv?: string; mode?: string; upsert?: boolean };
    const csv = (body.csv ?? "").slice(0, 4_000_000);
    const mode = body.mode === "apply" ? "apply" : "preview";
    const upsert = body.upsert === true;
    if (!csv.trim()) return fail(400, "csv is required");

    const rows = parseCsv(csv);
    if (rows.length < 2) return fail(400, "CSV must have a header row and at least one data row");
    const headers = rows[0].map((h) => h.trim());
    const records = rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
    if (records.length > 5000) return fail(400, "max 5000 rows per import");

    // Preload reference sets for validation
    const [brandRows, lovRows, attrRows] = await Promise.all([
      db.brand.findMany({ select: { code: true } }),
      db.lovTable.findMany({ select: { key: true } }),
      db.attribute.findMany({ select: { code: true } }),
    ]);
    const refs = {
      brandCodes: new Set(brandRows.map((b) => b.code)),
      lovKeys: new Set(lovRows.map((l) => l.key)),
      attrCodes: new Set(attrRows.map((a) => a.code)),
    };

    const valid: Record<string, string | boolean>[] = [];
    const errors: RowError[] = [];
    let updated = 0;

    for (let i = 0; i < records.length; i++) {
      const res = await validateRow(entity, records[i], i + 2, refs);
      if (res.error) errors.push({ row: i + 2, error: res.error });
      else if (res.data) valid.push(res.data);
    }

    if (mode === "apply") {
      for (const v of valid) {
        if (entity === "brands") {
          const existing = await db.brand.findUnique({ where: { code: v.code as string } });
          if (existing) { if (upsert) { await db.brand.update({ where: { code: v.code as string }, data: v }); updated++; } }
          else await db.brand.create({ data: v as { code: string; name: string; division: string; status: string } });
        } else if (entity === "attributes") {
          const existing = await db.attribute.findUnique({ where: { code: v.code as string } });
          if (existing) { if (upsert) { await db.attribute.update({ where: { code: v.code as string }, data: v }); updated++; } }
          else await db.attribute.create({ data: v as { code: string; name: string; validation: string; description: string } });
        } else if (entity === "rules") {
          await db.mappingRule.create({ data: v as { brandSheet: string; brandCode: string; attribute: string; attributeId: string; validation: string; mappingType: string; sourceField: string; logic: string; active: boolean } });
        } else {
          const dup = await db.lovValue.findFirst({ where: { tableKey: v.tableKey as string, code: v.code as string } });
          if (dup) { if (upsert) { await db.lovValue.update({ where: { id: dup.id }, data: v }); updated++; } }
          else await db.lovValue.create({ data: v as { tableKey: string; code: string; label: string } });
        }
      }
      await audit(actor.email, "BULK_IMPORT_APPLIED", entity, { total: records.length, valid: valid.length, failed: errors.length, updated });
    }

    return ok({
      mode, entity, total: records.length, validCount: valid.length, failedCount: errors.length,
      wouldUpdate: upsert ? "existing rows will be updated (upsert)" : "existing rows will be skipped",
      errors: errors.slice(0, 50),
      ...(mode === "apply" ? { applied: valid.length, updated } : { preview: valid.slice(0, 10) }),
    });
  } catch (e) {
    return handleError(e);
  }
}

/** CSV template for an entity. */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireUser();
    const { entity } = await params;
    const templates: Record<string, string> = {
      brands: "code,name,division,status\nELL,Ellesse,SPORTS,ACTIVE\nNIK,Nike,SPORTS,ACTIVE",
      attributes: "code,name,validation,description\nAT_TEST_COLOR,Test Color,lov,Atribut uji warna",
      rules: "brandSheet,brandCode,attributeId,attribute,mappingType,sourceField,logic\nadidas,ADI,AT_BRAND,Brand,DIRECT,colBrand,",
      "lov-values": "tableKey,code,label\nSEASON,SS27,Spring 2027",
    };
    if (!templates[entity]) return fail(404, "unknown entity template");
    return new Response(templates[entity], { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="template-${entity}.csv"` } });
  } catch (e) {
    return handleError(e);
  }
}
