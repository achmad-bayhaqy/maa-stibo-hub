import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, requireRole } from "@/lib/auth";
import { audit, fail, handleError, ok, paginate } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireRole("ADMIN", "EDITOR", "VIEWER");
    const users = await db.user.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, name: true, role: true, active: true, lastLoginAt: true, createdAt: true },
    });
    const q = req.nextUrl.searchParams.get("q")?.toLowerCase() ?? "";
    const filtered = q
      ? users.filter((u) => u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q))
      : users;
    return ok(filtered);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("ADMIN");
    const body = (await req.json()) as { email?: string; name?: string; role?: string; password?: string };
    if (!body.email || !body.name || !body.password) return fail(400, "email, name, password are required");
    const role = ["ADMIN", "EDITOR", "VIEWER"].includes(body.role ?? "") ? body.role! : "VIEWER";
    const exists = await db.user.findUnique({ where: { email: body.email.toLowerCase().trim() } });
    if (exists) return fail(409, "Email already registered");
    const user = await db.user.create({
      data: {
        email: body.email.toLowerCase().trim(),
        name: body.name.trim(),
        role,
        passwordHash: hashPassword(body.password),
      },
    });
    await audit(actor.email, "USER_CREATED", user.email, { role });
    return ok({ id: user.id }, 201);
  } catch (e) {
    return handleError(e);
  }
}
