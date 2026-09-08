import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handleError, ok } from "@/lib/api-helpers";

export async function GET() {
  try {
    await requireRole("ADMIN", "EDITOR", "VIEWER");
    const [uploads, sent, jobs, users, rules, brands, recent, byBrand, byEndpoint, byDay] = await Promise.all([
      db.upload.count(),
      db.upload.count({ where: { status: "SENT" } }),
      db.sendJob.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      db.user.count(),
      db.mappingRule.count(),
      db.brand.count(),
      db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
      db.upload.groupBy({ by: ["brandCode"], _count: { brandCode: true } }),
      db.sendJob.groupBy({ by: ["endpoint"], _count: { endpoint: true } }),
      db.sendJob.groupBy({ by: ["status"], _count: { status: true } }),
    ]);

    const totalRows = await db.upload.aggregate({ _sum: { totalRows: true } });
    const success = jobs.filter((j) => j.status === "SUCCESS").length;
    const successRate = jobs.length ? Math.round((success / jobs.length) * 100) : 0;

    return ok({
      kpi: {
        uploads,
        sent,
        totalRows: totalRows._sum.totalRows ?? 0,
        successRate,
        users,
        rules,
        brands,
        successJobs: success,
        failedJobs: jobs.length - success,
      },
      byBrand: byBrand.map((b) => ({ brand: b.brandCode || "—", count: b._count.brandCode })).sort((a, b) => b.count - a.count).slice(0, 8),
      byEndpoint: byEndpoint.map((b) => ({ endpoint: b.endpoint, count: b._count.endpoint })),
      byStatus: byStatusHelper(byDay),
      recentActivity: recent,
      recentJobs: jobs.slice(0, 6),
    });
  } catch (e) {
    return handleError(e);
  }
}

function byStatusHelper(byDay: Array<{ status: string; _count: { status: number } }>) {
  return byDay.map((s) => ({ status: s.status, count: s._count.status }));
}
