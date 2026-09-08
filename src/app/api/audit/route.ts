import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handleError, ok, paginate } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireRole("ADMIN", "EDITOR", "VIEWER");
    const sp = req.nextUrl.searchParams;
    const page = Math.max(Number(sp.get("page") ?? "1"), 1);
    const pageSize = Math.min(Number(sp.get("pageSize") ?? "30"), 100);
    const q = (sp.get("q") ?? "").toLowerCase();
    const all = await db.auditLog.findMany({ orderBy: { createdAt: "desc" } });
    const filtered = q ? all.filter((a) => a.actor.toLowerCase().includes(q) || a.action.toLowerCase().includes(q) || a.target.toLowerCase().includes(q)) : all;
    return ok(paginate(filtered, page, pageSize));
  } catch (e) {
    return handleError(e);
  }
}
