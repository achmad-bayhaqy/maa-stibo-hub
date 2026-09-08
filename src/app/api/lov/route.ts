import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleError, ok } from "@/lib/api-helpers";

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
