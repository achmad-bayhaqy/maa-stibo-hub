import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createToken, SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { audit, fail, handleError } from "@/lib/api-helpers";
import { rateLimited, record, clientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = (await req.json()) as { email?: string; password?: string };
    if (!email || !password) return fail(400, "Email and password are required");
    // brute-force guard: max 5 failed attempts / 15 min per email or IP
    const emailKey = email.trim();
    const ip = clientIp(req);
    if (rateLimited("login-fail", emailKey) || rateLimited("login-fail-ip", ip)) {
      await audit(emailKey, "LOGIN_RATE_LIMITED");
      return fail(429, "Too many failed attempts — try again in 15 minutes");
    }
    const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
      record("login-fail", emailKey);
      record("login-fail-ip", ip);
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
      // enable only when serving over HTTPS (set COOKIE_SECURE=true behind ALB/CloudFront)
      secure: process.env.COOKIE_SECURE === "true",
    });
    return res;
  } catch (e) {
    return handleError(e);
  }
}
