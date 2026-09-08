import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { audit, fail, handleError, ok } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const tables = await db.lovTable.findMany({ orderBy: { key: "asc" } });
    const withCounts = await db.lovValue.groupBy({ by: ["tableKey"], _count: { tableKey: true } });
    const countMap = new Map(withCounts.map((c) => [c.tableKey, c._count.tableKey]));
    return ok(tables.map((t) => ({ ...t, valueCount: countMap.get(t.key) ?? 0 })));
  } catch (e) {
    return handleError(e);
  }
}

/** Create a new LOV table (EDITOR+). */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("ADMIN", "EDITOR");
    const body = (await req.json()) as { key?: string; sheetName?: string };
    const key = (body.key ?? "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    if (!key) return fail(400, "key is required (A-Z, 0-9, underscore)");
    const exists = await db.lovTable.findUnique({ where: { key } });
    if (exists) return fail(409, "LOV table key already exists");
    const table = await db.lovTable.create({ data: { key, sheetName: body.sheetName?.trim() || key } });
    await audit(actor.email, "LOV_TABLE_CREATED", key);
    return ok(table, 201);
  } catch (e) {
    return handleError(e);
  }
}
