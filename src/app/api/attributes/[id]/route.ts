import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { audit, handleError, ok } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole("ADMIN", "EDITOR");
    const { id } = await params;
    const body = (await req.json()) as { name?: string; validation?: string };
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.validation !== undefined) data.validation = body.validation;
    const attr = await db.attribute.update({ where: { id }, data });
    await audit(actor.email, "ATTRIBUTE_UPDATED", attr.code, data);
    return ok(attr);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole("ADMIN");
    const { id } = await params;
    const attr = await db.attribute.delete({ where: { id } });
    await audit(actor.email, "ATTRIBUTE_DELETED", attr.code);
    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
