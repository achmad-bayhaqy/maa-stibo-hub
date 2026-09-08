import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { audit, fail, handleError, ok } from "@/lib/api-helpers";

/** RNA (Brand Reporting Structure): list + search (all) / create (EDITOR+). */
export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").toLowerCase();
    const country = sp.get("country") ?? "";
    const page = Math.max(Number(sp.get("page") ?? "1"), 1);
    const pageSize = Math.min(Number(sp.get("pageSize") ?? "25"), 200);
    const where: Record<string, unknown> = {};
    if (country) where.country = country;
    if (q) {
      where.OR = [
        { brandCode: { contains: q } }, { brandName: { contains: q } }, { sbu: { contains: q } },
        { subSbu: { contains: q } }, { compCode: { contains: q } }, { reportingBrandCode: { contains: q } },
      ];
    }
    const total = await db.rnaLookup.count({ where });
    const items = await db.rnaLookup.findMany({ where, orderBy: [{ country: "asc" }, { brandCode: "asc" }], skip: (page - 1) * pageSize, take: pageSize });
    const countries = await db.rnaLookup.groupBy({ by: ["country"], _count: { country: true } });
    return ok({ items, total, page, pageSize, countries: countries.map((c) => ({ country: c.country, count: c._count.country })) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("ADMIN", "EDITOR");
    const body = (await req.json()) as Partial<Record<string, string>>;
    if (!body.brandCode?.trim() || !body.country?.trim() || !body.compCode?.trim()) {
      return fail(400, "country, compCode, and brandCode are required");
    }
    const row = await db.rnaLookup.create({
      data: {
        country: body.country.trim().toUpperCase(),
        compCode: body.compCode.trim(),
        sbuGrouping: body.sbuGrouping?.trim() ?? "",
        subSbu: body.subSbu?.trim() ?? "",
        sbu: body.sbu?.trim() ?? "",
        brandGroup: body.brandGroup?.trim() ?? "",
        brandCategory: body.brandCategory?.trim() ?? "",
        brandType: body.brandType?.trim() ?? "",
        brandName: body.brandName?.trim() ?? "",
        brandCode: body.brandCode.trim().toUpperCase(),
        reportingBrandCode: body.reportingBrandCode?.trim() ?? "",
        reportingBrandName: body.reportingBrandName?.trim() ?? "",
      },
    });
    await audit(actor.email, "RNA_CREATED", `${row.country}/${row.brandCode}`);
    return ok(row, 201);
  } catch (e) {
    return handleError(e);
  }
}
