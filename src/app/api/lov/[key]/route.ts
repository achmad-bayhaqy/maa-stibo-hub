import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fail, handleError, ok, paginate } from "@/lib/api-helpers";

type Params = { params: Promise<{ key: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requireUser();
    const { key } = await params;
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").toLowerCase();
    const page = Number(sp.get("page") ?? "1");
    const pageSize = Math.min(Number(sp.get("pageSize") ?? "50"), 200);
    const table = await db.lovTable.findUnique({ where: { key } });
    if (!table) return fail(404, "LOV table not found");
    const where: Record<string, unknown> = q
      ? { tableKey: key, OR: [{ code: { contains: q } }, { label: { contains: q } }] }
      : { tableKey: key };
    const total = await db.lovValue.count({ where });
    const items = await db.lovValue.findMany({ where, orderBy: { code: "asc" }, skip: (page - 1) * pageSize, take: pageSize });
    return ok({ table, items, total, page, pageSize });
  } catch (e) {
    return handleError(e);
  }
}
