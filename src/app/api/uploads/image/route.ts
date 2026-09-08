import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { audit, handleError, ok } from "@/lib/api-helpers";
import { isAllowedImage, type SheetInfo } from "@/lib/parse-file";
import { parseFilename } from "@/lib/naming";
import ZAI from "z-ai-web-dev-sdk";

export const maxDuration = 120;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_EXTRACTED_ROWS = 200;

const SYSTEM_PROMPT = `You are a precise data-extraction engine for a retail master-data portal.
The user uploads a photo/screenshot of a product list, price list, line sheet or table.
Extract EVERY row of tabular data you can see into JSON.

Rules:
- Respond with VALID JSON only — no markdown fences, no commentary.
- Shape: {"headers": ["Col A", "Col B", ...], "rows": [["v1","v2",...], ...]}
- headers: the column titles; if the image has no header row, invent short ones (e.g. "Style Code", "Color", "Size", "Price").
- rows: all data rows, cell values as plain strings (numbers included), preserving order.
- Never merge or invent extra rows; skip decorative text, logos and page headers/footers.
- If the image contains no table at all, respond {"headers": [], "rows": []}.`;

interface ExtractedTable {
  headers: string[];
  rows: string[][];
}

function safeParseTable(raw: string): ExtractedTable {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  const parsed = JSON.parse(text) as { headers?: unknown; rows?: unknown };
  const headers = Array.isArray(parsed.headers)
    ? parsed.headers.map((h) => String(h ?? "").trim()).filter(Boolean).slice(0, 40)
    : [];
  const rows = Array.isArray(parsed.rows)
    ? parsed.rows
        .slice(0, MAX_EXTRACTED_ROWS)
        .map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? "").trim()) : []))
        .filter((r) => r.some((c) => c !== ""))
    : [];
  return { headers, rows };
}

/**
 * POST — extract tabular data from an uploaded image (photo/screenshot of a
 * product list) via a vision model, then create a regular Upload record so the
 * image enters the same pipeline as Excel files (wizard → transform → send).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("ADMIN", "EDITOR");
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return handleError(new Error("No image provided"));
    if (!isAllowedImage(file.name)) {
      return handleError(new Error("Unsupported image — upload .png / .jpg / .jpeg / .webp"));
    }
    if (file.size > MAX_IMAGE_BYTES) return handleError(new Error("Image exceeds 8 MB limit"));

    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "image/png";
    const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;

    const zai = await ZAI.create();
    const completion = (await zai.chat.completions.createVision({
      model: "glm-4.5v",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the table from this image as JSON." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      thinking: { type: "disabled" },
    })) as { choices?: Array<{ message?: { content?: string } }> };

    const raw = completion.choices?.[0]?.message?.content ?? "";
    let table: ExtractedTable;
    try {
      table = safeParseTable(raw);
    } catch {
      return handleError(new Error("Could not read a table from this image — try a clearer photo/screenshot"));
    }
    if (table.headers.length < 2 || table.rows.length === 0) {
      return handleError(new Error("No tabular data detected in the image — try a clearer, full-table photo"));
    }

    // normalize to record rows
    const rows: Array<Record<string, string>> = table.rows.map((r) => {
      const obj: Record<string, string> = {};
      table.headers.forEach((h, i) => { obj[h] = r[i] ?? ""; });
      return obj;
    });

    const nameInfo = parseFilename(file.name);
    const upload = await db.upload.create({
      data: {
        filename: file.name,
        size: file.size,
        compCode: nameInfo.compCode || "0888",
        sbu: nameInfo.sbu || "SP",
        brandCode: nameInfo.brandSlug.toUpperCase(),
        brandName: nameInfo.brandSlug.toUpperCase() || "—",
        flow: nameInfo.flow || "Image Import",
        gender: nameInfo.gender,
        season: nameInfo.season,
        country: nameInfo.country,
        seq: nameInfo.seq,
        filenameValid: nameInfo.valid,
        endpoint: nameInfo.endpoint,
        status: "PARSED",
        sheetName: "AI image extraction",
        totalRows: rows.length,
        headers: JSON.stringify(table.headers.slice(0, 40)),
        sampleRaw: JSON.stringify(rows.slice(0, MAX_EXTRACTED_ROWS)),
        createdBy: user.email,
      },
    });

    await audit(user.email, "UPLOAD_IMAGE_EXTRACTED", file.name, {
      uploadId: upload.id, rows: rows.length, cols: table.headers.length,
    });

    return ok({
      upload,
      nameInfo,
      ocr: true,
      preview: {
        headers: table.headers.slice(0, 40),
        rows: rows.slice(0, 8),
        totalRows: rows.length,
        sheetName: "AI image extraction",
        sheets: ["AI image extraction"] as unknown as SheetInfo["name"][],
      },
    }, 201);
  } catch (e) {
    return handleError(e);
  }
}
