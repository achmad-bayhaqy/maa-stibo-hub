/**
 * Mapping engine — config-driven transform implementing the MAP rule archetypes:
 * SYSTEM_FORMULA | DIRECT | MANUAL(_PORTAL) | AI_ASSIST | MAPPING | NOT_AVAILABLE | EXTERNAL_SOURCE
 * Data source: Brand mapping Template (5,925 rules), RNA master lookup, MDD LOVs.
 */

export interface WizardContext {
  compCode: string;
  sbu: string;
  brandCode: string;
  brandName: string;
  season: string;
  seasonYear: string;
  country: string;
  flow: string;
  endpoint: string;
  actor: string;
}

export interface EngineRule {
  attributeId: string;
  attribute: string;
  mappingType: string;
  sourceField: string;
  validation: string;
  logic: string;
  cluster: string;
  description: string;
}

export interface ValueResult {
  attributeId: string;
  attribute: string;
  value: string;
  status: "mapped" | "ai_suggested" | "manual_required" | "blank" | "error";
  note: string;
}

export interface MappedRow {
  rowNo: number;
  values: Record<string, string>;
  statuses: ValueResult[];
  mappedCount: number;
  manualCount: number;
  aiCount: number;
  warnings: string[];
  errors: string[];
}

export interface EngineStats {
  totalRows: number;
  mappedRows: number;
  rowsWithManual: number;
  rowsWithAi: number;
  rowsWithError: number;
  attributeCoverage: { mapped: number; manual: number; ai: number; blank: number };
  topIssues: Array<{ attributeId: string; attribute: string; type: string; count: number }>;
}

export interface LookupBundle {
  rna: Array<{
    compCode: string; sbu: string; brandCode: string;
    brandGroup: string; brandCategory: string; brandType: string; brandName: string;
    reportingBrandCode: string; reportingBrandName: string;
  }>;
  lov: Record<string, Array<{ code: string; label: string }>>;
}

function normHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_\-./()]+/g, "");
}

function pick(row: Record<string, string>, candidates: string[]): string {
  const normalized = new Map(Object.keys(row).map((k) => [normHeader(k), k]));
  for (const cand of candidates) {
    const key = normalized.get(normHeader(cand));
    if (key && row[key] !== undefined && String(row[key]).trim() !== "") return String(row[key]).trim();
  }
  return "";
}

function findRna(bundle: LookupBundle, ctx: WizardContext) {
  return (
    bundle.rna.find(
      (r) => r.compCode === ctx.compCode && r.sbu === ctx.sbu && r.brandCode === ctx.brandCode
    ) ||
    bundle.rna.find((r) => r.brandCode === ctx.brandCode && r.sbu === ctx.sbu) ||
    bundle.rna.find((r) => r.brandCode === ctx.brandCode)
  );
}

function lovLookup(bundle: LookupBundle, tableKey: string, text: string): { code: string; label: string } | null {
  const values = bundle.lov[tableKey];
  if (!values || !text) return null;
  const t = text.toLowerCase().trim();
  return (
    values.find((v) => v.code.toLowerCase() === t) ||
    values.find((v) => v.label.toLowerCase() === t) ||
    values.find((v) => t.includes(v.code.toLowerCase())) ||
    values.find((v) => v.label.toLowerCase().includes(t) && t.length >= 4) ||
    null
  );
}

function hashToDigits(s: string, digits: number): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return String(h % Math.pow(10, digits)).padStart(digits, "0");
}

function sanitizeCode(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 9);
}

function pad3(s: string): string {
  const t = s.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return (t + "XXX").slice(0, 3);
}

/** Apply the formula archetype for a given attribute (mirrors Lambda ETL system formulas). */
function applyFormula(
  attributeId: string,
  row: Record<string, string>,
  ctx: WizardContext,
  bundle: LookupBundle
): { value: string; note: string } | null {
  const styleCode = pick(row, ["style code", "principal style code", "lot", "style", "article"]);
  const colorCode = pick(row, ["color code", "principal color code", "color"]);
  const colorDesc = pick(row, ["color", "color name", "principal color", "color description"]);
  const size = pick(row, ["size", "size range", "principal size", "sizes"]);
  const gender = pick(row, ["gender", "gender code", "principal gender"]);

  switch (attributeId) {
    case "AT_BrandGroup": {
      const r = findRna(bundle, ctx);
      return r ? { value: r.brandGroup, note: "RNA lookup (compCode+SBU+brand)" } : null;
    }
    case "AT_BrandType": {
      const r = findRna(bundle, ctx);
      return r ? { value: r.brandType, note: "RNA lookup" } : null;
    }
    case "AT_BrandCategory": {
      const r = findRna(bundle, ctx);
      return r ? { value: r.brandCategory, note: "RNA lookup" } : null;
    }
    case "AT_BrandStatus": {
      return { value: "MAA BRAND", note: "RNA default" };
    }
    case "AT_SAPStyleCode": {
      if (!styleCode) return null;
      return { value: `${pad3(ctx.brandCode)}${sanitizeCode(styleCode)}`.slice(0, 12), note: "3-digit brand code + principal style" };
    }
    case "AT_Generic": {
      if (!styleCode) return null;
      return { value: `${pad3(ctx.brandCode)}${sanitizeCode(styleCode)}`.slice(0, 12), note: "Generic code (Type E)" };
    }
    case "AT_Variant": {
      if (!styleCode && !colorCode) return null;
      const base = `${pad3(ctx.brandCode)}${sanitizeCode(styleCode)}${hashToDigits(`${colorCode}${colorDesc}`, 3)}`;
      return { value: base.slice(0, 18), note: "Brand code + style + color hash" };
    }
    case "AT_GenericDescription":
    case "AT_VariantDescription": {
      const desc = [ctx.brandName, styleCode, colorDesc || colorCode, size].filter(Boolean).join(" ");
      return { value: desc.slice(0, 40), note: "Generic description (max 40 chars)" };
    }
    case "AT_Size": {
      const hit = lovLookup(bundle, "SIZE_CODE_LOV", size);
      return hit ? { value: hit.code, note: `Size Code LOV ← "${size}"` } : null;
    }
    case "AT_UOM":
      return { value: "CAR", note: "Default UOM" };
    case "AT_PricingDistributionChannel":
      return { value: "Retailer", note: "Default pricing channel" };
    case "AT_RetailPriceCurrency": {
      const cur = ctx.country === "ID" ? "IDR" : ctx.country === "MY" ? "MYR" : ctx.country === "PH" ? "PHP" : "USD";
      return { value: cur, note: `Currency by country ${ctx.country}` };
    }
    case "AT_SAPProductFlag":
      return { value: "NEW", note: "Default new-article flag" };
    case "AT_MainVendorIdentification":
      return { value: "X", note: "First vendor = main vendor" };
    case "AT_Createdon":
      return { value: new Date().toISOString().slice(0, 19).replace("T", " "), note: "Creation timestamp" };
    case "AT_Createdby":
      return { value: ctx.actor, note: "Current portal user" };
    case "AT_DiscountBucket":
    case "AT_DiscountBucketRounded": {
      const orig = parseFloat(pick(row, ["original price", "retail price"]) || "0");
      const curr = parseFloat(pick(row, ["current price", "fob price", "price"]) || "0");
      if (!orig || !curr) return null;
      return { value: String(Math.round(((orig - curr) / orig) * 100)), note: "(orig−curr)/orig" };
    }
    default:
      return null;
  }
}

/** AI-assist heuristic (portal marks result as "suggested — needs confirmation"). */
function applyAiAssist(
  attributeId: string,
  row: Record<string, string>,
  bundle: LookupBundle
): { value: string; note: string } | null {
  if (attributeId === "AT_Color" || attributeId === "AT_ColorCode") {
    const text = pick(row, ["color", "color description", "principal color", "color name"]);
    if (!text) return null;
    const hit = lovLookup(bundle, "STANDARDIZED_COLOR_LOV", text) || lovLookup(bundle, "COLOR_CODE_LOV", text);
    if (hit) return { value: hit.code, note: `AI color match ← "${text}" → ${hit.label}` };
  }
  if (attributeId === "AT_Gender" || attributeId === "AT_BYGender") {
    const text = pick(row, ["gender", "principal gender", "gender description"]);
    if (!text) return null;
    const hit = lovLookup(bundle, "GENDER_LOV", text);
    if (hit) return { value: hit.code, note: `AI gender match ← "${text}"` };
  }
  if (attributeId === "AT_SAPAge" || attributeId === "AT_BYAge") {
    const text = pick(row, ["age", "age group", "principal age"]);
    if (!text) return null;
    const hit = lovLookup(bundle, "AGE_LOV", text);
    if (hit) return { value: hit.code, note: `AI age match ← "${text}"` };
  }
  return null;
}

const WIZARD_ATTRS: Record<string, keyof WizardContext> = {
  AT_Country: "country",
  AT_CompanyCode: "compCode",
  AT_SBU: "sbu",
  AT_Brand: "brandCode",
  AT_Season: "season",
  AT_SeasonYear: "seasonYear",
  AT_CountryOrigin: "country",
};

export function runMappingEngine(
  rows: Array<Record<string, string>>,
  rules: EngineRule[],
  ctx: WizardContext,
  bundle: LookupBundle,
  maxRows = 500
): { mapped: MappedRow[]; stats: EngineStats } {
  const processed = rows.slice(0, maxRows);
  const issueCounter = new Map<string, { attributeId: string; attribute: string; type: string; count: number }>();

  const bump = (attributeId: string, attribute: string, type: string) => {
    const k = `${attributeId}|${type}`;
    const cur = issueCounter.get(k);
    if (cur) cur.count++;
    else issueCounter.set(k, { attributeId, attribute, type, count: 1 });
  };

  const mapped: MappedRow[] = processed.map((row, i) => {
    const values: Record<string, string> = {};
    const statuses: ValueResult[] = [];
    let manualCount = 0, aiCount = 0;
    const warnings: string[] = [];
    const errors: string[] = [];

    for (const rule of rules) {
      let result: ValueResult;
      const t = rule.mappingType;

      if (t === "DIRECT" || t === "MANUAL_DIRECT") {
        const v = rule.sourceField ? pick(row, [rule.sourceField]) : "";
        if (v) {
          result = { attributeId: rule.attributeId, attribute: rule.attribute, value: v, status: "mapped", note: `Direct ← "${rule.sourceField}"` };
        } else if (t === "MANUAL_DIRECT") {
          result = { attributeId: rule.attributeId, attribute: rule.attribute, value: "", status: "manual_required", note: "Direct source empty — manual input needed" };
          bump(rule.attributeId, rule.attribute, "manual_required"); manualCount++;
        } else {
          result = { attributeId: rule.attributeId, attribute: rule.attribute, value: "", status: "blank", note: `Source "${rule.sourceField}" empty` };
          bump(rule.attributeId, rule.attribute, "blank");
        }
      } else if (t === "MANUAL_PORTAL" || t === "MANUAL") {
        const wizardKey = WIZARD_ATTRS[rule.attributeId];
        const wv = wizardKey ? String(ctx[wizardKey] ?? "") : "";
        if (wv) {
          result = { attributeId: rule.attributeId, attribute: rule.attribute, value: wv, status: "mapped", note: "Filled from portal wizard" };
        } else {
          result = { attributeId: rule.attributeId, attribute: rule.attribute, value: "", status: "manual_required", note: "Manual input in portal" };
          bump(rule.attributeId, rule.attribute, "manual_required"); manualCount++;
        }
      } else if (t === "SYSTEM_FORMULA") {
        const f = applyFormula(rule.attributeId, row, ctx, bundle);
        if (f && f.value) {
          result = { attributeId: rule.attributeId, attribute: rule.attribute, value: f.value, status: "mapped", note: f.note };
        } else {
          result = { attributeId: rule.attributeId, attribute: rule.attribute, value: "", status: "blank", note: "System formula n/a for this row" };
          bump(rule.attributeId, rule.attribute, "blank");
        }
      } else if (t === "AI_ASSIST") {
        const a = applyAiAssist(rule.attributeId, row, bundle);
        if (a && a.value) {
          result = { attributeId: rule.attributeId, attribute: rule.attribute, value: a.value, status: "ai_suggested", note: a.note };
          aiCount++;
        } else {
          result = { attributeId: rule.attributeId, attribute: rule.attribute, value: "", status: "manual_required", note: "AI assist could not suggest a value" };
          bump(rule.attributeId, rule.attribute, "manual_required"); manualCount++;
        }
      } else if (t === "MAPPING") {
        const v = rule.sourceField ? pick(row, [rule.sourceField]) : "";
        const hit = v ? lovLookup(bundle, "GENDER_LOV", v) || lovLookup(bundle, "STANDARDIZED_COLOR_LOV", v) : null;
        if (hit) {
          result = { attributeId: rule.attributeId, attribute: rule.attribute, value: hit.code, status: "mapped", note: `Value mapping ← "${v}"` };
        } else if (v) {
          result = { attributeId: rule.attributeId, attribute: rule.attribute, value: v, status: "mapped", note: "Value mapping — passthrough" };
        } else {
          result = { attributeId: rule.attributeId, attribute: rule.attribute, value: "", status: "blank", note: "Mapping source empty" };
          bump(rule.attributeId, rule.attribute, "blank");
        }
      } else if (t === "NOT_AVAILABLE") {
        result = { attributeId: rule.attributeId, attribute: rule.attribute, value: "", status: "blank", note: "Not available for this brand" };
      } else if (t === "EXTERNAL_SOURCE") {
        result = { attributeId: rule.attributeId, attribute: rule.attribute, value: "", status: "manual_required", note: "External source (Sharepoint/email/dashboard)" };
        bump(rule.attributeId, rule.attribute, "external_source"); manualCount++;
      } else {
        result = { attributeId: rule.attributeId, attribute: rule.attribute, value: "", status: "blank", note: "" };
      }

      values[rule.attributeId] = result.value;
      statuses.push(result);
      if (result.status === "error") errors.push(`${rule.attribute}: ${result.note}`);
    }

    const mappedCount = statuses.filter((s) => s.status === "mapped").length;
    return { rowNo: i + 1, values, statuses, mappedCount, manualCount, aiCount, warnings, errors };
  });

  const attributeCoverage = {
    mapped: mapped.reduce((s, r) => s + r.statuses.filter((x) => x.status === "mapped").length, 0),
    manual: mapped.reduce((s, r) => s + r.statuses.filter((x) => x.status === "manual_required").length, 0),
    ai: mapped.reduce((s, r) => s + r.statuses.filter((x) => x.status === "ai_suggested").length, 0),
    blank: mapped.reduce((s, r) => s + r.statuses.filter((x) => x.status === "blank").length, 0),
  };

  const stats: EngineStats = {
    totalRows: rows.length,
    mappedRows: mapped.length,
    rowsWithManual: mapped.filter((r) => r.manualCount > 0).length,
    rowsWithAi: mapped.filter((r) => r.aiCount > 0).length,
    rowsWithError: mapped.filter((r) => r.errors.length > 0).length,
    attributeCoverage,
    topIssues: [...issueCounter.values()].sort((a, b) => b.count - a.count).slice(0, 12),
  };

  return { mapped, stats };
}
