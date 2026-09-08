import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { audit, fail, handleError, ok } from "@/lib/api-helpers";

type Params = { params: Promise<{ key: string }> };

/** Update LOV table metadata (rename sheetName) / delete table + its values (ADMIN). */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole("ADMIN", "EDITOR");
    const { key } = await params;
    const body = (await req.json()) as { sheetName?: string };
    const data: Record<string, unknown> = {};
    if (body.sheetName !== undefined) data.sheetName = body.sheetName.trim();
    if (Object.keys(data).length === 0) return fail(400, "nothing to update");
    const table = await db.lovTable.update({ where: { key }, data });
    await audit(actor.email, "LOV_TABLE_UPDATED", key, data);
    return ok(table);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole("ADMIN");
    const { key } = await params;
    const valueCount = await db.lovValue.count({ where: { tableKey: key } });
    await db.lovValue.deleteMany({ where: { tableKey: key } });
    await db.lovTable.delete({ where: { key } });
    await audit(actor.email, "LOV_TABLE_DELETED", key, { valuesRemoved: valueCount });
    return ok({ ok: true, valuesRemoved: valueCount });
  } catch (e) {
    return handleError(e);
  }
}
