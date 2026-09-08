import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { audit, handleError, ok, paginate } from "@/lib/api-helpers";
import { isAllowedFile, parseSpreadsheet, listSheets } from "@/lib/parse-file";
import { parseFilename } from "@/lib/naming";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    await requireRole("ADMIN", "EDITOR", "VIEWER");
    const sp = req.nextUrl.searchParams;
    const page = Math.max(Number(sp.get("page") ?? "1"), 1);
    const pageSize = Math.min(Number(sp.get("pageSize") ?? "20"), 50);
    const q = (sp.get("q") ?? "").toLowerCase();
    const all = await db.upload.findMany({ orderBy: { createdAt: "desc" } });
    const filtered = q ? all.filter((u) => u.filename.toLowerCase().includes(q) || u.brandName.toLowerCase().includes(q)) : all;
    return ok(paginate(filtered, page, pageSize));
  } catch (e) {
    return handleError(e);
  }
}

/**
 * POST — parse an uploaded Excel/CSV into a Upload record.
 * Flow: when a multi-candidate workbook is uploaded WITHOUT an explicit
 * `sheet` field, respond { needsSheet: true, sheets: SheetInfo[] } so the UI
 * can confirm which (visible) sheet to import. Hidden sheets are never
 * auto-selected. Re-POST with `sheet` to finalize.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("ADMIN", "EDITOR");
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return handleError(new Error("No file provided"));
    if (!isAllowedFile(file.name)) {
      return handleError(new Error("Unsupported format — upload .xlsx / .xlsm / .xlsb / .xls / .csv"));
    }
    if (file.size > 60 * 1024 * 1024) return handleError(new Error("File exceeds 60 MB limit"));

    const buf = Buffer.from(await file.arrayBuffer());
    const requestedSheet = (form.get("sheet") as string | null)?.trim() || undefined;

    if (!requestedSheet) {
      const sheets = listSheets(buf);
      const visibleWithData = sheets.filter((s) => s.visible && s.dataRows > 0);
      // fast path: exactly one visible sheet holding data → import it directly
      if (visibleWithData.length === 1) {
        return buildUpload(buf, file, visibleWithData[0].name);
      }
      // otherwise confirm with the user (never silently pick a hidden sheet)
      return ok({ needsSheet: true, filename: file.name, sheets });
    }

    return buildUpload(buf, file, requestedSheet);
  } catch (e) {
    return handleError(e);
  }
}

async function buildUpload(buf: Buffer, file: File, sheetName: string) {
  const user = await requireRole("ADMIN", "EDITOR");
  const parsed = parseSpreadsheet(buf, sheetName);
  const nameInfo = parseFilename(file.name);

  // resolve brand slug → brand code
  let brandCode = nameInfo.brandSlug.toUpperCase();
  let brandName = brandCode;
  if (brandCode) {
    const brand = await db.brand.findFirst({
      where: { OR: [{ code: brandCode }, { name: { contains: brandCode } }] },
    });
    if (brand) { brandCode = brand.code; brandName = brand.name; }
    else {
      // fuzzy match against RNA brand names
      const rna = await db.rnaLookup.findFirst({ where: { brandName: { contains: brandCode } } });
      if (rna) { brandCode = rna.brandCode; brandName = rna.brandName; }
      else brandName = brandCode;
    }
  }

  const upload = await db.upload.create({
    data: {
      filename: file.name,
      size: file.size,
      compCode: nameInfo.compCode || "0888",
      sbu: nameInfo.sbu || "SP",
      brandCode, brandName,
      flow: nameInfo.flow,
      gender: nameInfo.gender,
      season: nameInfo.season,
      country: nameInfo.country,
      seq: nameInfo.seq,
      filenameValid: nameInfo.valid,
      endpoint: nameInfo.endpoint,
      status: "PARSED",
      sheetName: parsed.sheetName,
      totalRows: parsed.totalRows,
      headers: JSON.stringify(parsed.headers.slice(0, 40)),
      sampleRaw: JSON.stringify(parsed.rows.slice(0, 200)),
      createdBy: user.email,
    },
  });

  await audit(user.email, "UPLOAD_PARSED", file.name, {
    uploadId: upload.id, rows: parsed.totalRows, sheet: parsed.sheetName,
    brand: brandCode, flow: nameInfo.flow, endpoint: nameInfo.endpoint, valid: nameInfo.valid,
  });

  return ok({
    upload,
    nameInfo,
    preview: { headers: parsed.headers.slice(0, 40), rows: parsed.rows.slice(0, 8), totalRows: parsed.totalRows, sheetName: parsed.sheetName, sheets: parsed.sheets },
  }, 201);
}
