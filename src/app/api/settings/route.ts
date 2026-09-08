import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { audit, handleError, ok } from "@/lib/api-helpers";
import { getStiboStatus } from "@/lib/stibo-config";

export async function GET() {
  try {
    await requireUser();
    const settings = await db.setting.findMany();
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    const stibo = await getStiboStatus();
    return ok({
      sendMode: map.sendMode ?? "MOCK",
      stiboEndpoints: JSON.parse(map.stiboEndpoints || "{}"),
      oidcConfigured: stibo.configured,
      stiboSecrets: {
        source: stibo.source, // env | secrets-manager | none
        clientIdMasked: stibo.clientIdMasked,
        tokenUrlHost: stibo.tokenUrlHost,
        endpointsReady: stibo.endpointsReady,
      },
      awsRegion: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1",
      resourcePrefix: "stibo-",
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireRole("ADMIN");
    const body = (await req.json()) as { sendMode?: "MOCK" | "LIVE" };
    if (body.sendMode) {
      await db.setting.upsert({ where: { key: "sendMode" }, update: { value: body.sendMode }, create: { key: "sendMode", value: body.sendMode } });
      await audit(user.email, "SETTINGS_UPDATED", "sendMode", { sendMode: body.sendMode });
    }
    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
