import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { audit, fail, handleError, ok } from "@/lib/api-helpers";
import { runMappingEngine, type EngineRule, type WizardContext } from "@/lib/mapping";

type Params = { params: Promise<{ id: string }> };

export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole("ADMIN", "EDITOR");
    const { id } = await params;
    const upload = await db.upload.findUnique({ where: { id } });
    if (!upload) return fail(404, "Upload not found");

    const body = (await req.json()) as {
      compCode?: string; sbu?: string; brandCode?: string; brandName?: string;
      season?: string; seasonYear?: string; country?: string; endpoint?: string;
    };

    const ctx: WizardContext = {
      compCode: body.compCode ?? upload.compCode ?? "0888",
      sbu: body.sbu ?? upload.sbu ?? "SP",
      brandCode: body.brandCode ?? upload.brandCode,
      brandName: body.brandName ?? upload.brandName,
      season: body.season ?? upload.season,
      seasonYear: body.seasonYear ?? (body.season ?? upload.season).replace(/^[A-Z]+/i, ""),
      country: body.country ?? upload.country,
      flow: upload.flow,
      endpoint: body.endpoint ?? upload.endpoint,
      actor: user.email,
    };

    if (!ctx.brandCode) return fail(400, "Brand is required — set it in the wizard");
    if (!ctx.country) return fail(400, "Country is required — set it in the wizard");
    if (!ctx.season) return fail(400, "Season is required — set it in the wizard");

    // load brand rules (fallback to GLOBAL template)
    let ruleRows = await db.mappingRule.findMany({ where: { brandCode: ctx.brandCode, active: true } });
    if (ruleRows.length === 0) {
      ruleRows = await db.mappingRule.findMany({ where: { brandCode: "GLOBAL", active: true } });
    }
    const engineRules: EngineRule[] = ruleRows.map((r) => ({
      attributeId: r.attributeId,
      attribute: r.attribute,
      mappingType: r.mappingType,
      sourceField: r.sourceField,
      validation: r.validation,
      logic: r.logic,
      cluster: r.cluster,
      description: r.description,
    }));

    const [rnaRows, lovTables] = await Promise.all([
      db.rnaLookup.findMany({ where: { brandCode: ctx.brandCode } }).then((rows) =>
        rows.length ? rows : db.rnaLookup.findMany({ take: 200 })
      ),
      db.lovValue.findMany({}),
    ]);

    const bundle = {
      rna: rnaRows.map((r) => ({
        compCode: r.compCode, sbu: r.sbu, brandCode: r.brandCode,
        brandGroup: r.brandGroup, brandCategory: r.brandCategory, brandType: r.brandType,
        brandName: r.brandName, reportingBrandCode: r.reportingBrandCode, reportingBrandName: r.reportingBrandName,
      })),
      lov: lovTables.reduce<Record<string, Array<{ code: string; label: string }>>>((acc, v) => {
        (acc[v.tableKey] ??= []).push({ code: v.code, label: v.label });
        return acc;
      }, {}),
    };

    const rawRows = JSON.parse(upload.sampleRaw || "[]") as Array<Record<string, string>>;
    const { mapped, stats } = runMappingEngine(rawRows, engineRules, ctx, bundle, 500);

    await db.upload.update({
      where: { id },
      data: {
        compCode: ctx.compCode, sbu: ctx.sbu, brandCode: ctx.brandCode, brandName: ctx.brandName,
        season: ctx.season, country: ctx.country, endpoint: ctx.endpoint,
        wizard: JSON.stringify(ctx),
        status: "MAPPED",
        processedRows: stats.mappedRows,
        mappedRows: stats.mappedRows,
        warnRows: stats.rowsWithManual + stats.rowsWithAi,
        errorRows: stats.rowsWithError,
        mappedSample: JSON.stringify(mapped.slice(0, 200)),
        issues: JSON.stringify(stats.topIssues),
        mode: process.env.STIBO_CLIENT_ID ? "LIVE-READY" : "MOCK",
      },
    });

    await audit(user.email, "UPLOAD_TRANSFORMED", upload.filename, {
      uploadId: id, rows: stats.mappedRows, brand: ctx.brandCode,
      coverage: stats.attributeCoverage,
    });

    return ok({ stats, wizard: ctx, rulesUsed: engineRules.length });
  } catch (e) {
    return handleError(e);
  }
}
