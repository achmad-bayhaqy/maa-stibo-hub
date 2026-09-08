import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit, fail, handleError, ok } from "@/lib/api-helpers";
import { ask } from "@/lib/assistant";

/** Assistant Q&A — deterministic DB-backed engine. Persists the conversation. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as { question?: string };
    const question = (body.question ?? "").slice(0, 1000).trim();
    if (!question) return fail(400, "question is required");

    const result = await ask(question, { email: user.email, name: user.name });

    // Persist conversation (best-effort — Q&A must not fail if history write fails)
    try {
      await db.chatMessage.createMany({
        data: [
          { userEmail: user.email, role: "user", content: question, mode: "qa", meta: "{}" },
          {
            userEmail: user.email, role: "assistant", content: result.answer, mode: "qa",
            meta: JSON.stringify({ intent: result.intent, sources: result.sources, table: result.table ?? null, chips: result.chips, deepLink: result.deepLink ?? null }),
          },
        ],
      });
    } catch (e) {
      console.error("[assistant] history write failed", e);
    }

    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}
