"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useHub, api } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Bot, User, UploadCloud, FileSpreadsheet, Loader2, ArrowRight, CircleAlert,
  CircleCheck, Sparkles, PenLine, Cog, Send, ShieldAlert, History, Trash2, Wand2,
} from "lucide-react";

/* ─────────────────────────── types ─────────────────────────── */

interface NameInfo {
  compCode: string; sbu: string; brandSlug: string; flow: string; gender: string;
  season: string; country: string; seq: string; valid: boolean; endpoint: string; issues: string[];
}
interface UploadRecord {
  id: string; filename: string; size: number; status: string; mode: string;
  brandCode: string; brandName: string; season: string; country: string; sbu: string;
  compCode: string; flow: string; endpoint: string; totalRows: number; processedRows: number;
  mappedRows: number; warnRows: number; errorRows: number; filenameValid: boolean;
  createdBy: string; createdAt: string; sheetName: string;
}
interface Preview { headers: string[]; rows: Array<Record<string, string>>; totalRows: number; sheetName: string; sheets: string[] }
interface Stats {
  totalRows: number; mappedRows: number; rowsWithManual: number; rowsWithAi: number; rowsWithError: number;
  attributeCoverage: { mapped: number; manual: number; ai: number; blank: number };
  topIssues: Array<{ attributeId: string; attribute: string; type: string; count: number }>;
}
interface MappedRow { rowNo: number; values: Record<string, string>; statuses: Array<{ attributeId: string; attribute: string; value: string; status: string; note: string }>; mappedCount: number }
interface Job { id: string; bgId: string; status: string; httpStatus: number; mode: string; endpoint: string; responseSnippet: string; durationMs: number; createdAt: string }

type ChatItem =
  | { kind: "text"; role: "user" | "bot"; text: string }
  | { kind: "upload"; upload: UploadRecord; nameInfo: NameInfo; preview: Preview }
  | { kind: "wizard"; upload: UploadRecord; nameInfo?: NameInfo }
  | { kind: "result"; upload: UploadRecord; stats: Stats }
  | { kind: "sent"; job: Job; filename: string };

const COUNTRIES = ["ID", "MY", "PH", "SG", "TH", "VN", "KH"];
const SBUS = ["SP", "FQ"];
const ENDPOINTS = ["ARTICLE_PLANNING", "EAN_UPDATE", "ARTICLE_MAINTENANCE"];
const TYPE_STYLE: Record<string, { label: string; cls: string }> = {
  mapped: { label: "auto", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ai_suggested: { label: "AI", cls: "bg-violet-50 text-violet-700 border-violet-200" },
  manual_required: { label: "manual", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  blank: { label: "n/a", cls: "bg-slate-50 text-slate-500 border-slate-200" },
};

/* ─────────────────────────── component ─────────────────────────── */

export function AssistantView() {
  const { user } = useHub();
  const { toast } = useToast();
  const [items, setItems] = useState<ChatItem[]>([
    { kind: "text", role: "bot", text: "Selamat datang di STIBO Hub Assistant. Upload file brand Anda (.xlsx / .csv) — saya akan memvalidasi nama file, memetakan kolom ke atribut Stibo, lalu menyiapkan STEPXML untuk Anda review sebelum dikirim." },
  ]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<UploadRecord[]>([]);
  const [brands, setBrands] = useState<Array<{ code: string; name: string }>>([]);
  const [sendDialog, setSendDialog] = useState<{ upload: UploadRecord; xml: string } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const canEdit = user?.role === "ADMIN" || user?.role === "EDITOR";

  const refreshHistory = useCallback(() => {
    api<{ items: UploadRecord[] }>("/api/uploads?pageSize=12").then((d) => setHistory(d.items)).catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshHistory();
    api<Array<{ code: string; name: string }>>("/api/brands").then(setBrands).catch(() => undefined);
  }, [refreshHistory]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [items, busy]);

  const push = (item: ChatItem) => setItems((prev) => [...prev, item]);

  const uploadFile = async (file: File) => {
    if (!canEdit) { toast({ title: "Viewers cannot upload files", variant: "destructive" }); return; }
    setBusy(true);
    push({ kind: "text", role: "user", text: `Upload: ${file.name}` });
    try {
      const fd = new FormData();
      fd.append("file", file);
      const d = await api<{ upload: UploadRecord; nameInfo: NameInfo; preview: Preview }>("/api/uploads", { method: "POST", body: fd });
      push({ kind: "upload", upload: d.upload, nameInfo: d.nameInfo, preview: d.preview });
      push({ kind: "wizard", upload: d.upload, nameInfo: d.nameInfo });
      refreshHistory();
    } catch (e) {
      push({ kind: "text", role: "bot", text: `Gagal memproses file: ${(e as Error).message}` });
      toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const runTransform = async (uploadId: string, answers: Record<string, string>) => {
    setBusy(true);
    try {
      const { stats } = await api<{ stats: Stats }>(`/api/uploads/${uploadId}/transform`, { method: "POST", body: JSON.stringify(answers) });
      const detail = await api<{ upload: UploadRecord }>(`/api/uploads/${uploadId}`);
      push({ kind: "result", upload: detail.upload, stats });
      refreshHistory();
      toast({ title: "Transform complete", description: `${stats.mappedRows} rows mapped · coverage ${stats.attributeCoverage.mapped} values auto-filled` });
    } catch (e) {
      push({ kind: "text", role: "bot", text: `Transform gagal: ${(e as Error).message}` });
      toast({ title: "Transform failed", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const doSend = async (upload: UploadRecord, mode: "MOCK" | "LIVE") => {
    setBusy(true);
    setSendDialog(null); setConfirmText("");
    try {
      // ensure stepxml exists
      await api<{ xml: string }>(`/api/uploads/${upload.id}/send`).catch(() => undefined);
      const d = await api<{ job: Job }>(`/api/uploads/${upload.id}/send`, { method: "POST", body: JSON.stringify({ confirm: true, mode }) });
      push({ kind: "sent", job: d.job, filename: upload.filename });
      refreshHistory();
    } catch (e) {
      toast({ title: "Send failed", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const openUpload = async (id: string) => {
    setBusy(true);
    try {
      const d = await api<{ upload: UploadRecord; sendJobs: Job[] }>(`/api/uploads/${id}`);
      if (d.upload.status === "MAPPED" || d.upload.status === "SENT") {
        const stats: Stats = {
          totalRows: d.upload.totalRows, mappedRows: d.upload.mappedRows,
          rowsWithManual: d.upload.warnRows, rowsWithAi: 0, rowsWithError: d.upload.errorRows,
          attributeCoverage: { mapped: 0, manual: 0, ai: 0, blank: 0 },
          topIssues: JSON.parse((await api<{ upload: { issues: string } }>(`/api/uploads/${id}`)).upload.issues || "[]"),
        };
        push({ kind: "result", upload: d.upload, stats });
        for (const j of d.sendJobs.slice(0, 1)) push({ kind: "sent", job: j, filename: d.upload.filename });
      } else {
        push({ kind: "wizard", upload: d.upload });
      }
    } catch (e) {
      toast({ title: "Cannot open upload", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <div className="flex h-[calc(100vh-4rem-41px)]">
      {/* history rail */}
      <div className="hidden xl:flex w-[220px] shrink-0 border-r bg-white flex-col">
        <div className="px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Recent uploads</div>
        <ScrollArea className="flex-1 px-2 pb-3">
          {history.length === 0 && <div className="px-3 py-6 text-xs text-slate-400">Belum ada upload.</div>}
          {history.map((h) => (
            <button key={h.id} onClick={() => openUpload(h.id)} className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-slate-50 group">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span className="text-xs font-medium text-slate-700 truncate group-hover:text-slate-900">{h.filename}</span>
              </div>
              <div className="pl-5.5 pl-5 mt-1 flex items-center gap-1.5">
                <StatusChip status={h.status} />
                <span className="text-[10px] text-slate-400">{h.brandCode || "—"} · {h.totalRows} rows</span>
              </div>
            </button>
          ))}
        </ScrollArea>
      </div>

      {/* chat column */}
      <div className="flex-1 flex flex-col min-w-0">
        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-5">
            {items.map((item, i) => (
              <ChatBubble key={i} item={item}>
                {item.kind === "upload" && <UploadCard item={item} />}
                {item.kind === "wizard" && (
                  <WizardCard
                    upload={item.upload}
                    brands={brands}
                    busy={busy}
                    onSubmit={(answers) => runTransform(item.upload.id, answers)}
                  />
                )}
                {item.kind === "result" && (
                  <ResultCard
                    upload={item.upload}
                    stats={item.stats}
                    busy={busy}
                    onPreviewXml={async () => (await api<{ xml: string }>(`/api/uploads/${item.upload.id}/send`)).xml}
                    onSend={() => setSendDialog({ upload: item.upload, xml: "" })}
                  />
                )}
                {item.kind === "sent" && <SentCard job={item.job} filename={item.filename} />}
              </ChatBubble>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* composer */}
        <div className="border-t bg-white p-3 md:px-6">
          <div
            className={cn(
              "max-w-3xl mx-auto rounded-2xl border-2 border-dashed transition-colors bg-slate-50/50",
              dragging ? "border-orange-400 bg-orange-50" : "border-slate-200",
              !canEdit && "opacity-60"
            )}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) uploadFile(f); }}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <UploadCloud className="h-5 w-5 text-slate-400 shrink-0" />
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xlsm,.xlsb,.xls,.csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }}
              />
              <input
                disabled
                placeholder={canEdit ? "Drag & drop Excel di sini, atau klik Choose file — naming convention: 0888-SP-BRAND-FileType-Gender-Season-CC-1.xlsx" : "Viewer role — hubungi Admin untuk upload"}
                className="flex-1 bg-transparent text-sm text-slate-600 outline-none placeholder:text-slate-400"
              />
              <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white shrink-0" disabled={busy || !canEdit} onClick={() => fileRef.current?.click()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileSpreadsheet className="h-4 w-4 mr-1.5" /> Choose file</>}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 2-phase confirm dialog */}
      <Dialog open={!!sendDialog} onOpenChange={(o) => { if (!o) { setSendDialog(null); setConfirmText(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <ShieldAlert className="h-5 w-5" /> Confirm send to Stibo STEP
            </DialogTitle>
            <DialogDescription>
              XML akan dikirim ke endpoint <b>{sendDialog?.upload.endpoint}</b> untuk brand <b>{sendDialog?.upload.brandName}</b> (season {sendDialog?.upload.season}). Tindakan ini tercatat di audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-slate-50 border p-3 text-xs text-slate-600 space-y-1">
              <div className="flex justify-between"><span>File</span><span className="font-mono truncate max-w-[200px]">{sendDialog?.upload.filename}</span></div>
              <div className="flex justify-between"><span>Rows (preview)</span><span>{sendDialog?.upload.processedRows || sendDialog?.upload.totalRows}</span></div>
              <div className="flex justify-between"><span>Mode</span><span className="font-semibold">{sendDialog?.upload.mode || "MOCK"}</span></div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Ketik <span className="font-mono font-semibold">SEND</span> untuk konfirmasi</Label>
              <Input id="confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="SEND" autoComplete="off" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setSendDialog(null); setConfirmText(""); }}>Cancel</Button>
            <Button
              disabled={confirmText !== "SEND" || busy}
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => sendDialog && doSend(sendDialog.upload, (sendDialog.upload.mode === "LIVE" || sendDialog.upload.mode === "LIVE-READY") ? "LIVE" : "MOCK")}
            >
              <Send className="h-4 w-4 mr-1.5" /> Send to Stibo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─────────────────────────── sub-components ─────────────────────────── */

function ChatBubble({ item, children }: { item: ChatItem; children?: React.ReactNode }) {
  if (item.kind === "text") {
    const isUser = item.role === "user";
    return (
      <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
        <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", isUser ? "bg-slate-200" : "bg-[#0B1626]")}>
          {isUser ? <User className="h-4 w-4 text-slate-600" /> : <Bot className="h-4 w-4 text-orange-400" />}
        </div>
        <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed", isUser ? "bg-orange-500 text-white rounded-tr-sm" : "bg-white border rounded-tl-sm text-slate-700")}>
          {item.text}
        </div>
      </div>
    );
  }
  return <div className="pl-11">{children}</div>;
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    PARSED: { cls: "bg-sky-50 text-sky-700 border-sky-200", label: "PARSED" },
    MAPPED: { cls: "bg-indigo-50 text-indigo-700 border-indigo-200", label: "MAPPED" },
    SENT: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "SENT" },
    FAILED: { cls: "bg-red-50 text-red-700 border-red-200", label: "FAILED" },
  };
  const s = map[status] ?? { cls: "bg-slate-50 text-slate-600 border-slate-200", label: status };
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide", s.cls)}>{s.label}</span>;
}

function UploadCard({ item }: { item: Extract<ChatItem, { kind: "upload" }> }) {
  const { upload, nameInfo, preview } = item;
  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b bg-slate-50/60">
        <div className="h-10 w-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
          <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-800 truncate">{upload.filename}</div>
          <div className="text-[11px] text-slate-500">
            Sheet <b>{preview.sheetName}</b> · {preview.totalRows} data rows · {(upload.size / 1024 / 1024).toFixed(1)} MB
          </div>
        </div>
        <Badge variant="outline" className={nameInfo.valid ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700"}>
          {nameInfo.valid ? "naming valid" : "naming issues"}
        </Badge>
      </div>

      <div className="px-5 py-4 grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Detected from filename</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            {[
              ["Company", nameInfo.compCode || "0888"], ["SBU", nameInfo.sbu || "SP"],
              ["Brand", nameInfo.brandSlug || "—"], ["File type", nameInfo.flow],
              ["Season", nameInfo.season || "—"], ["Country", nameInfo.country || "—"],
              ["Endpoint", nameInfo.endpoint],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2 border-b border-dashed border-slate-100 pb-1">
                <span className="text-slate-400">{k}</span><span className="font-medium text-slate-700 truncate">{v}</span>
              </div>
            ))}
          </div>
          {nameInfo.issues.length > 0 && (
            <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5 space-y-1">
              {nameInfo.issues.slice(0, 3).map((iss, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[11px] text-amber-800"><CircleAlert className="h-3 w-3 mt-0.5 shrink-0" />{iss}</div>
              ))}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Preview ({Math.min(preview.rows.length, 8)} of {preview.totalRows})</div>
          <div className="rounded-lg border overflow-auto max-h-44">
            <table className="w-full text-[10px]">
              <thead className="bg-slate-50 sticky top-0">
                <tr>{preview.headers.slice(0, 6).map((h) => <th key={h} className="text-left px-2 py-1.5 font-semibold text-slate-500 truncate max-w-[110px]">{h}</th>)}</tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 8).map((r, i) => (
                  <tr key={i} className="border-t">
                    {preview.headers.slice(0, 6).map((h) => <td key={h} className="px-2 py-1 text-slate-600 truncate max-w-[110px]">{r[h]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function WizardCard({ upload, brands, busy, onSubmit }: {
  upload: UploadRecord;
  brands: Array<{ code: string; name: string }>;
  busy: boolean;
  onSubmit: (answers: Record<string, string>) => void;
}) {
  const [compCode, setCompCode] = useState(upload.compCode || "0888");
  const [sbu, setSbu] = useState(upload.sbu || "SP");
  const [brandCode, setBrandCode] = useState(upload.brandCode || "");
  const [season, setSeason] = useState(upload.season || "");
  const [country, setCountry] = useState(upload.country || "ID");
  const [endpoint, setEndpoint] = useState(upload.endpoint || "ARTICLE_PLANNING");

  const submit = () => onSubmit({ compCode, sbu, brandCode, brandName: brands.find((b) => b.code === brandCode)?.name ?? brandCode, season, country, endpoint });

  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      <div className="flex items-center gap-3 px-5 py-4 border-b bg-gradient-to-r from-orange-50 to-transparent">
        <div className="h-9 w-9 rounded-lg bg-orange-100 flex items-center justify-center"><Wand2 className="h-4.5 w-4.5 h-5 w-5 text-orange-600" /></div>
        <div>
          <div className="text-sm font-semibold text-slate-800">Wizard — konfirmasi konteks artikel</div>
          <div className="text-[11px] text-slate-500">Field sudah diisi otomatis dari nama file. Sesuaikan bila perlu, lalu jalankan transform.</div>
        </div>
      </div>
      <div className="px-5 py-4 grid sm:grid-cols-3 gap-3.5">
        <div className="space-y-1.5"><Label className="text-xs">Company code</Label><Input value={compCode} onChange={(e) => setCompCode(e.target.value)} className="h-9 font-mono" /></div>
        <div className="space-y-1.5"><Label className="text-xs">SBU</Label>
          <Select value={sbu} onValueChange={setSbu}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{SBUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label className="text-xs">Brand *</Label>
          <Select value={brandCode} onValueChange={setBrandCode}><SelectTrigger className="h-9"><SelectValue placeholder="Select brand" /></SelectTrigger>
            <SelectContent className="max-h-64">{brands.map((b) => <SelectItem key={b.code} value={b.code}>{b.code} — {b.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label className="text-xs">Season * (e.g. SP2027)</Label><Input value={season} onChange={(e) => setSeason(e.target.value.toUpperCase())} placeholder="SP2027" className="h-9 font-mono" /></div>
        <div className="space-y-1.5"><Label className="text-xs">Country *</Label>
          <Select value={country} onValueChange={setCountry}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label className="text-xs">Stibo endpoint</Label>
          <Select value={endpoint} onValueChange={setEndpoint}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{ENDPOINTS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <div className="px-5 pb-4 flex justify-end">
        <Button onClick={submit} disabled={busy || !brandCode || !season} className="bg-[#0B1626] hover:bg-[#12233c] text-white">
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Cog className="h-4 w-4 mr-2" />} Run transform
        </Button>
      </div>
    </div>
  );
}

function ResultCard({ upload, stats, busy, onPreviewXml, onSend }: {
  upload: UploadRecord; stats: Stats; busy: boolean;
  onPreviewXml: () => Promise<string>; onSend: () => void;
}) {
  const [xml, setXml] = useState<string | null>(null);
  const [xmlLoading, setXmlLoading] = useState(false);
  const [rows, setRows] = useState<MappedRow[]>([]);
  const { user } = useHub();
  const canEdit = user?.role === "ADMIN" || user?.role === "EDITOR";

  useEffect(() => {
    api<{ upload: { mappedSample: string } }>(`/api/uploads/${upload.id}`)
      .then((d) => setRows(JSON.parse(d.upload.mappedSample || "[]").slice(0, 25)))
      .catch(() => undefined);
  }, [upload.id]);

  const loadXml = async () => {
    setXmlLoading(true);
    try { setXml(await onPreviewXml()); } finally { setXmlLoading(false); }
  };

  const cov = stats.attributeCoverage;
  const totalCells = cov.mapped + cov.manual + cov.ai + cov.blank || 1;

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b bg-gradient-to-r from-emerald-50 to-transparent flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center"><CircleCheck className="h-5 w-5 text-emerald-600" /></div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-800">Transform selesai — {upload.brandName} · {upload.season || "season?"}</div>
          <div className="text-[11px] text-slate-500">{stats.mappedRows} rows diproses (preview maks 500 dari {stats.totalRows || upload.totalRows}) · status <StatusChip status={upload.status} /></div>
        </div>
      </div>

      <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Auto-mapped", value: cov.mapped, cls: "text-emerald-600", icon: CircleCheck, note: "cells" },
          { label: "AI suggested", value: stats.rowsWithAi || cov.ai, cls: "text-violet-600", icon: Sparkles, note: "need confirm" },
          { label: "Manual needed", value: stats.rowsWithManual || cov.manual, cls: "text-amber-600", icon: PenLine, note: "cells" },
          { label: "Errors", value: stats.rowsWithError, cls: "text-red-600", icon: CircleAlert, note: "rows" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">{k.label}</span>
              <k.icon className={cn("h-3.5 w-3.5", k.cls)} />
            </div>
            <div className={cn("text-xl font-bold mt-1", k.cls)}>{k.value}</div>
            <div className="text-[10px] text-slate-400">{k.note}</div>
          </div>
        ))}
      </div>

      <div className="px-5 pb-2">
        <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
          <div className="bg-emerald-400" style={{ width: `${(cov.mapped / totalCells) * 100}%` }} />
          <div className="bg-violet-400" style={{ width: `${(cov.ai / totalCells) * 100}%` }} />
          <div className="bg-amber-400" style={{ width: `${(cov.manual / totalCells) * 100}%` }} />
          <div className="bg-slate-300" style={{ width: `${(cov.blank / totalCells) * 100}%` }} />
        </div>
        <div className="mt-1.5 flex flex-wrap gap-3 text-[10px] text-slate-400">
          <span><span className="inline-block h-2 w-2 rounded-sm bg-emerald-400 mr-1" />auto {Math.round((cov.mapped / totalCells) * 100)}%</span>
          <span><span className="inline-block h-2 w-2 rounded-sm bg-violet-400 mr-1" />ai {Math.round((cov.ai / totalCells) * 100)}%</span>
          <span><span className="inline-block h-2 w-2 rounded-sm bg-amber-400 mr-1" />manual {Math.round((cov.manual / totalCells) * 100)}%</span>
          <span><span className="inline-block h-2 w-2 rounded-sm bg-slate-300 mr-1" />n/a {Math.round((cov.blank / totalCells) * 100)}%</span>
        </div>
      </div>

      <Tabs defaultValue="rows" className="px-5 pb-4">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="rows" className="text-xs">Mapped rows</TabsTrigger>
          <TabsTrigger value="xml" className="text-xs">STEPXML</TabsTrigger>
          <TabsTrigger value="issues" className="text-xs">Issues ({stats.topIssues.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="rows">
          <div className="rounded-lg border overflow-auto max-h-72">
            <table className="w-full text-[10px]">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-2 py-1.5 font-semibold text-slate-500">#</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-slate-500">Generic / Style</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-slate-500">Variant</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-slate-500">Size</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-slate-500">Gender</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-slate-500">Season</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-slate-500">Mapped</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-slate-500">Flags</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.rowNo} className="border-t hover:bg-slate-50/60">
                    <td className="px-2 py-1 text-slate-400">{r.rowNo}</td>
                    <td className="px-2 py-1 font-mono text-slate-700">{r.values["AT_Generic"] || "—"}</td>
                    <td className="px-2 py-1 font-mono text-slate-700">{r.values["AT_Variant"] || "—"}</td>
                    <td className="px-2 py-1">{r.values["AT_Size"] || "—"}</td>
                    <td className="px-2 py-1">{r.values["AT_Gender"] || "—"}</td>
                    <td className="px-2 py-1">{r.values["AT_Season"] || upload.season}</td>
                    <td className="px-2 py-1 text-emerald-700 font-semibold">{r.mappedCount}</td>
                    <td className="px-2 py-1 space-x-1">
                      {r.statuses.filter((s) => s.status === "ai_suggested").slice(0, 2).map((s) => (
                        <span key={s.attributeId} className="inline-flex rounded border border-violet-200 bg-violet-50 px-1 text-violet-700">{TYPE_STYLE.ai_suggested.label}</span>
                      ))}
                      {r.statuses.filter((s) => s.status === "manual_required").length > 0 && (
                        <span className="inline-flex rounded border border-amber-200 bg-amber-50 px-1 text-amber-700">{TYPE_STYLE.manual_required.label}×{r.statuses.filter((s) => s.status === "manual_required").length}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="xml">
          {xml ? (
            <pre className="rounded-lg border bg-[#0B1626] text-emerald-200 p-4 text-[10px] font-mono overflow-auto max-h-72 whitespace-pre-wrap">{xml}</pre>
          ) : (
            <Button variant="outline" size="sm" onClick={loadXml} disabled={xmlLoading} className="text-xs">
              {xmlLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Cog className="h-3.5 w-3.5 mr-1.5" />} Generate STEPXML preview
            </Button>
          )}
        </TabsContent>
        <TabsContent value="issues">
          <div className="rounded-lg border divide-y max-h-60 overflow-auto">
            {stats.topIssues.map((iss, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                <div className="min-w-0">
                  <span className="font-mono text-slate-700">{iss.attributeId}</span>
                  <span className="ml-2 text-slate-400">{iss.attribute}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn("rounded border px-1.5 text-[10px]", TYPE_STYLE[iss.type]?.cls ?? "bg-slate-50 text-slate-500 border-slate-200")}>{iss.type}</span>
                  <span className="font-semibold text-slate-500">×{iss.count}</span>
                </div>
              </div>
            ))}
            {stats.topIssues.length === 0 && <div className="px-3 py-4 text-xs text-slate-400">No issues — perfect run.</div>}
          </div>
        </TabsContent>
      </Tabs>

      {canEdit && upload.status !== "SENT" && (
        <div className="px-5 py-3.5 border-t bg-slate-50/60 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
            STEPXML akan dikirim ke <b className="font-mono">{upload.endpoint}</b>. Konfirmasi diperlukan.
          </div>
          <Button onClick={onSend} className="bg-red-600 hover:bg-red-700 text-white" disabled={busy}>
            <Send className="h-4 w-4 mr-1.5" /> Review &amp; send to Stibo
          </Button>
        </div>
      )}
      {upload.status === "SENT" && (
        <div className="px-5 py-3 border-t bg-emerald-50/60 text-xs text-emerald-700 flex items-center gap-2">
          <CircleCheck className="h-4 w-4" /> File ini sudah terkirim ke Stibo (lihat riwayat di bawah / tab Uploads).
        </div>
      )}
    </div>
  );
}

function SentCard({ job, filename }: { job: Job; filename: string }) {
  const ok = job.status === "SUCCESS";
  return (
    <div className={cn("rounded-2xl border shadow-sm overflow-hidden", ok ? "border-emerald-200" : "border-red-200")}>
      <div className={cn("px-5 py-4 flex items-center gap-3", ok ? "bg-emerald-50" : "bg-red-50")}>
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", ok ? "bg-emerald-100" : "bg-red-100")}>
          {ok ? <CircleCheck className="h-5 w-5 text-emerald-600" /> : <CircleAlert className="h-5 w-5 text-red-600" />}
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-800">{ok ? "Terkirim ke Stibo" : "Gagal terkirim"}</div>
          <div className="text-[11px] text-slate-500 truncate max-w-[420px]">{filename}</div>
        </div>
      </div>
      <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {[
          ["Endpoint", job.endpoint], ["Mode", job.mode], ["bgId", job.bgId || "—"], ["HTTP", job.httpStatus || "—"],
          ["Duration", `${job.durationMs} ms`], ["Status", job.status],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border px-3 py-2">
            <div className="text-[10px] text-slate-400">{k}</div>
            <div className="font-mono font-semibold text-slate-700 truncate">{v}</div>
          </div>
        ))}
      </div>
      {job.responseSnippet && <pre className="mx-5 mb-4 rounded-lg bg-slate-900 text-slate-200 p-3 text-[10px] font-mono overflow-auto max-h-32 whitespace-pre-wrap">{job.responseSnippet}</pre>}
    </div>
  );
}
