import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createToken, SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { audit, fail, handleError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = (await req.json()) as { email?: string; password?: string };
    if (!email || !password) return fail(400, "Email and password are required");
    const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
      await audit(email || "unknown", "LOGIN_FAILED");
      return fail(401, "Invalid email or password");
    }
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const sessionUser = { id: user.id, email: user.email, name: user.name, role: user.role as "ADMIN" };
    const token = createToken(sessionUser);
    await audit(user.email, "LOGIN_SUCCESS", user.email);
    const res = NextResponse.json({ user: sessionUser });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true, sameSite: "lax", path: "/", maxAge: 12 * 60 * 60,
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  } catch (e) {
    return handleError(e);
  }
}
