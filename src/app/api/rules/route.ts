import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleError, ok } from "@/lib/api-helpers";

/** Mapping rule statistics + browse (Data Master → Mapping Rules). */
export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const sp = req.nextUrl.searchParams;
    const brand = sp.get("brand") ?? "";
    const type = sp.get("type") ?? "";
    const q = (sp.get("q") ?? "").toLowerCase();
    const page = Math.max(Number(sp.get("page") ?? "1"), 1);
    const pageSize = Math.min(Number(sp.get("pageSize") ?? "25"), 100);

    const where: Record<string, unknown> = {};
    if (brand) where.brandCode = brand;
    if (type) where.mappingType = type;
    if (q) where.OR = [{ attribute: { contains: q } }, { attributeId: { contains: q } }, { sourceField: { contains: q } }];

    const total = await db.mappingRule.count({ where });
    const items = await db.mappingRule.findMany({ where, orderBy: [{ brandSheet: "asc" }, { attributeId: "asc" }], skip: (page - 1) * pageSize, take: pageSize });
    const byType = await db.mappingRule.groupBy({ by: ["mappingType"], _count: { mappingType: true } });
    const brandSheets = await db.mappingRule.groupBy({ by: ["brandSheet", "brandCode"], _count: { brandSheet: true } });
    return ok({ items, total, page, pageSize, byType, brandSheets: brandSheets.map((b) => ({ brandSheet: b.brandSheet, brandCode: b.brandCode, count: b._count.brandSheet })) });
  } catch (e) {
    return handleError(e);
  }
}
