import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { audit, handleError, ok } from "@/lib/api-helpers";
import { isAllowedImage, type SheetInfo } from "@/lib/parse-file";
import { parseFilename } from "@/lib/naming";
import {
  bedrockEnabled, bedrockExtract, zaiExtract, safeParseTable,
  type ProviderResult, type ExtractedTable,
} from "@/lib/bedrock";

export const maxDuration = 120;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * POST — extract tabular data from an uploaded image (photo/screenshot of a
 * product list) via a vision model, then create a regular Upload record so
 * the image enters the same pipeline as Excel files (wizard → transform → send).
 *
 * AI provider chain: AWS Bedrock (default, authenticated via the EC2 instance
 * role) → Z-AI SDK (fallback). AI_PROVIDER=zai flips the order.
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

    /* provider chain — primary from AI_PROVIDER (default bedrock), the other
       one as automatic fallback so the feature degrades gracefully */
    const primary = bedrockEnabled()
      ? bedrockExtract(buf, mime)
      : zaiExtract(buf, mime).catch((e: Error) => {
          if (/credentials|not configured|apiKey|API key/i.test(e.message)) {
            throw new Error("Z-AI credentials are not configured on this server");
          }
          throw e;
        });
    // lazy — only invoked (once) when the primary provider fails
    const runFallback = () =>
      bedrockEnabled()
        ? zaiExtract(buf, mime).catch(() => null)
        : bedrockExtract(buf, mime).catch(() => null);

    let result: ProviderResult;
    let primaryErr: Error | null = null;
    try {
      result = await primary;
    } catch (e) {
      primaryErr = e as Error;
      console.error("[image-extract] primary provider failed:", primaryErr.message);
      const fb = await runFallback();
      if (!fb) {
        const detail = primaryErr.message.includes("Bedrock models failed")
          ? primaryErr.message.slice(0, 300)
          : "both AWS Bedrock and Z-AI vision providers are unavailable";
        return handleError(new Error(
          `AI image extraction is unavailable: ${detail}. Please upload Excel/CSV instead.`,
        ));
      }
      result = fb;
    }

    let table: ExtractedTable;
    try {
      table = safeParseTable(result.raw);
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
        sheetName: `AI image extraction (${result.provider}: ${result.model})`,
        totalRows: rows.length,
        headers: JSON.stringify(table.headers.slice(0, 40)),
        sampleRaw: JSON.stringify(rows.slice(0, 200)),
        createdBy: user.email,
      },
    });

    await audit(user.email, "UPLOAD_IMAGE_EXTRACTED", file.name, {
      uploadId: upload.id, rows: rows.length, cols: table.headers.length,
      provider: result.provider, model: result.model,
    });

    return ok({
      upload,
      nameInfo,
      ocr: true,
      provider: result.provider,
      model: result.model,
      preview: {
        headers: table.headers.slice(0, 40),
        rows: rows.slice(0, 8),
        totalRows: rows.length,
        sheetName: upload.sheetName,
        sheets: [upload.sheetName] as unknown as SheetInfo["name"][],
      },
    }, 201);
  } catch (e) {
    return handleError(e);
  }
}
