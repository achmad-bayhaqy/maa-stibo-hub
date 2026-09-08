import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleError, ok } from "@/lib/api-helpers";

/**
 * GET /api/lov/options — wizard dropdown option sets, all sourced from the
 * MDD LOV tables (same lists as the existing MAP Portal). Placeholder header
 * rows that leaked into the source spreadsheets are filtered out.
 */
export async function GET(_req: NextRequest) {
  try {
    await requireUser();

    const [lovValues, namingRoutes] = await Promise.all([
      db.lovValue.findMany({
        where: { tableKey: { in: ["COUNTRY_LOV", "COMPANY_CODE_LOV", "SBU_LOV", "BRAND_LOV", "SEASON_LOV", "BY_ARTICLE_TYPE"] } },
        orderBy: [{ tableKey: "asc" }, { code: "asc" }],
      }),
      db.namingRoute.findMany({}),
    ]);

    const isPlaceholder = (code: string, label: string) =>
      /^(values? of lov|value id of lov|to be filled|article description|size code$|color code$|vendor id$|sports category name$)$/i
        .test(code.trim()) ||
      /^(values? of lov|value id of lov|to be filled)/i.test(label.trim());

    const dedupe = (rows: Array<{ code: string; label: string }>) => {
      const byCode = new Map<string, { code: string; label: string }>();
      for (const r of rows) {
        const k = r.code.toLowerCase();
        const prev = byCode.get(k);
        // prefer the richer label when a code appears twice (placeholder rows
        // like "Value" precede the real one in the source sheets)
        if (!prev || (r.label.length > prev.label.length && !isPlaceholder(r.code, r.label))) byCode.set(k, r);
      }
      return Array.from(byCode.values());
    };

    const group = (key: string) =>
      dedupe(
        lovValues
          .filter((v) => v.tableKey === key && !isPlaceholder(v.code, v.label))
          .map((v) => ({ code: v.code, label: v.label }))
      );

    // File types observed in naming routes; split by inline/licensed when determinable
    const fileTypeMap = new Map<string, Set<string>>();
    for (const r of namingRoutes) {
      const ft = r.fileType?.trim();
      if (!ft) continue;
      const key = r.inline?.toLowerCase().startsWith("lic") ? "Licensed" : "Inline";
      if (!fileTypeMap.has(key)) fileTypeMap.set(key, new Set());
      fileTypeMap.get(key)!.add(ft);
    }

    // Season years: sensible rolling window like the portal
    const y = new Date().getFullYear();
    const years = Array.from({ length: 8 }, (_, i) => String(y - 1 + i));

    return ok({
      countries: group("COUNTRY_LOV"),
      companies: group("COMPANY_CODE_LOV"),
      sbus: group("SBU_LOV"),
      brands: group("BRAND_LOV"),
      seasons: group("SEASON_LOV"),
      licenseTypes: (() => {
        const rows = group("BY_ARTICLE_TYPE").filter((v) => /^(inline|license)$/i.test(v.code));
        return rows.length ? rows : [{ code: "Inline", label: "Inline" }, { code: "License", label: "License" }];
      })(),
      fileTypes: {
        Inline: Array.from(fileTypeMap.get("Inline") ?? []).sort(),
        Licensed: Array.from(fileTypeMap.get("Licensed") ?? []).sort(),
      },
      years,
      multiMono: [
        { code: "Multi", label: "Multi" },
        { code: "Mono", label: "Mono" },
      ],
    });
  } catch (e) {
    return handleError(e);
  }
}
