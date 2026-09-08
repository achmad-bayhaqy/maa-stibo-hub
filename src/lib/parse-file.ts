/**
 * Server-side file parsing: .xlsx/.xlsm/.xlsb/.xls/.csv via SheetJS.
 * Hidden/veryHidden sheets are never auto-selected — the portal only reads
 * sheets a user can actually see in Excel, and an explicit sheet picker
 * (sheet confirmation) is served for workbooks with multiple candidates.
 */
import * as XLSX from "xlsx";

export interface ParsedSheet {
  sheetName: string;
  headers: string[];
  rows: Array<Record<string, string>>;
  totalRows: number;
  sheets: string[];
}

/** Metadata for the sheet confirmation picker. */
export interface SheetInfo {
  name: string;
  visible: boolean;
  dataRows: number;
  colCount: number;
  headerPreview: string[];
  /** true when this sheet would be the auto-pick (best visible candidate) */
  recommended?: boolean;
}

const MAX_ROWS = 500;
const HIDDEN = { VISIBLE: 0, HIDDEN: 1, VERY_HIDDEN: 2 } as const;

function sheetVisibility(wb: XLSX.WorkBook, name: string): number {
  const meta = wb.Workbook?.Sheets?.find((s) => s.name === name);
  return meta?.Hidden ?? HIDDEN.VISIBLE;
}

function extractSheet(wb: XLSX.WorkBook, sheetName: string): {
  headers: string[]; rows: Array<Record<string, string>>;
} | null {
  const ws = wb.Sheets[sheetName];
  if (!ws) return null;
  const aoa: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false, blankrows: false });
  if (aoa.length < 2) return null;

  // find the first row with >=3 non-empty cells within the first 12 rows
  let headerIdx = -1;
  for (let i = 0; i < Math.min(aoa.length, 12); i++) {
    const nonEmpty = (aoa[i] as unknown[]).filter((c) => String(c ?? "").trim() !== "");
    if (nonEmpty.length >= 3) { headerIdx = i; break; }
  }
  if (headerIdx < 0) return null;

  const rawHeaders = (aoa[headerIdx] as unknown[]).map((h, i) => {
    const s = String(h ?? "").trim();
    return s || `Column ${i + 1}`;
  });
  const headers = rawHeaders.filter(Boolean);
  if (headers.length < 3) return null;

  const rows: Array<Record<string, string>> = [];
  for (let i = headerIdx + 1; i < Math.min(aoa.length, headerIdx + 1 + MAX_ROWS); i++) {
    const arr = aoa[i] as unknown[];
    const obj: Record<string, string> = {};
    let hasValue = false;
    headers.forEach((h, ci) => {
      const v = String(arr[ci] ?? "").trim();
      obj[h] = v;
      if (v) hasValue = true;
    });
    if (hasValue) rows.push(obj);
  }
  return { headers, rows };
}

function scoreOf(headers: string[], rows: Array<Record<string, string>>): number {
  return rows.length * Math.min(headers.length, 30);
}

/**
 * Parse a workbook. When `preferred` is given it is used directly (must exist);
 * otherwise the best *visible* sheet by tabular score wins — hidden sheets are
 * only considered when no visible sheet yields tabular data.
 */
export function parseSpreadsheet(buf: Buffer, preferred?: string): ParsedSheet {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: false, raw: false });
  if (!wb.SheetNames.length) throw new Error("Workbook has no sheets");

  if (preferred) {
    const extracted = extractSheet(wb, preferred);
    if (!extracted || extracted.rows.length === 0) {
      throw new Error(`Sheet "${preferred}" has no readable tabular data`);
    }
    return {
      sheetName: preferred,
      headers: extracted.headers.slice(0, 40),
      rows: extracted.rows,
      totalRows: extracted.rows.length,
      sheets: wb.SheetNames.slice(0, 20),
    };
  }

  type Candidate = { name: string; headers: string[]; rows: Array<Record<string, string>>; score: number };
  let best: Candidate | null = null;
  let bestHidden: Candidate | null = null;

  for (const sheetName of wb.SheetNames.slice(0, 25)) {
    const extracted = extractSheet(wb, sheetName);
    if (!extracted || extracted.rows.length === 0) continue;
    const score = scoreOf(extracted.headers, extracted.rows);
    const visible = sheetVisibility(wb, sheetName) === HIDDEN.VISIBLE;
    if (visible) {
      if (!best || score > best.score) best = { name: sheetName, ...extracted, score };
    } else {
      if (!bestHidden || score > bestHidden.score) bestHidden = { name: sheetName, ...extracted, score };
    }
  }

  const chosen = best ?? bestHidden;
  if (!chosen || chosen.rows.length === 0) throw new Error("No tabular data sheet found in this workbook");

  return {
    sheetName: chosen.name,
    headers: chosen.headers.filter(Boolean).slice(0, 40),
    rows: chosen.rows,
    totalRows: chosen.rows.length,
    sheets: wb.SheetNames.slice(0, 20),
  };
}

/**
 * Inspect every sheet for the confirmation picker: visibility, data volume,
 * and a header preview. Visible sheets are flagged `recommended` when they are
 * the best tabular candidate.
 */
export function listSheets(buf: Buffer): SheetInfo[] {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: false, raw: false, bookVBA: false });
  const infos: SheetInfo[] = [];
  let bestScore = -1;
  let bestVisibleName = "";

  for (const name of wb.SheetNames.slice(0, 40)) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const visible = sheetVisibility(wb, name) === HIDDEN.VISIBLE;
    const range = ws["!ref"] ?? "A1:A1";
    const decoded = XLSX.utils.decode_range(range);
    const colCount = decoded.e.c - decoded.s.c + 1;
    const dataRows = Math.max(decoded.e.r - decoded.s.r, 0);
    const extracted = extractSheet(wb, name);
    const headers = extracted?.headers ?? [];
    const score = extracted ? scoreOf(headers, extracted.rows) : -1;
    if (visible && score > bestScore) { bestScore = score; bestVisibleName = name; }
    infos.push({
      name,
      visible,
      dataRows: extracted?.rows.length ?? dataRows,
      colCount: headers.length || colCount,
      headerPreview: headers.slice(0, 8),
    });
  }
  return infos.map((i) => ({ ...i, recommended: i.name === bestVisibleName }));
}

export const ALLOWED_EXTENSIONS = [".xlsx", ".xlsm", ".xlsb", ".xls", ".csv"];
export const ALLOWED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

export function isAllowedFile(name: string): boolean {
  const lower = name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isAllowedImage(name: string): boolean {
  const lower = name.toLowerCase();
  return ALLOWED_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
