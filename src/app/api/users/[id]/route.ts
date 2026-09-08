import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, requireRole } from "@/lib/auth";
import { audit, fail, handleError, ok } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole("ADMIN");
    const { id } = await params;
    const body = (await req.json()) as { name?: string; role?: string; active?: boolean; password?: string };
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.role !== undefined && ["ADMIN", "EDITOR", "VIEWER"].includes(body.role)) data.role = body.role;
    if (body.active !== undefined) data.active = body.active;
    if (body.password) data.passwordHash = hashPassword(body.password);
    if (Object.keys(data).length === 0) return fail(400, "Nothing to update");
    if (actor.id === id && data.active === false) return fail(400, "You cannot deactivate yourself");
    const user = await db.user.update({ where: { id }, data });
    await audit(actor.email, "USER_UPDATED", user.email, data);
    return ok({ id: user.id });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole("ADMIN");
    const { id } = await params;
    if (actor.id === id) return fail(400, "You cannot delete yourself");
    const user = await db.user.delete({ where: { id } });
    await audit(actor.email, "USER_DELETED", user.email);
    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
