import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { audit, fail, handleError, ok } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

const ALLOWED_TYPES = ["SYSTEM_FORMULA", "DIRECT", "MANUAL", "MANUAL_PORTAL", "MANUAL_DIRECT", "AI_ASSIST", "MAPPING", "NOT_AVAILABLE", "EXTERNAL_SOURCE", "OTHER"];

/** Update a mapping rule (EDITOR+). */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole("ADMIN", "EDITOR");
    const { id } = await params;
    const before = await db.mappingRule.findUnique({ where: { id } });
    if (!before) return fail(404, "Rule not found");
    const body = (await req.json()) as {
      mappingType?: string; sourceField?: string; logic?: string; validation?: string; active?: boolean; attribute?: string;
    };
    const data: Record<string, unknown> = {};
    if (body.mappingType !== undefined) {
      if (!ALLOWED_TYPES.includes(body.mappingType)) return fail(400, `mappingType must be one of: ${ALLOWED_TYPES.join(", ")}`);
      data.mappingType = body.mappingType;
    }
    if (body.sourceField !== undefined) data.sourceField = body.sourceField.trim();
    if (body.logic !== undefined) data.logic = body.logic.trim();
    if (body.validation !== undefined) data.validation = body.validation;
    if (body.active !== undefined) data.active = body.active;
    if (body.attribute !== undefined) data.attribute = body.attribute.trim();
    const rule = await db.mappingRule.update({ where: { id }, data });
    await audit(actor.email, "RULE_UPDATED", `${rule.brandCode}/${rule.attributeId}`, {
      before: { mappingType: before.mappingType, sourceField: before.sourceField, logic: before.logic, active: before.active },
      after: data,
    });
    return ok(rule);
  } catch (e) {
    return handleError(e);
  }
}

/** Delete a mapping rule (ADMIN). */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole("ADMIN");
    const { id } = await params;
    const rule = await db.mappingRule.delete({ where: { id } });
    await audit(actor.email, "RULE_DELETED", `${rule.brandCode}/${rule.attributeId}`, { mappingType: rule.mappingType });
    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
