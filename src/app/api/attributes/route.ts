import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { audit, fail, handleError, ok, paginate } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").toLowerCase();
    const page = Number(sp.get("page") ?? "1");
    const pageSize = Math.min(Number(sp.get("pageSize") ?? "25"), 100);
    const where: Record<string, unknown> = q
      ? { OR: [{ code: { contains: q } }, { name: { contains: q } }] }
      : {};
    const total = await db.attribute.count({ where });
    const items = await db.attribute.findMany({ where, orderBy: { code: "asc" }, skip: (page - 1) * pageSize, take: pageSize });
    return ok({ items, total, page, pageSize });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("ADMIN", "EDITOR");
    const body = (await req.json()) as { code?: string; name?: string; validation?: string };
    if (!body.code?.startsWith("AT_") || !body.name) return fail(400, "code must start with AT_ and name is required");
    const exists = await db.attribute.findUnique({ where: { code: body.code } });
    if (exists) return fail(409, "Attribute code already exists");
    const attr = await db.attribute.create({ data: { code: body.code, name: body.name, validation: body.validation || "text" } });
    await audit(actor.email, "ATTRIBUTE_CREATED", attr.code);
    return ok(attr, 201);
  } catch (e) {
    return handleError(e);
  }
}
