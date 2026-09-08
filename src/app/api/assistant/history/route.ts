import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit, handleError, ok } from "@/lib/api-helpers";

/** Assistant Q&A history for the signed-in user (last 60 messages, chronological). */
export async function GET() {
  try {
    const user = await requireUser();
    const rows = await db.chatMessage.findMany({
      where: { userEmail: user.email, mode: "qa" },
      orderBy: { createdAt: "desc" },
      take: 60,
    });
    const messages = rows.reverse().map((m) => ({
      id: m.id, role: m.role, content: m.content, createdAt: m.createdAt.toISOString(),
      meta: safeParse(m.meta),
    }));
    return ok({ messages });
  } catch (e) {
    return handleError(e);
  }
}

function safeParse(s: string): Record<string, unknown> {
  try { return JSON.parse(s) as Record<string, unknown>; } catch { return {}; }
}

/** Clear current user's Q&A history. */
export async function DELETE() {
  try {
    const user = await requireUser();
    await db.chatMessage.deleteMany({ where: { userEmail: user.email, mode: "qa" } });
    await audit(user.email, "ASSISTANT_HISTORY_CLEARED");
    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
