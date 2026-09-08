"use client";

import { useEffect, useState } from "react";
import { api, useHub } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Send, CheckCircle2, XCircle, Users, Layers, Boxes, Activity, Loader2, Sparkles, CircleDashed } from "lucide-react";

interface Dash {
  kpi: { uploads: number; sent: number; totalRows: number; successRate: number; users: number; rules: number; brands: number; successJobs: number; failedJobs: number };
  byBrand: Array<{ brand: string; count: number }>;
  byEndpoint: Array<{ endpoint: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  recentActivity: Array<{ id: string; actor: string; action: string; target: string; createdAt: string }>;
  recentJobs: Array<{ id: string; filename: string; endpoint: string; mode: string; status: string; bgId: string; createdAt: string }>;
}

export function DashboardView() {
  const [data, setData] = useState<Dash | null>(null);
  const { setView, setMasterTab, setAssistantMode, user } = useHub();

  useEffect(() => { api<Dash>("/api/dashboard").then(setData).catch(() => undefined); }, []);

  if (!data) return <CenterLoading />;
  const k = data.kpi;

  const checklist: Array<{ label: string; done: boolean; action: () => void }> = [
    { label: "Pelajari panduan sistem di Documentation Center", done: true, action: () => setView("docs") },
    { label: "Coba tanya Assistant mode Q&A", done: true, action: () => { setAssistantMode("qa"); setView("assistant"); } },
    { label: "Lakukan upload + transform pertama (MOCK)", done: k.uploads > 0, action: () => { setAssistantMode("pipeline"); setView("assistant"); } },
    { label: "Kirim data ke Stibo (bgId tercatat)", done: k.sent > 0, action: () => setView("files") },
    ...(user?.role !== "VIEWER" ? [{ label: "Lengkapi master data (brand/atribut/rule)", done: k.brands > 0 && k.rules > 0, action: () => { setMasterTab("brands"); setView("master"); } }] : []),
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Pipeline overview</h2>
        <p className="text-xs text-slate-500 mt-0.5">Aktivitas integrasi master data ke Stibo STEP · lingkungan dev.</p>
      </div>

      {/* Onboarding checklist (btool onboarding-tour inspired) */}
      {!checklist.every((c) => c.done) && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-500" /> Mulai dengan STIBO Hub</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-2">
            {checklist.map((c) => (
              <button key={c.label} onClick={c.action}
                className={cn("flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-xs transition-colors hover:bg-slate-50", c.done ? "border-emerald-100 bg-emerald-50/40" : "bg-white")}>
                {c.done ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> : <CircleDashed className="h-4 w-4 text-slate-300 shrink-0" />}
                <span className={cn("font-medium", c.done ? "text-emerald-700 line-through" : "text-slate-700")}>{c.label}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total uploads", value: k.uploads, icon: FileSpreadsheet, cls: "text-sky-600 bg-sky-50" },
          { label: "Rows ingested", value: k.totalRows.toLocaleString(), icon: Layers, cls: "text-indigo-600 bg-indigo-50" },
          { label: "Sent to Stibo", value: k.sent, icon: Send, cls: "text-emerald-600 bg-emerald-50" },
          { label: "Send success rate", value: `${k.successRate}%`, icon: k.failedJobs ? XCircle : CheckCircle2, cls: k.failedJobs ? "text-red-600 bg-red-50" : "text-emerald-600 bg-emerald-50" },
        ].map((s) => (
          <Card key={s.label} className="border shadow-sm">
            <CardContent className="p-4">
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mb-3", s.cls)}><s.icon className="h-4.5 w-4.5 h-5 w-5" /></div>
              <div className="text-2xl font-bold text-slate-800">{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="border shadow-sm md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Uploads per brand</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {data.byBrand.length === 0 && <Empty text="Belum ada data upload." />}
            {data.byBrand.map((b) => (
              <div key={b.brand} className="flex items-center gap-3">
                <span className="w-14 text-xs font-mono font-semibold text-slate-600 truncate">{b.brand}</span>
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500" style={{ width: `${(b.count / Math.max(...data.byBrand.map((x) => x.count))) * 100}%` }} />
                </div>
                <span className="text-xs text-slate-500 w-6 text-right">{b.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Master data assets</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-2 text-center">
              {[
                { icon: Boxes, v: k.brands, l: "Brands" },
                { icon: Layers, v: k.rules.toLocaleString(), l: "Rules" },
                { icon: Users, v: k.users, l: "Users" },
              ].map((x) => (
                <div key={x.l} className="rounded-lg bg-slate-50 py-3">
                  <x.icon className="h-4 w-4 mx-auto text-slate-400" />
                  <div className="text-lg font-bold text-slate-700 mt-1">{x.v}</div>
                  <div className="text-[10px] text-slate-400">{x.l}</div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm">IIEP endpoints</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.byEndpoint.length === 0 && <Empty text="Belum ada pengiriman." />}
              {data.byEndpoint.map((e) => (
                <div key={e.endpoint} className="flex items-center justify-between text-xs border rounded-lg px-3 py-2">
                  <span className="font-mono text-[11px] text-slate-600">{e.endpoint}</span>
                  <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">{e.count}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-slate-400" /> Recent activity</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {data.recentActivity.map((a) => (
              <div key={a.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <span className="font-semibold text-slate-700">{a.actor}</span>
                  <span className="text-slate-400"> · {a.action.replaceAll("_", " ").toLowerCase()}</span>
                  <div className="text-[10px] text-slate-400 truncate">{a.target || "—"}</div>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">{new Date(a.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Send className="h-4 w-4 text-slate-400" /> Recent Stibo jobs</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {data.recentJobs.length === 0 && <Empty text="Belum ada job kirim." />}
            {data.recentJobs.map((j) => (
              <div key={j.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-700">{j.filename}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{j.endpoint} · {j.mode} · bgId {j.bgId || "—"}</div>
                </div>
                <Badge variant="outline" className={j.status === "SUCCESS" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}>{j.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-6 text-center text-xs text-slate-400">{text}</div>;
}
function CenterLoading() {
  return <div className="py-24 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
}
