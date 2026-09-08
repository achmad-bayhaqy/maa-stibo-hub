import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { audit, fail, handleError, ok } from "@/lib/api-helpers";

/** Naming routes: list (all) / create (EDITOR+). */
export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").toLowerCase();
    const brand = sp.get("brand") ?? "";
    const where: Record<string, unknown> = {};
    if (brand) where.brand = { contains: brand };
    if (q) where.OR = [{ brand: { contains: q } }, { inline: { contains: q } }, { fileType: { contains: q } }, { trigger: { contains: q } }, { endpoint: { contains: q } }];
    const total = await db.namingRoute.count({ where });
    const items = await db.namingRoute.findMany({ where, orderBy: [{ brand: "asc" }, { fileType: "asc" }], take: Math.min(total, 500) });
    return ok({ items, total });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("ADMIN", "EDITOR");
    const body = (await req.json()) as { brand?: string; inline?: string; fileType?: string; trigger?: string; endpoint?: string; comment?: string };
    if (!body.brand?.trim() || !body.endpoint?.trim()) return fail(400, "brand and endpoint are required");
    const VALID_ENDPOINTS = ["ARTICLE_PLANNING", "EAN_UPDATE", "ARTICLE_MAINTENANCE"];
    if (!VALID_ENDPOINTS.includes(body.endpoint)) return fail(400, `endpoint must be one of: ${VALID_ENDPOINTS.join(", ")}`);
    const route = await db.namingRoute.create({
      data: {
        brand: body.brand.trim(),
        inline: body.inline?.trim() ?? "",
        fileType: body.fileType?.trim() ?? "",
        trigger: body.trigger?.trim() ?? "",
        endpoint: body.endpoint,
        comment: body.comment?.trim() ?? "",
      },
    });
    await audit(actor.email, "NAMING_ROUTE_CREATED", `${route.brand} → ${route.endpoint}`);
    return ok(route, 201);
  } catch (e) {
    return handleError(e);
  }
}
