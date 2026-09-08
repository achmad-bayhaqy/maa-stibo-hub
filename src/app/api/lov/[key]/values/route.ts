import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { audit, fail, handleError, ok } from "@/lib/api-helpers";

type Params = { params: Promise<{ key: string }> };

/** List values of an LOV table (paginated, searchable). */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requireUser();
    const { key } = await params;
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").toLowerCase();
    const page = Math.max(Number(sp.get("page") ?? "1"), 1);
    const pageSize = Math.min(Number(sp.get("pageSize") ?? "60"), 200);
    const where: Record<string, unknown> = q
      ? { tableKey: key, OR: [{ code: { contains: q } }, { label: { contains: q } }] }
      : { tableKey: key };
    const total = await db.lovValue.count({ where });
    const items = await db.lovValue.findMany({ where, orderBy: { code: "asc" }, skip: (page - 1) * pageSize, take: pageSize });
    return ok({ items, total, page, pageSize });
  } catch (e) {
    return handleError(e);
  }
}

/** Add a value to an LOV table (EDITOR+). */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole("ADMIN", "EDITOR");
    const { key } = await params;
    const body = (await req.json()) as { code?: string; label?: string };
    const code = (body.code ?? "").trim();
    if (!code) return fail(400, "code is required");
    const table = await db.lovTable.findUnique({ where: { key } });
    if (!table) return fail(404, "LOV table not found");
    const dup = await db.lovValue.findFirst({ where: { tableKey: key, code } });
    if (dup) return fail(409, `Value "${code}" already exists in ${key}`);
    const value = await db.lovValue.create({ data: { tableKey: key, code, label: body.label?.trim() || code } });
    await audit(actor.email, "LOV_VALUE_CREATED", `${key}/${code}`);
    return ok(value, 201);
  } catch (e) {
    return handleError(e);
  }
}
