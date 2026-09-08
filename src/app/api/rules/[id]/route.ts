import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { audit, fail, handleError, ok } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole("ADMIN", "EDITOR");
    const { id } = await params;
    const body = (await req.json()) as { mappingType?: string; sourceField?: string; logic?: string; active?: boolean };
    const data: Record<string, unknown> = {};
    if (body.mappingType !== undefined) data.mappingType = body.mappingType;
    if (body.sourceField !== undefined) data.sourceField = body.sourceField;
    if (body.logic !== undefined) data.logic = body.logic;
    if (body.active !== undefined) data.active = body.active;
    const rule = await db.mappingRule.update({ where: { id }, data });
    await audit(actor.email, "RULE_UPDATED", `${rule.brandSheet}:${rule.attributeId}`, data);
    return ok(rule);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole("ADMIN");
    const { id } = await params;
    const rule = await db.mappingRule.delete({ where: { id } });
    await audit(actor.email, "RULE_DELETED", `${rule.brandSheet}:${rule.attributeId}`);
    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
