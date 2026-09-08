/**
 * Server-side file parsing: .xlsx/.xlsm/.csv via SheetJS.
 * Extracts first data sheet: headers + rows (string-normalized, max 500).
 */
import * as XLSX from "xlsx";

export interface ParsedSheet {
  sheetName: string;
  headers: string[];
  rows: Array<Record<string, string>>;
  totalRows: number;
  sheets: string[];
}

const MAX_ROWS = 500;

export function parseSpreadsheet(buf: Buffer): ParsedSheet {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: false, raw: false });
  if (!wb.SheetNames.length) throw new Error("Workbook has no sheets");

  // Score every sheet: pick the one with the most tabular data
  // (the first sheet of real brand files is often a pivot/summary).
  let best: { name: string; headers: string[]; rows: Array<Record<string, string>>; score: number } | null = null;

  for (const sheetName of wb.SheetNames.slice(0, 15)) {
    const ws = wb.Sheets[sheetName];
    const aoa: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false, blankrows: false });
    if (aoa.length < 2) continue;

    let headerIdx = -1;
    for (let i = 0; i < Math.min(aoa.length, 12); i++) {
      const nonEmpty = (aoa[i] as unknown[]).filter((c) => String(c ?? "").trim() !== "");
      if (nonEmpty.length >= 3) { headerIdx = i; break; }
    }
    if (headerIdx < 0) continue;

    const rawHeaders = (aoa[headerIdx] as unknown[]).map((h, i) => {
      const s = String(h ?? "").trim();
      return s || `Column ${i + 1}`;
    });
    const headers = rawHeaders.filter(Boolean);
    if (headers.length < 3) continue;

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

    // prefer many rows x many columns of real data
    const score = rows.length * Math.min(headers.length, 30);
    if (!best || score > best.score) {
      best = { name: sheetName, headers, rows, score };
    }
  }

  if (!best || best.rows.length === 0) throw new Error("No tabular data sheet found in this workbook");

  return {
    sheetName: best.name,
    headers: best.headers.filter(Boolean).slice(0, 40),
    rows: best.rows,
    totalRows: best.rows.length,
    sheets: wb.SheetNames.slice(0, 20),
  };
}

export const ALLOWED_EXTENSIONS = [".xlsx", ".xlsm", ".xlsb", ".xls", ".csv"];

export function isAllowedFile(name: string): boolean {
  const lower = name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
