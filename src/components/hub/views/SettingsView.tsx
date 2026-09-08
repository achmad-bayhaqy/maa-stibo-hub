"use client";

import { useEffect, useState } from "react";
import { api, useHub } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { CircleCheck, CircleAlert, CloudCog, KeyRound, Send, Tag, Lock } from "lucide-react";

interface SettingsData {
  sendMode: "MOCK" | "LIVE";
  stiboEndpoints: Record<string, string>;
  oidcConfigured: boolean;
  stiboSecrets: {
    source: "env" | "secrets-manager" | "none";
    clientIdMasked: string;
    tokenUrlHost: string;
    endpointsReady: string[];
  };
  awsRegion: string;
  resourcePrefix: string;
}

export function SettingsView() {
  const { user, setSendMode } = useHub();
  const { toast } = useToast();
  const [data, setData] = useState<SettingsData | null>(null);
  const isAdmin = user?.role === "ADMIN";

  useEffect(() => { api<SettingsData>("/api/settings").then(setData).catch(() => undefined); }, []);

  const toggleMode = async (live: boolean) => {
    const mode = live ? "LIVE" : "MOCK";
    try {
      await api("/api/settings", { method: "PUT", body: JSON.stringify({ sendMode: mode }) });
      setSendMode(mode);
      toast({ title: `Send mode: ${mode}`, description: live ? "Careful — the next send will POST to the Stibo IIEP." : "Sends will be simulated locally." });
    } catch (e) {
      toast({ title: "Update failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  if (!data) return <div className="py-24 flex justify-center"><CloudCog className="h-6 w-6 animate-pulse text-slate-300" /></div>;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Settings</h2>
        <p className="text-xs text-slate-500 mt-0.5">Konfigurasi integrasi Stibo &amp; mode pengiriman.</p>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Send className="h-4 w-4 text-slate-400" /> Send mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border p-4">
            <div>
              <div className="text-sm font-semibold text-slate-700">{data.sendMode === "MOCK" ? "MOCK — local simulation" : "LIVE — send to Stibo"}</div>
              <p className="text-xs text-slate-500 mt-0.5 max-w-md">
                Mock mode mensimulasikan OIDC + POST dan menghasilkan bgId lokal — aman untuk demo/training.
                Live mode melakukan POST sungguhan ke IIEP endpoints.
              </p>
            </div>
            <Switch checked={data.sendMode === "LIVE"} disabled={!isAdmin || !data.oidcConfigured} onCheckedChange={toggleMode} />
          </div>
          {!data.oidcConfigured && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              <CircleAlert className="h-4 w-4 mt-0.5 shrink-0" />
              Stibo OIDC credentials are not available yet (STIBO_* env vars or AWS Secrets Manager via STIBO_SECRET_ID). Live mode stays locked until credentials are configured.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><KeyRound className="h-4 w-4 text-slate-400" /> Stibo IIEP endpoints</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(data.stiboEndpoints).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-xs">
              <span className="font-mono font-semibold text-slate-600">{k}</span>
              {v ? (
                <span className="font-mono text-[10px] text-slate-400 truncate max-w-[280px]" title={v}>{v}</span>
              ) : (
                <Badge variant="outline" className="border-slate-200 text-slate-400">not configured</Badge>
              )}
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1 text-xs">
            {data.oidcConfigured ? <CircleCheck className="h-4 w-4 text-emerald-500" /> : <CircleAlert className="h-4 w-4 text-amber-500" />}
            <span className="text-slate-500">OIDC client credentials: {data.oidcConfigured ? "configured" : "missing (mock only)"}</span>
          </div>
          {data.stiboSecrets && data.stiboSecrets.source !== "none" && (
            <div className="rounded-lg border-2 border-black bg-neutral-50 p-3 text-xs space-y-1.5">
              <div className="font-semibold text-neutral-700 flex items-center gap-1.5"><Lock className="h-3 w-3 text-[#DD1C24]" /> Credentials (stored securely server-side)</div>
              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
                <div className="flex justify-between gap-2"><span className="text-neutral-400">Source</span><span className="font-mono">{data.stiboSecrets.source === "env" ? "environment variables" : "AWS Secrets Manager"}</span></div>
                <div className="flex justify-between gap-2"><span className="text-neutral-400">Client ID</span><span className="font-mono">{data.stiboSecrets.clientIdMasked}</span></div>
                <div className="flex justify-between gap-2"><span className="text-neutral-400">Token host</span><span className="font-mono">{data.stiboSecrets.tokenUrlHost || "—"}</span></div>
                <div className="flex justify-between gap-2"><span className="text-neutral-400">Client secret</span><span className="font-mono">•••••••• (never displayed)</span></div>
              </div>
              <div className="text-[10px] text-neutral-400">Secrets are never sent to the browser — the API only exposes masked status.</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Tag className="h-4 w-4 text-slate-400" /> AWS deployment</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3 text-xs">
          {[
            ["Region", data.awsRegion], ["Resource prefix / tag", data.resourcePrefix],
            ["Deploy target", "ECS Fargate + ALB (stibo-hub)"], ["Database", "Amazon RDS PostgreSQL (stibo-hub-pg)"],
            ["Secrets", "Env vars / Secrets Manager (stibo/prod/*)"], ["Repository", "github.com/achmad-bayhaqy/maa-stibo-hub"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border px-3 py-2.5">
              <div className="text-[10px] text-slate-400">{k}</div>
              <div className="font-medium text-slate-700">{v}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
