import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/auth";

export function ok(data: unknown, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 });
}

export function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export function handleError(e: unknown) {
  if (e instanceof HttpError) return fail(e.status, e.message);
  console.error("[api]", e);
  // never leak internal error details (Prisma/DB/stack) to the client
  return fail(500, "Internal server error — check server logs for details");
}

export async function audit(actor: string, action: string, target = "", detail: unknown = {}) {
  try {
    await db.auditLog.create({
      data: { actor, action, target: target.slice(0, 200), detail: JSON.stringify(detail).slice(0, 4000) },
    });
  } catch (e) {
    console.error("[audit]", e);
  }
}

export function paginate<T>(items: T[], page = 1, pageSize = 25) {
  const total = items.length;
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total, page, pageSize };
}
