import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { audit, handleError, ok } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

/** Update an LOV value (EDITOR+). */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole("ADMIN", "EDITOR");
    const { id } = await params;
    const body = (await req.json()) as { code?: string; label?: string };
    const data: Record<string, unknown> = {};
    if (body.code !== undefined) data.code = body.code.trim();
    if (body.label !== undefined) data.label = body.label.trim();
    const value = await db.lovValue.update({ where: { id }, data });
    await audit(actor.email, "LOV_VALUE_UPDATED", `${value.tableKey}/${value.code}`, data);
    return ok(value);
  } catch (e) {
    return handleError(e);
  }
}

/** Delete an LOV value (ADMIN). */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole("ADMIN");
    const { id } = await params;
    const value = await db.lovValue.delete({ where: { id } });
    await audit(actor.email, "LOV_VALUE_DELETED", `${value.tableKey}/${value.code}`);
    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
