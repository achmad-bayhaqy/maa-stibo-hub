import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { audit, handleError, ok } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

const FIELDS = ["country", "compCode", "sbuGrouping", "subSbu", "sbu", "brandGroup", "brandCategory", "brandType", "brandName", "brandCode", "reportingBrandCode", "reportingBrandName"] as const;

/** Update an RNA row (EDITOR+). */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole("ADMIN", "EDITOR");
    const { id } = await params;
    const body = (await req.json()) as Partial<Record<string, string>>;
    const data: Record<string, unknown> = {};
    for (const f of FIELDS) if (body[f] !== undefined) data[f] = String(body[f]).trim();
    const row = await db.rnaLookup.update({ where: { id }, data });
    await audit(actor.email, "RNA_UPDATED", `${row.country}/${row.brandCode}`, data);
    return ok(row);
  } catch (e) {
    return handleError(e);
  }
}

/** Delete an RNA row (ADMIN). */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole("ADMIN");
    const { id } = await params;
    const row = await db.rnaLookup.delete({ where: { id } });
    await audit(actor.email, "RNA_DELETED", `${row.country}/${row.brandCode}`);
    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
