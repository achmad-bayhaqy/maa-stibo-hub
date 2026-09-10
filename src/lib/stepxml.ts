/**
 * STEPXML generator — faithful re-implementation of the production Lambda ETL
 * output format (map-stibo-inbound-validate-transform, verified against real
 * STEP exports for NIKE LineList / ADIDAS LineList / AIRWALK Recap / ASTEC Recap).
 *
 * Structure per reference:
 *   <STEP-ProductInformation xmlns=… ExportTime=… ExportContext="Context1"
 *        ContextID="Context1" WorkspaceID="Main" UseContextLocale="false">
 *     <Classifications>                       ← season hierarchy (CLS_Season
 *       <Classification ID="CLH_{BC}_{SEA}{Y}" UserTypeID="CLS_Season"
 *            ParentID="CLH_{Brand}Batches">     + Confirmed/Unconfirmed children)
 *     <Products>
 *       <Product UserTypeID="PRD_GenericArticle" ParentID="PPH_{D}-TempSubCat">
 *         <KeyValue KeyID="KEY_InboundArticle">TEXT</KeyValue>   ← text form!
 *         <Name>…</Name>
 *         <ClassificationReference ClassificationID="CLH_{Brand}Articles" Type="CPL_Merchandiser"/>
 *         <ClassificationReference ClassificationID="{seasonId}UA" Type="CPL_UnConfirmedForSeason"/>
 *         <Values>
 *           <MultiValue AttributeID="AT_SBU"><Value ID="SP"/></MultiValue>
 *           <Value AttributeID="AT_Brand" ID="NIK"/>          ← LOV → ID ref
 *           <Value AttributeID="AT_PrincipalStyleCode">AA8154-101</Value>
 *         </Values>
 *
 * EAN_UPDATE additionally nests PRD_VariantArticle children (KEY_Variant, per
 * adidas backlog/TDD lambda). Non-ARTICLE_PLANNING endpoints set update="true".
 *
 * Products carry NO ID attribute — identity resolves via <KeyValue>, exactly
 * like the Lambdas (the send pipeline blanks season CLH_ IDs before upload).
 */

import type { MappedRow, WizardContext } from "@/lib/mapping";

const STIBO_NS = "http://www.stibosystems.com/step";

function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

/** "SP2027" → { code: "SP", year: "2027" } | "SP26" → { code: "SP", year: "2026" } */
function seasonOf(season: string): { code: string; year: string } {
  const m = (season || "").trim().toUpperCase().match(/^([A-Z]{1,2})(\d{2,4})$/);
  if (!m) return { code: (season || "UNKNOWN").slice(0, 2).toUpperCase(), year: "" };
  const year = m[2].length === 2 ? (m[2].startsWith("9") ? `19${m[2]}` : `20${m[2]}`) : m[2];
  return { code: m[1], year };
}

const SEASON_LABELS: Record<string, string> = {
  SS: "Spring Summer", FW: "Fall Winter", AW: "Autumn Winter",
  HO: "Holiday", SP: "Spring", SM: "Summer", FA: "Fall",
};

/**
 * STEP classification node casing is irregular per brand (real nodes:
 * CLH_NikeBatches, CLH_AdidasBatches, CLH_airwalkBatches, CLH_astecBatches).
 * Known brands are pinned; new brands fall back to the name as entered.
 */
const BRAND_NODE_OVERRIDES: Record<string, string> = {
  NIKE: "Nike", ADIDAS: "Adidas", AIRWALK: "airwalk", ASTEC: "astec",
  ELLESSE: "ellesse", "NEW BALANCE": "newbalance", "STEVE MADDEN": "stevemadden",
};

function brandNodeName(brandName: string): string {
  const raw = (brandName || "").trim();
  const override = BRAND_NODE_OVERRIDES[raw.toUpperCase()];
  return override || raw.replace(/\s+/g, "");
}

/** Division letter for PPH_{D}-TempSubCat (merged DIVISION_PARENT_MAP + NIKE map). */
function divisionLetter(row: MappedRow): string {
  const t = (row.values["AT_PrincipalMerchandiseHierarchyL1"] || "").toUpperCase();
  if (t.includes("FOOTWEAR")) return "F";
  if (t.includes("APPAREL")) return "A";
  if (t.includes("ACCESSORIES")) return "E";
  if (t.includes("HARDWARE") || t.includes("EQUIPMENT")) return "Q";
  if (t.includes("TOYS")) return "T";
  return "F";
}

function alnumUpper(s: string): string {
  return (s || "").toUpperCase().replace(/[^A-Z0-9/]/g, "");
}

// ── Attribute classification (from the Lambda _add_generic_values impls) ──

/** Emitted as <MultiValue><Value ID="…"/></MultiValue>. */
const MULTIVALUE_ATTRS = new Set(["AT_SBU", "AT_CompanyCode"]);

/** Emitted as LOV references: <Value AttributeID="…" ID="…"/>. */
const ID_REF_ATTRS = new Set([
  "AT_Brand", "AT_BrandGroup", "AT_Color", "AT_Gender", "AT_BYGender",
  "AT_SAPAge", "AT_BYAge", "AT_Season", "AT_CountryOrigin", "AT_Country",
  "AT_SAPArticleCategory", "AT_BYArticleType", "AT_BCI",
  "AT_BYIndicator", "AT_SAPIndicator", "AT_UOM",
  "AT_FOBCurrency", "AT_RetailPriceCurrency", "AT_Width",
  "AT_NatureOfArticle", "AT_SAPProductFlag", "AT_MaterialType",
  "AT_Franchise", "AT_Silhouette", "AT_SportsCategoryEN", "AT_Interest",
  "AT_PricingDistributionChannel", "AT_ArticleStatus", "AT_CountrySize",
]);

/** Canonical emission order (NIKE sp27_maa lambda, extended with recap attrs). */
const CANONICAL_ORDER: string[] = [
  "AT_SBU", "AT_CompanyCode",
  "AT_Brand", "AT_BrandGroup",
  "AT_PrincipalStyleCode", "AT_PrincipalStyleDescription",
  "AT_PrincipalColorCode", "AT_PrincipalColorName", "AT_SAPStyleCode",
  "AT_PrincipalSize", "AT_Color", "AT_InboundGenericCode", "AT_Generic",
  "AT_Gender", "AT_BYGender", "AT_PrincipalGenderDescription", "AT_PrincipalGenderCode",
  "AT_SAPAge", "AT_BYAge", "AT_PrincipalAgeDescription",
  "AT_Season", "AT_SeasonYear", "AT_CountryOrigin",
  "AT_SAPArticleCategory", "AT_BYArticleType", "AT_BCI", "AT_BYIndicator", "AT_SAPIndicator",
  "AT_UOM", "AT_OriginalPrice", "AT_CurrentPrice", "AT_FOB",
  "AT_FOBCurrency", "AT_RetailPriceCurrency",
  "AT_Width", "AT_NatureOfArticle", "AT_SAPProductFlag", "AT_MaterialType",
  "AT_Collection1", "AT_Collection2", "AT_Franchise", "AT_Silhouette",
  "AT_SportsCategoryEN", "AT_Interest",
  "AT_PrincipalMerchandiseHierarchyL1", "AT_PrincipalMerchandiseHierarchyL2",
  "AT_PrincipalMerchandiseHierarchyL3", "AT_PrincipalMerchandiseHierarchyL4",
  "AT_PrincipalMerchandiseHierarchyL5",
  "AT_CountrySize", "AT_ArticleStatus", "AT_BrandType", "AT_BrandCategory",
  "AT_MainVendorIdentification", "AT_PricingDistributionChannel",
  "AT_IncomingMonth", "AT_Country",
];

// ── XML emitters ──

function valueLine(attrId: string, value: string, indent: string, idForm: boolean): string {
  const hasVal = value !== "" && value !== "None" && value !== "nan";
  if (idForm) {
    // LOV reference — ID attr only (STEP exports normalize LOVs to this form)
    return hasVal
      ? `${indent}<Value AttributeID="${esc(attrId)}" ID="${esc(value)}" />`
      : `${indent}<Value AttributeID="${esc(attrId)}" />`;
  }
  return hasVal
    ? `${indent}<Value AttributeID="${esc(attrId)}">${esc(value)}</Value>`
    : `${indent}<Value AttributeID="${esc(attrId)}" />`;
}

function multiValueLine(attrId: string, idVal: string, indent: string): string {
  return `${indent}<MultiValue AttributeID="${esc(attrId)}"><Value ID="${esc(idVal)}" /></MultiValue>`;
}

function inboundArticleKey(row: MappedRow, ctx: WizardContext): string {
  const fromMapping = row.values["AT_InboundGenericCode"] || row.values["AT_Generic"];
  if (fromMapping) return fromMapping;
  const style = row.values["AT_SAPStyleCode"] || row.values["AT_PrincipalStyleCode"] || `ROW${row.rowNo}`;
  const color = row.values["AT_PrincipalColorCode"] || "";
  return `${ctx.brandCode}${style}${color}`;
}

function orderedAttributeIds(row: MappedRow): string[] {
  // Lambda always emits the organisational core (SBU/CompanyCode/Brand/BrandGroup)
  // even when the mapping engine left them empty — force them into the set.
  const present = new Set(Object.keys(row.values));
  for (const core of ["AT_SBU", "AT_CompanyCode", "AT_Brand", "AT_BrandGroup"]) present.add(core);
  const ordered = CANONICAL_ORDER.filter((a) => present.has(a));
  // unknown/template-extra attributes are appended after the canonical set
  const extras = [...present].filter((a) => !CANONICAL_ORDER.includes(a) && a.startsWith("AT_"));
  return [...ordered, ...extras.sort()];
}

/** <Values> block for one mapped row, mirroring _add_generic_values semantics. */
function valuesBlock(row: MappedRow, ctx: WizardContext, indent: string): string {
  const lines: string[] = [];
  const get = (attrId: string): string => {
    const v = row.values[attrId] ?? "";
    if (v) return v;
    switch (attrId) {
      case "AT_SBU": return ctx.sbu;
      case "AT_CompanyCode": return ctx.compCode;
      case "AT_Brand": return ctx.brandCode;
      case "AT_BrandGroup": return ctx.brandName.toUpperCase();
      default: return "";
    }
  };

  for (const attrId of orderedAttributeIds(row)) {
    const value = get(attrId);
    if (MULTIVALUE_ATTRS.has(attrId)) {
      if (value) lines.push(multiValueLine(attrId, value, indent));
      continue;
    }
    if (attrId === "AT_InboundGenericCode" && !value) {
      // always present in the reference format — emit computed key
      lines.push(`${indent}<Value AttributeID="AT_InboundGenericCode">${esc(inboundArticleKey(row, ctx))}</Value>`);
      continue;
    }
    lines.push(valueLine(attrId, value, indent, ID_REF_ATTRS.has(attrId)));
  }
  return lines.join("\n");
}

function buildClassificationsXml(ctx: WizardContext): string {
  const { code, year } = seasonOf(ctx.season);
  const brandNode = brandNodeName(ctx.brandName);
  const seasonId = `CLH_${ctx.brandCode}_${code}${year}`;
  const longLabel = SEASON_LABELS[code] ?? code;
  const seasonDisplay = `${brandNode} ${longLabel} ${year}`.trim();
  const shortLabel = `${code} ${year}`.trim();

  const seasonCls =
    `<Classification ID="${esc(seasonId)}" UserTypeID="CLS_Season" ParentID="CLH_${esc(brandNode)}Batches">` +
    `<Name>${esc(seasonDisplay)}</Name>` +
    `<Classification ID="${esc(seasonId)}CA" UserTypeID="CLS_ConfirmedArticles">` +
    `<Name>${esc(`${shortLabel} Confirmed Articles`)}</Name></Classification>` +
    `<Classification ID="${esc(seasonId)}UA" UserTypeID="CLS_UnconfirmedArticles">` +
    `<Name>${esc(`${shortLabel} Unconfirmed Articles`)}</Name></Classification>` +
    `</Classification>`;

  return `  <Classifications>${seasonCls}</Classifications>`;
}

function productTag(row: MappedRow, update: boolean): string {
  const userType = row.values["AT_SAPArticleCategory"] === "0" ? "PRD_SingleArticle" : "PRD_GenericArticle";
  const parent = `PPH_${divisionLetter(row)}-TempSubCat`;
  return `<Product UserTypeID="${userType}" ParentID="${parent}"${update ? ' update="true"' : ""}>`;
}

function classificationRefs(ctx: WizardContext, indent: string): string {
  const brandNode = brandNodeName(ctx.brandName);
  const { code, year } = seasonOf(ctx.season);
  const seasonId = `CLH_${ctx.brandCode}_${code}${year}`;
  return [
    `${indent}<ClassificationReference ClassificationID="CLH_${esc(brandNode)}Articles" Type="CPL_Merchandiser" />`,
    `${indent}<ClassificationReference ClassificationID="${esc(seasonId)}UA" Type="CPL_UnConfirmedForSeason" />`,
  ].join("\n");
}

function buildProductXml(row: MappedRow, ctx: WizardContext, update: boolean, indent: string): string {
  const key = inboundArticleKey(row, ctx);
  const name = row.values["AT_PrincipalStyleDescription"] ||
    row.values["AT_GenericDescription"] ||
    row.values["AT_VariantDescription"] ||
    `${ctx.brandName} ${row.values["AT_PrincipalStyleCode"] || row.rowNo}`;

  const inner = [
    `${indent}  <KeyValue KeyID="KEY_InboundArticle">${esc(key)}</KeyValue>`,
    `${indent}  <Name>${esc(name)}</Name>`,
    classificationRefs(ctx, `${indent}  `),
    `${indent}  <Values>`,
    valuesBlock(row, ctx, `${indent}    `),
    `${indent}  </Values>`,
  ].join("\n");

  return `${indent}${productTag(row, update)}${inner ? "\n" + inner + "\n" + indent : ""}</Product>`;
}

/** Variant children for EAN_UPDATE (mirrors adidas backlog/TDD lambda). */
function buildVariantChildren(rows: MappedRow[], ctx: WizardContext, update: boolean, indent: string): string {
  const brandCode = ctx.brandCode;
  const style = rows[0].values["AT_SAPStyleCode"] || rows[0].values["AT_PrincipalStyleCode"] || "";
  const sizeAttr = "AT_Size";
  const out: string[] = [];
  let n = 0;
  const seen = new Set<string>();

  for (const r of rows) {
    const size = r.values[sizeAttr];
    if (!size) continue;
    const sizeId = alnumUpper(size);
    const dedupe = `${sizeId}|${r.values["AT_PrincipalBarcode"] || ""}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    n += 1;

    const variantKey = `${brandCode}${style}${sizeId}`;
    const vals = [
      valueLine("AT_Brand", brandCode, `${indent}      `, true),
      valueLine("AT_PrincipalStyleCode", style, `${indent}      `, false),
      valueLine("AT_SAPStyleCode", style, `${indent}      `, false),
      sizeId
        ? `${indent}      <Value AttributeID="AT_Size" ID="${esc(sizeId)}">${esc(size)}</Value>`
        : valueLine("AT_Size", size, `${indent}      `, false),
      valueLine("AT_PrincipalSize", size, `${indent}      `, false),
      valueLine("AT_SAPSize", sizeId, `${indent}      `, true),
      valueLine("AT_PrincipalBarcode", r.values["AT_PrincipalBarcode"] || r.values["AT_InternalBarcode"] || r.values["AT_FGBarcode"], `${indent}      `, false),
      `${indent}      <Value AttributeID="AT_EANCategory" />`,
    ].filter(Boolean).join("\n");

    out.push(
      `${indent}    <Product UserTypeID="PRD_VariantArticle"${update ? ' update="true"' : ""}>\n` +
      `${indent}      <KeyValue KeyID="KEY_Variant">${esc(variantKey)}</KeyValue>\n` +
      `${indent}      <Name>Size ${n}</Name>\n` +
      `${indent}      <Values>\n${vals}\n${indent}      </Values>\n` +
      `${indent}    </Product>`
    );
  }
  return out.join("\n");
}

/**
 * Build the complete STEPXML document.
 * - ARTICLE_PLANNING → flat PRD_GenericArticle list (1 product per source row)
 * - EAN_UPDATE       → PRD_GenericArticle parents + PRD_VariantArticle children
 * - ARTICLE_MAINTENANCE / EAN_UPDATE → update="true" on root and products
 */
export function buildStepxml(
  mapped: MappedRow[],
  ctx: WizardContext,
  endpoint: string,
  _filename: string
): string {
  const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  const update = endpoint !== "ARTICLE_PLANNING";
  const rootAttrs =
    `xmlns="${STIBO_NS}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xsi:schemaLocation="${STIBO_NS} PIM.xsd" ExportTime="${stamp}" ` +
    `ExportContext="Context1" ContextID="Context1" WorkspaceID="Main" UseContextLocale="false"` +
    (update ? ' update="true"' : "");

  const out: string[] = [];
  out.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  out.push(`<STEP-ProductInformation ${rootAttrs}>`);
  out.push("");
  out.push(buildClassificationsXml(ctx));
  out.push("");
  out.push("  <Products>");

  if (endpoint === "EAN_UPDATE") {
    // group by style+color → parent article with size variants
    const groups = new Map<string, MappedRow[]>();
    for (const row of mapped) {
      const style = row.values["AT_SAPStyleCode"] || row.values["AT_PrincipalStyleCode"] || `ROW${row.rowNo}`;
      const color = row.values["AT_PrincipalColorCode"] || "NA";
      const key = `${style}|${color}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    for (const rows of groups.values()) {
      out.push(buildProductXml(rows[0], ctx, update, "    "));
      const variants = buildVariantChildren(rows, ctx, update, "    ");
      if (variants) out.push(variants);
    }
  } else {
    for (const row of mapped) {
      out.push(buildProductXml(row, ctx, update, "    "));
    }
  }

  out.push("  </Products>");
  out.push("</STEP-ProductInformation>");
  return out.join("\n") + "\n";
}

/**
 * Mirror of lambda map-stibo-inbound-send-to-step `blank_step_ids`: the IIEP
 * resolves season nodes by name — explicit CLH_ IDs on <Classification> tags
 * are blanked before upload. ParentID / ClassificationID are untouched.
 * Applied automatically in sendToStibo() LIVE mode; kept exported for tests.
 */
export function blankSeasonClassificationIds(xml: string): string {
  return xml.replace(/<Classification\b[^>]*>/g, (tag) =>
    tag.replace(/(?<=\s)ID="CLH_[^"]*"/g, 'ID=""')
  );
}

/** Reference lambdas keep the source file stem — only the extension changes. */
export function xmlFileName(filename: string, _endpoint: string): string {
  return filename.replace(/\.(xlsx|xlsm|xlsb|xls|csv)$/i, "") + ".xml";
}
