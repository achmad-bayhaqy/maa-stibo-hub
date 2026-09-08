import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await db.user.count();
    return NextResponse.json({ status: "ok", service: "stibo-hub", time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "degraded", service: "stibo-hub" }, { status: 500 });
  }
}
