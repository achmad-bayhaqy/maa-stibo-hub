import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { audit, fail, handleError, ok } from "@/lib/api-helpers";
import type { MappedRow } from "@/lib/mapping";
import { TEMPLATE_INDEX } from "@/lib/template-columns";

type Params = { params: Promise<{ id: string }> };

/** Cell-level edit payload applied to the mapped sample (post-transform editing). */
interface CellEdit {
  rowNo: number;
  attributeId: string;
  value: string;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireRole("ADMIN", "EDITOR", "VIEWER");
    const { id } = await params;
    const upload = await db.upload.findUnique({ where: { id } });
    if (!upload) return fail(404, "Upload not found");
    const sendJobs = await db.sendJob.findMany({ where: { uploadId: id }, orderBy: { createdAt: "desc" } });
    return ok({ upload: { ...upload, stepxml: upload.stepxml.length > 20000 ? upload.stepxml.slice(0, 20000) + "\n<!-- truncated preview -->" : upload.stepxml }, sendJobs });
  } catch (e) {
    return handleError(e);
  }
}

/**
 * PATCH — apply user edits / row deletions to the mapped sample after transform.
 * Body: { edits?: [{ rowNo, attributeId, value }], deleteRows?: number[] }
 * Only attributes that exist in the template contract are accepted; unknown
 * ids are ignored. Editing invalidates the cached STEPXML so the next
 * preview/send regenerates from the edited data.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole("ADMIN", "EDITOR");
    const { id } = await params;
    const body = (await req.json()) as { edits?: CellEdit[]; deleteRows?: number[] };
    const edits = Array.isArray(body.edits) ? body.edits.slice(0, 500) : [];
    const deleteRows = Array.isArray(body.deleteRows)
      ? Array.from(new Set(body.deleteRows.filter((n) => typeof n === "number"))).slice(0, 500)
      : [];
    if (edits.length === 0 && deleteRows.length === 0) return fail(400, "No edits or deletions provided");

    const upload = await db.upload.findUnique({ where: { id } });
    if (!upload) return fail(404, "Upload not found");
    if (upload.status === "SENT") return fail(409, "Upload already sent to Stibo — duplicate outbound would be unsafe");

    const rows = JSON.parse(upload.mappedSample || "[]") as MappedRow[];
    const byRow = new Map(rows.map((r) => [r.rowNo, r]));

    let applied = 0;
    const appliedDetails: Array<{ rowNo: number; attributeId: string; from: string; to: string }> = [];
    for (const edit of edits) {
      if (typeof edit.rowNo !== "number" || !edit.attributeId || typeof edit.value !== "string") continue;
      if (!(edit.attributeId in TEMPLATE_INDEX)) continue; // template contract only
      if (edit.value.length > 2000) continue; // sanity cap
      const row = byRow.get(edit.rowNo);
      if (!row) continue;
      const from = row.values[edit.attributeId] ?? "";
      row.values[edit.attributeId] = edit.value;
      // refresh per-cell status entry
      const st = row.statuses.find((s) => s.attributeId === edit.attributeId);
      if (st) {
        st.value = edit.value;
        st.status = edit.value.trim() ? "mapped" : st.status;
        st.note = "manual edit in portal";
      }
      applied += 1;
      appliedDetails.push({ rowNo: edit.rowNo, attributeId: edit.attributeId, from, to: edit.value });
    }

    let deleted = 0;
    for (const rowNo of deleteRows) {
      if (!byRow.has(rowNo)) continue;
      byRow.delete(rowNo);
      deleted += 1;
    }
    const remaining = rows.filter((r) => byRow.has(r.rowNo));

    if (applied === 0 && deleted === 0) return fail(400, "No valid edits/deletions applied — check rowNo against the sample");

    await db.upload.update({
      where: { id },
      data: {
        mappedSample: JSON.stringify(remaining),
        processedRows: remaining.length,
        mappedRows: remaining.length,
        stepxml: "", // invalidate cached STEPXML → regenerate from edited rows
        updatedAt: new Date(),
      },
    });

    await audit(user.email, deleted > 0 ? "UPLOAD_SAMPLE_EDITED_ROWS_DELETED" : "UPLOAD_SAMPLE_EDITED", upload.filename, {
      uploadId: id, applied, deleted, remaining: remaining.length, sample: appliedDetails.slice(0, 20),
    });

    return ok({ applied, deleted, remaining: remaining.length });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole("ADMIN", "EDITOR");
    const { id } = await params;
    const upload = await db.upload.delete({ where: { id } });
    await db.sendJob.deleteMany({ where: { uploadId: id } });
    await audit(user.email, "UPLOAD_DELETED", upload.filename, { uploadId: id });
    return ok({ ok: true, filename: upload.filename });
  } catch (e) {
    return handleError(e);
  }
}
