import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { audit, fail, handleError, ok } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

const VALID_ENDPOINTS = ["ARTICLE_PLANNING", "EAN_UPDATE", "ARTICLE_MAINTENANCE"];

/** Update a naming route (EDITOR+). */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole("ADMIN", "EDITOR");
    const { id } = await params;
    const body = (await req.json()) as { brand?: string; inline?: string; fileType?: string; trigger?: string; endpoint?: string; comment?: string };
    const data: Record<string, unknown> = {};
    if (body.brand !== undefined) data.brand = body.brand.trim();
    if (body.inline !== undefined) data.inline = body.inline.trim();
    if (body.fileType !== undefined) data.fileType = body.fileType.trim();
    if (body.trigger !== undefined) data.trigger = body.trigger.trim();
    if (body.comment !== undefined) data.comment = body.comment.trim();
    if (body.endpoint !== undefined) {
      if (!VALID_ENDPOINTS.includes(body.endpoint)) return fail(400, `endpoint must be one of: ${VALID_ENDPOINTS.join(", ")}`);
      data.endpoint = body.endpoint;
    }
    const route = await db.namingRoute.update({ where: { id }, data });
    await audit(actor.email, "NAMING_ROUTE_UPDATED", `${route.brand} → ${route.endpoint}`, data);
    return ok(route);
  } catch (e) {
    return handleError(e);
  }
}

/** Delete a naming route (ADMIN). */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole("ADMIN");
    const { id } = await params;
    const route = await db.namingRoute.delete({ where: { id } });
    await audit(actor.email, "NAMING_ROUTE_DELETED", `${route.brand} → ${route.endpoint}`);
    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
