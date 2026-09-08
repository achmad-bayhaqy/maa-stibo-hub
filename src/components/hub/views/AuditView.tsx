"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, ChevronLeft, ChevronRight, ScrollText } from "lucide-react";

interface AuditRow { id: string; actor: string; action: string; target: string; detail: string; createdAt: string }

const ACTION_CLS: Record<string, string> = {
  LOGIN_SUCCESS: "text-emerald-600", LOGIN_FAILED: "text-red-600",
  STEP_SEND_SUCCESS: "text-emerald-600", STEP_SEND_FAILED: "text-red-600",
  UPLOAD_PARSED: "text-sky-600", UPLOAD_TRANSFORMED: "text-indigo-600",
};

export function AuditView() {
  const [data, setData] = useState<{ items: AuditRow[]; total: number; page: number; pageSize: number } | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");

  useEffect(() => {
    api<{ items: AuditRow[]; total: number; page: number; pageSize: number }>(`/api/audit?page=${page}&pageSize=30&q=${encodeURIComponent(q)}`).then(setData).catch(() => undefined);
  }, [page, q]);

  const pages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Audit log</h2>
          <p className="text-xs text-slate-500 mt-0.5">Jejak lengkap aktivitas portal — siap untuk review compliance.</p>
        </div>
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search actor / action…" className="pl-8 h-9 w-56 text-xs" />
        </div>
      </div>

      <div className="mt-5 rounded-xl border bg-white overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b"><tr>{["Time", "Actor", "Action", "Target", ""].map((h) => <th key={h} className="text-left px-4 py-2.5 font-semibold text-slate-500">{h}</th>)}</tr></thead>
          <tbody>
            {!data && <tr><td colSpan={5} className="px-4 py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-300" /></td></tr>}
            {data?.items.map((a) => (
              <tr key={a.id} className="border-b last:border-0 hover:bg-slate-50/60">
                <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{new Date(a.createdAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" })}</td>
                <td className="px-4 py-2.5 font-medium text-slate-700">{a.actor}</td>
                <td className={`px-4 py-2.5 font-mono text-[11px] font-semibold ${ACTION_CLS[a.action] ?? "text-slate-600"}`}>{a.action}</td>
                <td className="px-4 py-2.5 text-slate-500 truncate max-w-[260px]">{a.target || "—"}</td>
                <td className="px-4 py-2.5 text-right text-slate-300"><ScrollText className="h-3.5 w-3.5 inline" /></td>
              </tr>
            ))}
            {data?.items.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No entries.</td></tr>}
          </tbody>
        </table>
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t text-xs text-slate-500">
            <span>Page {page} of {pages} · {data?.total} entries</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-3.5 w-3.5" /></Button>
              <Button variant="outline" size="sm" className="h-7" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
