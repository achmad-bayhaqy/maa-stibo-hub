import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fail, handleError, ok } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

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

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole("ADMIN", "EDITOR");
    const { id } = await params;
    const upload = await db.upload.delete({ where: { id } });
    await db.sendJob.deleteMany({ where: { uploadId: id } });
    await requireRole("ADMIN", "EDITOR");
    void user;
    return ok({ ok: true, filename: upload.filename });
  } catch (e) {
    return handleError(e);
  }
}
