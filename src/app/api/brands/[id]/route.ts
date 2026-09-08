import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { audit, fail, handleError, ok } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole("ADMIN", "EDITOR");
    const { id } = await params;
    const body = (await req.json()) as { name?: string; division?: string; status?: string };
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.division !== undefined) data.division = body.division;
    if (body.status !== undefined) data.status = body.status;
    const brand = await db.brand.update({ where: { id }, data });
    await audit(actor.email, "BRAND_UPDATED", brand.code, data);
    return ok(brand);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole("ADMIN");
    const { id } = await params;
    const brand = await db.brand.delete({ where: { id } });
    await audit(actor.email, "BRAND_DELETED", brand.code);
    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
