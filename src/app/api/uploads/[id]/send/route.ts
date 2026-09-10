import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { audit, fail, handleError, ok } from "@/lib/api-helpers";
import { buildStepxml, xmlFileName } from "@/lib/stepxml";
import { sendToStibo, type Endpoint } from "@/lib/stibo";
import { getStiboConfig } from "@/lib/stibo-config";
import type { MappedRow, WizardContext } from "@/lib/mapping";

type Params = { params: Promise<{ id: string }> };

export const maxDuration = 60;

/** GET → generate & store STEPXML preview (dry run, no send) */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireRole("ADMIN", "EDITOR", "VIEWER");
    const { id } = await params;
    const upload = await db.upload.findUnique({ where: { id } });
    if (!upload) return fail(404, "Upload not found");
    if (upload.status !== "MAPPED") return fail(400, "Run the transform wizard first");

    const ctx = JSON.parse(upload.wizard || "{}") as WizardContext;
    const mapped = JSON.parse(upload.mappedSample || "[]") as MappedRow[];
    const xml = buildStepxml(mapped, ctx, upload.endpoint, upload.filename);
    if (!upload.stepxml) {
      await db.upload.update({ where: { id }, data: { stepxml: xml } });
    }
    return ok({ xml: xml.length > 30000 ? xml.slice(0, 30000) + "\n<!-- truncated preview -->" : xml, fileName: xmlFileName(upload.filename, upload.endpoint), bytes: xml.length, products: mapped.length });
  } catch (e) {
    return handleError(e);
  }
}

/** POST → final confirm & send (2-phase confirm handled by UI; server re-validates). */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole("ADMIN", "EDITOR");
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { confirm?: boolean; mode?: "MOCK" | "LIVE" };
    if (!body.confirm) return fail(400, "Explicit confirmation is required before sending to Stibo");

    const upload = await db.upload.findUnique({ where: { id } });
    if (!upload) return fail(404, "Upload not found");
    if (upload.status !== "MAPPED") return fail(400, "Run the transform wizard first");

    const ctx = JSON.parse(upload.wizard || "{}") as WizardContext;
    const mapped = JSON.parse(upload.mappedSample || "[]") as MappedRow[];
    // Always regenerate — guarantees the current generator format is what is
    // sent (never a stale preview stored by an older portal version).
    const xml = buildStepxml(mapped, ctx, upload.endpoint, upload.filename);
    const fileName = xmlFileName(upload.filename, upload.endpoint);

    const resolved = await getStiboConfig();
    const mode: "MOCK" | "LIVE" = body.mode === "LIVE" && resolved !== null ? "LIVE" : "MOCK";

    const result = await sendToStibo(xml, fileName, upload.endpoint as Endpoint, mode);

    await db.upload.update({ where: { id }, data: { stepxml: xml, status: result.ok ? "SENT" : "FAILED", mode } });
    const job = await db.sendJob.create({
      data: {
        uploadId: id, filename: upload.filename, endpoint: upload.endpoint, mode: result.mode,
        bgId: result.bgId, status: result.ok ? "SUCCESS" : "FAILED", httpStatus: result.httpStatus,
        responseSnippet: (result.responseSnippet + (result.error ? ` | ${result.error}` : "")).slice(0, 1000),
        durationMs: result.durationMs, sentBy: user.email,
      },
    });
    await audit(user.email, result.ok ? "STEP_SEND_SUCCESS" : "STEP_SEND_FAILED", upload.filename, {
      uploadId: id, endpoint: upload.endpoint, mode: result.mode, bgId: result.bgId, httpStatus: result.httpStatus,
    });

    return ok({ job, result });
  } catch (e) {
    return handleError(e);
  }
}
