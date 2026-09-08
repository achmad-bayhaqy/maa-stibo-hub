import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { audit, fail, handleError, ok } from "@/lib/api-helpers";

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

/** Create a mapping rule (EDITOR+). */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("ADMIN", "EDITOR");
    const body = (await req.json()) as {
      brandSheet?: string; brandCode?: string; attribute?: string; attributeId?: string;
      validation?: string; mappingType?: string; sourceField?: string; logic?: string;
    };
    if (!body.brandSheet?.trim() || !body.attributeId?.trim() || !body.mappingType) {
      return fail(400, "brandSheet, attributeId, and mappingType are required");
    }
    const rule = await db.mappingRule.create({
      data: {
        brandSheet: body.brandSheet.trim(),
        brandCode: (body.brandCode ?? body.brandSheet).trim().toUpperCase().slice(0, 8),
        attribute: body.attribute?.trim() || body.attributeId.trim(),
        attributeId: body.attributeId.trim(),
        validation: body.validation || "text",
        mappingType: body.mappingType,
        sourceField: body.sourceField?.trim() ?? "",
        logic: body.logic?.trim() ?? "",
        active: true,
      },
    });
    await audit(actor.email, "RULE_CREATED", `${rule.brandCode}/${rule.attributeId}`, { mappingType: rule.mappingType });
    return ok(rule, 201);
  } catch (e) {
    return handleError(e);
  }
}
