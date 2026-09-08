import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { audit, fail, handleError, ok } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const q = req.nextUrl.searchParams.get("q")?.toLowerCase() ?? "";
    const brands = await db.brand.findMany({ orderBy: { code: "asc" } });
    const filtered = q
      ? brands.filter((b) => b.code.toLowerCase().includes(q) || b.name.toLowerCase().includes(q))
      : brands;
    return ok(filtered.map((b) => ({ ...b, fileTypes: JSON.parse(b.fileTypes || "[]") })));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("ADMIN", "EDITOR");
    const body = (await req.json()) as { code?: string; name?: string; division?: string; status?: string };
    if (!body.code || !body.name) return fail(400, "code and name are required");
    const code = body.code.toUpperCase().trim();
    const exists = await db.brand.findUnique({ where: { code } });
    if (exists) return fail(409, `Brand code ${code} already exists`);
    const brand = await db.brand.create({
      data: { code, name: body.name.trim(), division: body.division || "SPORTS", status: body.status || "ACTIVE" },
    });
    await audit(actor.email, "BRAND_CREATED", code, body);
    return ok(brand, 201);
  } catch (e) {
    return handleError(e);
  }
}
