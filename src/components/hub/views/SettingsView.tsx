"use client";

import { useEffect, useState } from "react";
import { api, useHub } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { CircleCheck, CircleAlert, CloudCog, KeyRound, Send, Tag } from "lucide-react";

interface SettingsData {
  sendMode: "MOCK" | "LIVE";
  stiboEndpoints: Record<string, string>;
  oidcConfigured: boolean;
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
      toast({ title: `Send mode: ${mode}`, description: live ? "Hati-hati — kirim berikutnya akan POST ke Stibo IIEP." : "Kirim akan disimulasikan secara lokal." });
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
              <div className="text-sm font-semibold text-slate-700">{data.sendMode === "MOCK" ? "MOCK — simulasi lokal" : "LIVE — kirim ke Stibo"}</div>
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
              Kredensial OIDC Stibo belum diset di environment (STIBO_TOKEN_URL, STIBO_CLIENT_ID, STIBO_CLIENT_SECRET + 3 endpoint URLs). Live mode terkunci sampai env tersedia.
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
