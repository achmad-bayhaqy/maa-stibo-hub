import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { audit, fail, handleError, ok } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

/** id may be a doc id OR a slug. */
async function findDoc(id: string) {
  return (await db.docPage.findUnique({ where: { id } })) ?? (await db.docPage.findUnique({ where: { slug: id } }));
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    const page = await findDoc(id);
    if (!page) return fail(404, "Documentation page not found");
    return ok(page);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole("ADMIN", "EDITOR");
    const { id } = await params;
    const page = await findDoc(id);
    if (!page) return fail(404, "Documentation page not found");
    const body = (await req.json()) as { title?: string; category?: string; summary?: string; bodyContent?: string; order?: number };
    const data: Record<string, unknown> = { updatedBy: actor.email };
    if (body.title !== undefined) data.title = body.title;
    if (body.category !== undefined) data.category = body.category;
    if (body.summary !== undefined) data.summary = body.summary;
    if (body.bodyContent !== undefined) data.body = body.bodyContent;
    if (body.order !== undefined) data.order = body.order;
    const updated = await db.docPage.update({ where: { id: page.id }, data });
    await audit(actor.email, "DOC_UPDATED", page.slug, { fields: Object.keys(data) });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole("ADMIN");
    const { id } = await params;
    const page = await findDoc(id);
    if (!page) return fail(404, "Documentation page not found");
    await db.docPage.delete({ where: { id: page.id } });
    await audit(actor.email, "DOC_DELETED", page.slug, { title: page.title });
    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
