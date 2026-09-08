import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { audit, fail, handleError, ok } from "@/lib/api-helpers";

/** Documentation Center: list pages (all users) / create page (EDITOR+). */
export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").toLowerCase();
    const where = q
      ? { OR: [{ title: { contains: q } }, { summary: { contains: q } }, { body: { contains: q } }] }
      : {};
    const pages = await db.docPage.findMany({
      where,
      orderBy: [{ category: "asc" }, { order: "asc" }],
      select: { id: true, slug: true, title: true, category: true, order: true, summary: true, updatedBy: true, updatedAt: true },
    });
    return ok({ pages });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("ADMIN", "EDITOR");
    const body = (await req.json()) as { slug?: string; title?: string; category?: string; summary?: string; bodyContent?: string; order?: number };
    const slug = (body.slug ?? "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!slug || !body.title) return fail(400, "slug and title are required");
    const exists = await db.docPage.findUnique({ where: { slug } });
    if (exists) return fail(409, "Slug already exists");
    const page = await db.docPage.create({
      data: {
        slug, title: body.title,
        category: body.category || "Guide",
        summary: body.summary ?? "",
        body: body.bodyContent ?? "",
        order: body.order ?? 200,
        updatedBy: actor.email,
      },
    });
    await audit(actor.email, "DOC_CREATED", page.slug, { title: page.title });
    return ok(page, 201);
  } catch (e) {
    return handleError(e);
  }
}
