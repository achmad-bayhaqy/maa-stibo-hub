"use client";

import { useCallback, useEffect, useState } from "react";
import { api, useHub } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { FileSpreadsheet, Search, Loader2, Send, Trash2 } from "lucide-react";

interface UploadRecord {
  id: string; filename: string; size: number; status: string; mode: string;
  brandCode: string; brandName: string; season: string; country: string;
  flow: string; endpoint: string; totalRows: number; processedRows: number;
  createdBy: string; createdAt: string; filenameValid: boolean;
}
interface Job { id: string; bgId: string; status: string; httpStatus: number; mode: string; endpoint: string; durationMs: number; createdAt: string }

const chip: Record<string, string> = {
  PARSED: "border-sky-200 bg-sky-50 text-sky-700",
  MAPPED: "border-indigo-200 bg-indigo-50 text-indigo-700",
  SENT: "border-emerald-200 bg-emerald-50 text-emerald-700",
  FAILED: "border-red-200 bg-red-50 text-red-700",
};

export function FilesView() {
  const { user } = useHub();
  const { toast } = useToast();
  const [items, setItems] = useState<UploadRecord[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<{ upload: UploadRecord; sendJobs: Job[] } | null>(null);
  const canEdit = user?.role === "ADMIN" || user?.role === "EDITOR";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ items: UploadRecord[] }>(`/api/uploads?pageSize=50&q=${encodeURIComponent(q)}`);
      setItems(d.items);
    } finally { setLoading(false); }
  }, [q]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Uploads &amp; transformations</h2>
          <p className="text-xs text-slate-500 mt-0.5">History of files processed by the portal with their Stibo delivery status.</p>
        </div>
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search file / brand…" className="pl-9 w-64 h-9" />
        </div>
      </div>

      <div className="mt-5 rounded-xl border bg-white overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b">
            <tr>
              {["File", "Brand", "Season", "Rows", "Endpoint", "Status", "Created", ""].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 font-semibold text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="px-4 py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-300" /></td></tr>}
            {!loading && items.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">No uploads yet — start from the Assistant tab.</td></tr>
            )}
            {!loading && items.map((u) => (
              <tr key={u.id} className="border-b last:border-0 hover:bg-slate-50/60">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2 max-w-[280px]">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="truncate font-medium text-slate-700">{u.filename}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 font-mono font-semibold text-slate-600">{u.brandCode || "—"}</td>
                <td className="px-4 py-2.5 font-mono">{u.season || "—"}</td>
                <td className="px-4 py-2.5">{u.totalRows.toLocaleString()}</td>
                <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500">{u.endpoint}</td>
                <td className="px-4 py-2.5"><Badge variant="outline" className={chip[u.status] ?? ""}>{u.status}</Badge></td>
                <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-slate-500" onClick={async () => setDetail(await api<{ upload: UploadRecord; sendJobs: Job[] }>(`/api/uploads/${u.id}`))}>Detail</Button>
                    {canEdit && (
                      <Button variant="ghost" size="sm" className="h-7 text-red-500 hover:text-red-600"
                        onClick={async () => {
                          if (!confirm(`Delete ${u.filename}?`)) return;
                          await api(`/api/uploads/${u.id}`, { method: "DELETE" });
                          toast({ title: "Upload deleted" }); load();
                        }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="text-sm truncate pr-6">{detail?.upload.filename}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ["Brand", `${detail.upload.brandCode} ${detail.upload.brandName}`], ["Flow", detail.upload.flow],
                  ["Season", detail.upload.season || "—"], ["Country", detail.upload.country || "—"],
                  ["Rows", detail.upload.totalRows.toLocaleString()], ["Mode", detail.upload.mode],
                  ["Endpoint", detail.upload.endpoint], ["Created by", detail.upload.createdBy],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg border px-3 py-2">
                    <div className="text-[10px] text-slate-400">{k}</div>
                    <div className="font-medium text-slate-700 truncate">{v}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Send jobs</div>
                {detail.sendJobs.length === 0 && <div className="text-xs text-slate-400">Never sent to Stibo.</div>}
                <div className="space-y-2">
                  {detail.sendJobs.map((j) => (
                    <div key={j.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
                      <div>
                        <div className="font-mono text-[10px] text-slate-500">{j.endpoint} · {j.mode} · {j.durationMs}ms</div>
                        <div className="text-[10px] text-slate-400">bgId: {j.bgId || "—"} · HTTP {j.httpStatus}</div>
                      </div>
                      <Badge variant="outline" className={j.status === "SUCCESS" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}>{j.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
