/**
 * STEPXML generator — mirrors the structure produced by the Lambda ETLs
 * (xmlns http://www.stibosystems.com/step, PIM.xsd, Products with KeyValue
 * KEY_InboundArticle, season ClassificationReferences, Values + MultiValues).
 */

import type { MappedRow, WizardContext } from "@/lib/mapping";

function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function valueXml(id: string, val: string, indent: string): string {
  return `${indent}<Value AttributeID="${esc(id)}">${esc(val)}</Value>`;
}

function seasonCode(season: string): string {
  const m = season.match(/^([A-Za-z]{2})(\d{2,4})$/);
  if (!m) return season || "UNKNOWN";
  const prefix = m[1].toUpperCase();
  const year = m[2];
  const labels: Record<string, string> = { SP: "Spring", SS: "Spring/Summer", FW: "Fall/Winter", AW: "Autumn/Winter", FA: "Fall", H1: "H1", H2: "H2" };
  return `${labels[prefix] ?? prefix} ${year.length === 2 ? (year.startsWith("9") ? `19${year}` : `20${year}`) : year}`;
}

export function buildStepxml(
  mapped: MappedRow[],
  ctx: WizardContext,
  endpoint: string,
  filename: string
): string {
  const stamp = new Date().toISOString().slice(0, 19);
  const out: string[] = [];

  out.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  out.push(
    `<STEP-ProductInformation xmlns="http://www.stibosystems.com/step" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.stibosystems.com/step PIM.xsd" ContextID="Context1" WorkspaceID="Main" GenerateDescriptions="false">`
  );
  out.push(`  <Products>`);

  // group rows by (style, color) → parent product with size variants
  const groups = new Map<string, MappedRow[]>();
  for (const row of mapped) {
    const style = row.values["AT_PrincipalStyleCode"] || row.values["AT_Generic"] || `ROW${row.rowNo}`;
    const color = row.values["AT_PrincipalColorCode"] || row.values["AT_Color"] || "NA";
    const key = `${style}|${color}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const sizeAttr = "AT_Size";
  const sizeLov = endpoint === "EAN_UPDATE";

  for (const [key, rows] of groups) {
    const [style, color] = key.split("|");
    const parent = rows[0];
    const generic = parent.values["AT_Generic"] || style;
    const variantCode = parent.values["AT_Variant"] || generic;
    const inboundId = `${ctx.compCode}-${ctx.sbu}-${ctx.brandCode}-${generic}-${color}`;
    const desc = parent.values["AT_VariantDescription"] || parent.values["AT_GenericDescription"] || `${ctx.brandName} ${style}`;

    out.push(`    <Product ID="${esc(inboundId)}" UserTypeID="${sizeLov ? "SKU" : "Leaf item"}">`);
    out.push(`      <Name>${esc(desc)}</Name>`);
    out.push(`      <KeyValue KeyID="KEY_InboundArticle" Value="${esc(inboundId)}"/>`);
    out.push(`      <ClassificationReference ClassificationID="${esc(ctx.season || "SEASON")}"/>`);
    out.push(`      <Values>`);
    const emitted = new Set<string>();
    for (const st of parent.statuses) {
      if (!st.value || emitted.has(st.attributeId)) continue;
      emitted.add(st.attributeId);
      out.push(valueXml(st.attributeId, st.value, "        "));
    }
    out.push(`      </Values>`);

    // size variants (article planning)
    const sizes = [...new Set(rows.map((r) => r.values[sizeAttr]).filter(Boolean))];
    if (!sizeLov && sizes.length > 1) {
      out.push(`      <Products>`);
      rows.forEach((r) => {
        const size = r.values[sizeAttr];
        if (!size) return;
        const skuId = `${variantCode}${esc(size).slice(0, 4)}`;
        out.push(`        <Product ID="${skuId}" UserTypeID="SKU">`);
        out.push(`          <Name>${esc(`${desc} ${size}`)}</Name>`);
        out.push(`          <KeyValue KeyID="KEY_InboundArticle" Value="${esc(inboundId)}"/>`);
        out.push(`          <KeyValue KeyID="KEY_Variant" Value="${esc(r.values["AT_Variant"] || skuId)}"/>`);
        out.push(`          <Values>`);
        out.push(valueXml(sizeAttr, size, "            "));
        const ean = r.values["AT_PrincipalBarcode"] || r.values["AT_InternalBarcode"] || r.values["AT_FGBarcode"];
        if (ean) out.push(valueXml("AT_PrincipalBarcode", ean, "            "));
        out.push(`          </Values>`);
        out.push(`        </Product>`);
      });
      out.push(`      </Products>`);
    }
    out.push(`    </Product>`);
  }

  out.push(`  </Products>`);
  out.push(`</STEP-ProductInformation>`);
  return out.join("\n");
}

export function xmlFileName(filename: string, endpoint: string): string {
  return filename.replace(/\.(xlsx|xlsm|xlsb|xls|csv)$/i, "") + `-${endpoint}.xml`;
}
