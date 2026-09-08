"use client";

/**
 * Unified Assistant — single ChatGPT-style thread that merges the old
 * Pipeline and Q&A modes:
 *   • upload a brand file  → inline Upload card + LOV-driven wizard (MAP Portal style)
 *   • run transform        → Result card showing ALL template-assigned columns,
 *                            with cell-level editing before send
 *   • ask any question     → DB-backed Q&A answered inline in the same thread
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHub, api } from "@/lib/store";
import { TEMPLATE_COLUMNS, denseRow } from "@/lib/template-columns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Inline } from "@/components/hub/Markdown";
import {
  Bot, User, UploadCloud, FileSpreadsheet, Loader2, ArrowRight, CircleAlert,
  CircleCheck, Sparkles, PenLine, Cog, Send, ShieldAlert, Wand2,
  Paperclip, Pencil, BookOpen, Database, History, Eye, EyeOff, Save, X,
} from "lucide-react";

/* ─────────────────────────── types ─────────────────────────── */

interface Opt { code: string; label: string }
interface LovOptions {
  countries: Opt[]; companies: Opt[]; sbus: Opt[]; brands: Opt[]; seasons: Opt[];
  licenseTypes: Opt[]; fileTypes: { Inline: string[]; Licensed: string[] };
  years: string[]; multiMono: Opt[];
}
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
interface ValueStatus { attributeId: string; attribute: string; value: string; status: string; note: string }
interface MappedRow { rowNo: number; values: Record<string, string>; statuses: ValueStatus[]; mappedCount: number }
interface Job { id: string; bgId: string; status: string; httpStatus: number; mode: string; endpoint: string; responseSnippet: string; durationMs: number; createdAt: string }
interface QaTable { title: string; columns: string[]; rows: (string | number)[][] }
interface QaMeta {
  intent?: string; sources?: string[]; table?: QaTable | null;
  chips?: string[]; deepLink?: { view: string; tab?: string } | null;
}

type Msg =
  | { kind: "chat"; id: string; role: "user" | "assistant"; content: string; meta?: QaMeta }
  | { kind: "upload"; id: string; upload: UploadRecord; nameInfo: NameInfo; preview: Preview }
  | { kind: "wizard"; id: string; upload: UploadRecord; nameInfo?: NameInfo }
  | { kind: "result"; id: string; upload: UploadRecord; stats: Stats }
  | { kind: "sent"; id: string; job: Job; filename: string };

interface WizardAnswers {
  compCode: string; sbu: string; brandCode: string; brandName: string;
  seasonCode: string; seasonYear: string; country: string; endpoint: string;
  licenseType: string; multiMono: string; fileType: string;
}

const ENDPOINTS = ["ARTICLE_PLANNING", "EAN_UPDATE", "ARTICLE_MAINTENANCE"];
const TYPE_STYLE: Record<string, { label: string; cls: string; cell: string }> = {
  mapped: { label: "auto", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", cell: "" },
  ai_suggested: { label: "AI", cls: "bg-neutral-100 text-neutral-900 border-neutral-300", cell: "bg-neutral-50" },
  manual_required: { label: "manual", cls: "bg-amber-50 text-amber-700 border-amber-200", cell: "bg-amber-50/60" },
  blank: { label: "n/a", cls: "bg-slate-50 text-slate-500 border-slate-200", cell: "" },
};

const SUGGESTED: Array<{ icon: React.ElementType; label: string; q: string }> = [
  { icon: Database, label: "Brand aktif", q: "Brand apa saja yang aktif di divisi SPORTS?" },
  { icon: BookOpen, label: "Format nama file", q: "Bagaimana format nama file yang benar?" },
  { icon: Database, label: "LOV SEASON", q: "Nilai LOV untuk SEASON" },
  { icon: BookOpen, label: "Apa itu IIEP?", q: "Apa itu IIEP endpoint?" },
  { icon: History, label: "Upload saya", q: "Upload terakhir saya apa saja?" },
  { icon: Sparkles, label: "Rule MANUAL", q: "Ada berapa rule bertipe MANUAL?" },
];

/* ─────────────────────────── main ─────────────────────────── */

export function AssistantView() {
  const { user, setView, setMasterTab, setDocsSlug } = useHub();
  const { toast } = useToast();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [options, setOptions] = useState<LovOptions | null>(null);
  const [history, setHistory] = useState<UploadRecord[]>([]);
  const [sendDialog, setSendDialog] = useState<{ upload: UploadRecord } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const canEdit = user?.role === "ADMIN" || user?.role === "EDITOR";

  const refreshHistory = useCallback(() => {
    api<{ items: UploadRecord[] }>("/api/uploads?pageSize=12").then((d) => setHistory(d.items)).catch(() => undefined);
  }, []);

  useEffect(() => {
    api<LovOptions>("/api/lov/options").then(setOptions).catch(() => undefined);
    refreshHistory();
    api<{ messages: Array<{ id: string; role: string; content: string; meta?: QaMeta }> }>("/api/assistant/history")
      .then((d) =>
        setMsgs(
          d.messages.map((m) => ({
            kind: "chat" as const, id: m.id,
            role: m.role === "user" ? ("user" as const) : ("assistant" as const),
            content: m.content, meta: m.meta,
          }))
        )
      )
      .catch(() => undefined);
  }, [refreshHistory]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const push = (m: Msg) => setMsgs((prev) => [...prev, m]);

  /* free-form Q&A — answered in the same thread */
  const ask = useCallback(async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    push({ kind: "chat", id: `u-${Date.now()}`, role: "user", content: q });
    try {
      const res = await api<{ intent: string; answer: string; table?: QaTable; sources: string[]; chips: string[]; deepLink?: { view: string; tab?: string } }>(
        "/api/assistant/ask", { method: "POST", body: JSON.stringify({ question: q }) }
      );
      push({ kind: "chat", id: `a-${Date.now()}`, role: "assistant", content: res.answer, meta: { intent: res.intent, sources: res.sources, table: res.table ?? null, chips: res.chips, deepLink: res.deepLink ?? null } });
    } catch (e) {
      push({ kind: "chat", id: `e-${Date.now()}`, role: "assistant", content: `Maaf, terjadi kesalahan: ${(e as Error).message}` });
    } finally { setBusy(false); }
  }, [busy]);

  /* file upload → upload card + wizard card */
  const uploadFile = async (file: File) => {
    if (!canEdit) { toast({ title: "Viewers cannot upload files", variant: "destructive" }); return; }
    setBusy(true);
    push({ kind: "chat", id: `u-${Date.now()}`, role: "user", content: `Upload: ${file.name}` });
    try {
      const fd = new FormData();
      fd.append("file", file);
      const d = await api<{ upload: UploadRecord; nameInfo: NameInfo; preview: Preview }>("/api/uploads", { method: "POST", body: fd });
      push({ kind: "upload", id: `up-${d.upload.id}`, upload: d.upload, nameInfo: d.nameInfo, preview: d.preview });
      push({ kind: "wizard", id: `wz-${d.upload.id}`, upload: d.upload, nameInfo: d.nameInfo });
      refreshHistory();
    } catch (e) {
      push({ kind: "chat", id: `e-${Date.now()}`, role: "assistant", content: `Gagal memproses file: ${(e as Error).message}` });
      toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const runTransform = async (uploadId: string, answers: WizardAnswers) => {
    setBusy(true);
    try {
      const { stats } = await api<{ stats: Stats }>(`/api/uploads/${uploadId}/transform`, {
        method: "POST",
        body: JSON.stringify({
          compCode: answers.compCode, sbu: answers.sbu, brandCode: answers.brandCode,
          brandName: answers.brandName, season: `${answers.seasonCode}${answers.seasonYear}`,
          country: answers.country, endpoint: answers.endpoint,
          flow: answers.fileType, licenseType: answers.licenseType, multiMono: answers.multiMono,
        }),
      });
      const detail = await api<{ upload: UploadRecord }>(`/api/uploads/${uploadId}`);
      push({ kind: "result", id: `rs-${uploadId}-${Date.now()}`, upload: detail.upload, stats });
      refreshHistory();
      toast({ title: "Transform complete", description: `${stats.mappedRows} rows mapped · ${stats.attributeCoverage.mapped} cells auto-filled — data bisa Anda edit sebelum kirim` });
    } catch (e) {
      push({ kind: "chat", id: `e-${Date.now()}`, role: "assistant", content: `Transform gagal: ${(e as Error).message}` });
      toast({ title: "Transform failed", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const doSend = async (upload: UploadRecord, mode: "MOCK" | "LIVE") => {
    setBusy(true);
    setSendDialog(null); setConfirmText("");
    try {
      const d = await api<{ job: Job }>(`/api/uploads/${upload.id}/send`, { method: "POST", body: JSON.stringify({ confirm: true, mode }) });
      push({ kind: "sent", id: `st-${upload.id}-${Date.now()}`, job: d.job, filename: upload.filename });
      refreshHistory();
    } catch (e) {
      toast({ title: "Send failed", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const openUpload = async (id: string) => {
    if (msgs.some((m) => (m.kind === "wizard" || m.kind === "result") && m.upload.id === id)) {
      setView("assistant");
      return; // already open in this thread
    }
    setBusy(true);
    try {
      const d = await api<{ upload: UploadRecord; sendJobs: Job[] }>(`/api/uploads/${id}`);
      if (d.upload.status === "MAPPED" || d.upload.status === "SENT") {
        push({
          kind: "result", id: `rs-${id}-${Date.now()}`, upload: d.upload,
          stats: {
            totalRows: d.upload.totalRows, mappedRows: d.upload.mappedRows,
            rowsWithManual: d.upload.warnRows, rowsWithAi: 0, rowsWithError: d.upload.errorRows,
            attributeCoverage: { mapped: 0, manual: 0, ai: 0, blank: 0 },
            topIssues: [],
          },
        });
        for (const j of d.sendJobs.slice(0, 1)) push({ kind: "sent", id: `st-${j.id}`, job: j, filename: d.upload.filename });
      } else {
        push({ kind: "wizard", id: `wz-${id}-${Date.now()}`, upload: d.upload });
      }
    } catch (e) {
      toast({ title: "Cannot open upload", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const navigate = (deepLink?: QaMeta["deepLink"]) => {
    if (!deepLink) return;
    if (deepLink.view === "master" && deepLink.tab) setMasterTab(deepLink.tab as never);
    if (deepLink.view === "docs" && deepLink.tab) setDocsSlug(deepLink.tab);
    setView(deepLink.view as never);
  };

  return (
    <div className="flex h-full min-h-0">
      {/* history rail */}
      <div className="hidden xl:flex w-[220px] shrink-0 border-r-2 border-black bg-white flex-col">
        <div className="px-4 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-100">Recent uploads</div>
        <ScrollArea className="flex-1 px-2 pb-3">
          {history.length === 0 && <div className="px-3 py-6 text-xs text-neutral-400">Belum ada upload.</div>}
          {history.map((h) => (
            <button key={h.id} onClick={() => openUpload(h.id)} className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-neutral-100 group">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-3.5 w-3.5 text-[#DD1C24] shrink-0" />
                <span className="text-xs font-medium text-neutral-700 truncate group-hover:text-black">{h.filename}</span>
              </div>
              <div className="pl-5 mt-1 flex items-center gap-1.5">
                <StatusChip status={h.status} />
                <span className="text-[10px] text-neutral-400">{h.brandCode || "—"} · {h.totalRows} rows</span>
              </div>
            </button>
          ))}
        </ScrollArea>
      </div>

      {/* unified thread */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <ScrollArea className="flex-1">
          <div
            className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-5"
            onDragOver={(e) => { e.preventDefault(); if (canEdit) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
          >
            {msgs.length === 0 && !busy && (
              <EmptyHero userName={user?.name?.split(" ")[0]} canEdit={canEdit} onPick={() => fileRef.current?.click()} onAsk={ask} />
            )}
            {msgs.map((m) => (
              <MsgRow key={m.id} msg={m}>
                {m.kind === "upload" && <UploadCard item={m} />}
                {m.kind === "wizard" && (
                  <WizardCard
                    upload={m.upload}
                    nameInfo={m.nameInfo}
                    options={options}
                    busy={busy}
                    onSubmit={(answers) => runTransform(m.upload.id, answers)}
                  />
                )}
                {m.kind === "result" && (
                  <ResultCard
                    upload={m.upload}
                    stats={m.stats}
                    busy={busy}
                    canEdit={!!canEdit}
                    onPreviewXml={async () => (await api<{ xml: string }>(`/api/uploads/${m.upload.id}/send`)).xml}
                    onSend={() => setSendDialog({ upload: m.upload })}
                    onSaved={refreshHistory}
                  />
                )}
                {m.kind === "sent" && <SentCard job={m.job} filename={m.filename} />}
                {m.kind === "chat" && m.role === "assistant" && (
                  <ChatExtras meta={m.meta} onChip={ask} onNavigate={navigate} />
                )}
              </MsgRow>
            ))}
            {busy && (
              <div className="flex items-start gap-2.5">
                <div className="h-8 w-8 rounded-full bg-black flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-[#DD1C24]" />
                </div>
                <div className="rounded-2xl rounded-tl-md bg-white border-2 border-black px-4 py-3 flex items-center gap-2 text-xs text-neutral-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#DD1C24]" /> Memproses…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {dragging && (
          <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm border-4 border-dashed border-[#DD1C24] flex flex-col items-center justify-center pointer-events-none">
            <UploadCloud className="h-10 w-10 text-[#DD1C24] mb-2" />
            <div className="text-sm font-semibold text-black">Drop file untuk mulai pipeline</div>
            <div className="text-xs text-neutral-500">.xlsx / .xls / .csv — naming convention MAP Portal</div>
          </div>
        )}

        {/* unified composer: attach + free text */}
        <div className="border-t-2 border-black bg-white p-3 md:px-6">
          <div className="max-w-3xl mx-auto flex items-center gap-2 rounded-2xl border-2 border-black bg-white px-3 py-2 focus-within:border-[#DD1C24] transition-colors">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xlsm,.xlsb,.xls,.csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }}
            />
            <Button
              variant="ghost" size="icon" disabled={busy || !canEdit}
              className="h-9 w-9 shrink-0 text-neutral-500 hover:text-[#DD1C24] hover:bg-neutral-100"
              onClick={() => fileRef.current?.click()}
              aria-label="Lampirkan file Excel"
              title={canEdit ? "Upload file brand (xlsx/csv)" : "Viewer role — hubungi Admin untuk upload"}
            >
              <Paperclip className="h-4.5 w-4.5" />
            </Button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }}
              disabled={busy}
              placeholder={canEdit ? "Tanya apa saja, atau lampirkan file untuk mulai pipeline…" : "Tanya apa saja… (viewer)"}
              className="flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
              aria-label="Pertanyaan atau perintah"
            />
            <Button
              size="icon" disabled={busy || !input.trim()}
              onClick={() => ask(input)}
              className="h-9 w-9 rounded-full bg-[#DD1C24] hover:bg-[#b9151c] text-white shrink-0"
              aria-label="Kirim"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="max-w-3xl mx-auto mt-1.5 px-1 text-[10px] text-neutral-400 flex items-center justify-between">
            <span>Enter kirim · Shift+Enter baris baru · drag &amp; drop Excel ke mana saja</span>
            <span className="font-mono">naming: 0888-SP-BRAND-FileType-Gender-Season-CC-1.xlsx</span>
          </div>
        </div>
      </div>

      {/* 2-phase confirm dialog */}
      <Dialog open={!!sendDialog} onOpenChange={(o) => { if (!o) { setSendDialog(null); setConfirmText(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#DD1C24]">
              <ShieldAlert className="h-5 w-5" /> Confirm send to Stibo STEP
            </DialogTitle>
            <DialogDescription>
              XML akan dikirim ke endpoint <b>{sendDialog?.upload.endpoint}</b> untuk brand <b>{sendDialog?.upload.brandName}</b> (season {sendDialog?.upload.season}). Tindakan ini tercatat di audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-neutral-50 border-2 border-black p-3 text-xs text-neutral-600 space-y-1">
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
              className="bg-[#DD1C24] hover:bg-[#b9151c] text-white"
              onClick={() => sendDialog && doSend(sendDialog.upload, sendDialog.upload.mode === "LIVE" || sendDialog.upload.mode === "LIVE-READY" ? "LIVE" : "MOCK")}
            >
              <Send className="h-4 w-4 mr-1.5" /> Send to Stibo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─────────────────────────── row wrapper ─────────────────────────── */

function MsgRow({ msg, children }: { msg: Msg; children?: React.ReactNode }) {
  if (msg.kind === "chat") {
    const isUser = msg.role === "user";
    return (
      <div className="space-y-2">
        <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
          <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0 border-2", isUser ? "bg-neutral-100 border-black" : "bg-black border-black")}>
            {isUser ? <User className="h-4 w-4 text-neutral-700" /> : <Bot className="h-4 w-4 text-[#DD1C24]" />}
          </div>
          <div className={cn(
            "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser ? "bg-[#DD1C24] text-white rounded-tr-sm" : "bg-white border-2 border-black rounded-tl-sm text-neutral-700"
          )}>
            {isUser ? msg.content : <Markdownish text={msg.content} />}
          </div>
        </div>
        {/* extras (data table, sources, chips) hang below the assistant bubble */}
        {!isUser && children}
      </div>
    );
  }
  return <div className="pl-11">{children}</div>;
}

/* follow-up chips, sources, table card for Q&A answers */
function ChatExtras({ meta, onChip, onNavigate }: { meta?: QaMeta; onChip: (q: string) => void; onNavigate: (l?: QaMeta["deepLink"]) => void }) {
  if (!meta) return null;
  return (
    <div className="space-y-2">
      {meta.table && <QaTableCard table={meta.table} />}
      {(meta.sources?.length || meta.deepLink) && (
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          {meta.sources?.map((s, i) => (
            <Badge key={i} variant="outline" className="text-[9px] border-neutral-200 bg-white text-neutral-500 gap-1">
              <BookOpen className="h-2.5 w-2.5" /> {s}
            </Badge>
          ))}
          {meta.deepLink && (
            <button onClick={() => onNavigate(meta.deepLink ?? undefined)}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#DD1C24] hover:underline px-1">
              Buka halaman <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
      {meta.chips && meta.chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1 pt-0.5">
          {meta.chips.slice(0, 4).map((c, i) => (
            <button key={i} onClick={() => onChip(c)}
              className="px-2.5 py-1 rounded-full border-2 border-black bg-white text-[10px] text-neutral-600 hover:border-[#DD1C24] hover:text-[#DD1C24] transition-colors">
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── empty hero ─────────────────────────── */

function EmptyHero({ userName, canEdit, onPick, onAsk }: { userName?: string; canEdit: boolean; onPick: () => void; onAsk: (q: string) => void }) {
  return (
    <div className="pt-4 pb-2">
      <div className="rounded-2xl border-2 border-black bg-white overflow-hidden">
        <div className="px-6 py-5 border-b-2 border-black flex items-center gap-4">
          <img src="/map-active-logo.svg" alt="MAP Active" className="h-9 w-auto" />
          <div>
            <div className="text-sm font-bold text-black">Halo {userName ?? "there"}! Ada yang bisa saya bantu?</div>
            <div className="text-[11px] text-neutral-500">Upload file brand untuk pipeline Stibo, atau tanya apa saja tentang data master.</div>
          </div>
        </div>
        <button
          onClick={canEdit ? onPick : undefined}
          disabled={!canEdit}
          className={cn("w-full px-6 py-5 text-left transition-colors border-b-2 border-black", canEdit ? "hover:bg-red-50/40" : "opacity-60 cursor-not-allowed")}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#DD1C24]/10 border border-[#DD1C24]/30 flex items-center justify-center">
              <UploadCloud className="h-5 w-5 text-[#DD1C24]" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-black">Upload file brand (.xlsx / .csv)</div>
              <div className="text-[11px] text-neutral-500">Saya akan memvalidasi nama file, menampilkan wizard konteks berbasis LOV, memetakan ke atribut Stibo, lalu menyiapkan STEPXML untuk Anda review &amp; edit.</div>
            </div>
            {canEdit && <Badge variant="outline" className="border-black text-black">Browse file</Badge>}
          </div>
        </button>
        <div className="px-6 py-4">
          <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2.5">Atau coba tanya</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {SUGGESTED.map((s) => (
              <button key={s.label} onClick={() => onAsk(s.q)}
                className="flex items-center gap-2.5 rounded-xl border-2 border-black bg-white px-3.5 py-2.5 text-xs hover:border-[#DD1C24] hover:bg-red-50/40 transition-colors group">
                <s.icon className="h-4 w-4 text-neutral-400 group-hover:text-[#DD1C24] shrink-0" />
                <span className="font-medium text-neutral-700">{s.label}</span>
                <ArrowRight className="h-3 w-3 ml-auto text-neutral-300 group-hover:text-[#DD1C24]" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── shared bits ─────────────────────────── */

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    PARSED: { cls: "bg-sky-50 text-sky-700 border-sky-200", label: "PARSED" },
    MAPPED: { cls: "bg-neutral-900 text-white border-black", label: "MAPPED" },
    SENT: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "SENT" },
    FAILED: { cls: "bg-red-50 text-red-700 border-red-200", label: "FAILED" },
  };
  const s = map[status] ?? { cls: "bg-neutral-50 text-neutral-600 border-neutral-200", label: status };
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide", s.cls)}>{s.label}</span>;
}

/* ─────────────────────────── upload card (ALL source columns) ─────────────────────────── */

function UploadCard({ item }: { item: Extract<Msg, { kind: "upload" }> }) {
  const { upload, nameInfo, preview } = item;
  return (
    <div className="rounded-2xl border-2 border-black bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b-2 border-black bg-neutral-50">
        <div className="h-10 w-10 rounded-lg bg-[#DD1C24]/10 border border-[#DD1C24]/30 flex items-center justify-center">
          <FileSpreadsheet className="h-5 w-5 text-[#DD1C24]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-black truncate">{upload.filename}</div>
          <div className="text-[11px] text-neutral-500">
            Sheet <b>{preview.sheetName}</b> · {preview.totalRows} data rows · {(upload.size / 1024 / 1024).toFixed(1)} MB · {preview.headers.length} kolom sumber
          </div>
        </div>
        <Badge variant="outline" className={nameInfo.valid ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700"}>
          {nameInfo.valid ? "naming valid" : "naming issues"}
        </Badge>
      </div>

      <div className="px-5 py-4 grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Detected from filename</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            {[
              ["Company", nameInfo.compCode || "0888"], ["SBU", nameInfo.sbu || "SP"],
              ["Brand", nameInfo.brandSlug || "—"], ["File type", nameInfo.flow],
              ["Season", nameInfo.season || "—"], ["Country", nameInfo.country || "—"],
              ["Endpoint", nameInfo.endpoint],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2 border-b border-dashed border-neutral-100 pb-1">
                <span className="text-neutral-400">{k}</span><span className="font-medium text-neutral-700 truncate">{v}</span>
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
          <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
            Sample — semua {preview.headers.length} kolom ({Math.min(preview.rows.length, 8)} of {preview.totalRows} rows)
          </div>
          <div className="rounded-lg border-2 border-black overflow-auto max-h-56">
            <table className="text-[10px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-neutral-100 border-r border-neutral-200 px-2 py-1.5 font-semibold text-neutral-500">#</th>
                  {preview.headers.map((h, hi) => (
                    <th key={`c-${hi}`} className="bg-neutral-100 border-b border-neutral-200 px-2 py-1.5 font-semibold text-neutral-600 whitespace-nowrap max-w-[160px] truncate" title={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 8).map((r, i) => (
                  <tr key={i}>
                    <td className="sticky left-0 z-10 bg-white border-r border-b border-neutral-200 px-2 py-1 text-neutral-400">{i + 1}</td>
                    {preview.headers.map((h, hi) => (
                      <td key={`c-${hi}`} className="border-b border-neutral-100 px-2 py-1 text-neutral-600 whitespace-nowrap max-w-[160px] truncate" title={r[h]}>{r[h]}</td>
                    ))}
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

/* ─────────────────────────── portal-style LOV wizard ─────────────────────────── */

function WizardCard({ upload, nameInfo, options, busy, onSubmit }: {
  upload: UploadRecord;
  nameInfo?: NameInfo;
  options: LovOptions | null;
  busy: boolean;
  onSubmit: (answers: WizardAnswers) => void;
}) {
  const detectedSeason = upload.season || nameInfo?.season || "";
  const m = detectedSeason.match(/^([A-Za-z]+)(\d{2,4})$/);
  const [brandCode, setBrandCode] = useState(upload.brandCode || nameInfo?.brandSlug || "");
  const [seasonCode, setSeasonCode] = useState(m?.[1]?.toUpperCase() ?? "");
  const [seasonYear, setSeasonYear] = useState(m?.[2] ?? String(new Date().getFullYear() + 1));
  const [sbu, setSbu] = useState(upload.sbu || nameInfo?.sbu || "SP");
  const [compCode, setCompCode] = useState(upload.compCode || nameInfo?.compCode || "0888");
  const [country, setCountry] = useState(upload.country || nameInfo?.country || "ID");
  const [licenseType, setLicenseType] = useState(/licen/i.test(upload.flow || nameInfo?.flow || "") ? "License" : "Inline");
  const [multiMono, setMultiMono] = useState("Multi");
  const [endpoint, setEndpoint] = useState(upload.endpoint || nameInfo?.endpoint || "ARTICLE_PLANNING");
  const [fileType, setFileType] = useState(upload.flow || nameInfo?.flow || "");

  // brand name derived from LOV selection (no sync effect needed)
  const brandName = options?.brands.find((x) => x.code === brandCode)?.label ?? upload.brandName ?? "";

  const availableFileTypes = useMemo(() => {
    const fromRoute = options?.fileTypes?.[licenseType === "License" ? "Licensed" : "Inline"] ?? [];
    const all = options ? Array.from(new Set([...options.fileTypes.Inline, ...options.fileTypes.Licensed])) : [];
    const list = fromRoute.length ? fromRoute : all;
    if (fileType && !list.includes(fileType)) return [...list, fileType].sort();
    return list;
  }, [options, licenseType, fileType]);

  const submit = () =>
    onSubmit({ compCode, sbu, brandCode, brandName: brandName || brandCode, seasonCode, seasonYear, country, endpoint, licenseType, multiMono, fileType });

  const pill = (active: boolean) =>
    cn(
      "flex-1 h-9 rounded-lg border-2 text-xs font-semibold transition-colors",
      active ? "border-[#DD1C24] bg-red-50 text-[#DD1C24]" : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-400"
    );

  return (
    <div className="rounded-2xl border-2 border-black bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b-2 border-black bg-neutral-50">
        <div className="h-9 w-9 rounded-lg bg-[#DD1C24] flex items-center justify-center"><Wand2 className="h-4.5 w-4.5 text-white" /></div>
        <div>
          <div className="text-sm font-semibold text-black">Wizard — konfirmasi konteks artikel</div>
          <div className="text-[11px] text-neutral-500">Semua dropdown mengikuti LOV master (MDD). Field terisi otomatis dari nama file — sesuaikan bila perlu.</div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3.5">
        <div className="grid sm:grid-cols-3 gap-3.5">
          <Field label="Brand / Principal" required>
            <LovSelect value={brandCode} onChange={setBrandCode} options={options?.brands ?? []} placeholder={options ? "Select brand…" : "Loading LOV…"} disabled={!options} />
          </Field>
          <Field label="Season" required>
            <LovSelect value={seasonCode} onChange={setSeasonCode} options={options?.seasons ?? []} placeholder={options ? "Select season…" : "Loading…"} disabled={!options} />
          </Field>
          <Field label="Year">
            <LovSelect value={seasonYear} onChange={setSeasonYear} options={(options?.years ?? []).map((y) => ({ code: y, label: y }))} placeholder="Year" disabled={!options} />
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-3.5">
          <Field label="Brand Code">
            <Input value={brandCode} onChange={(e) => setBrandCode(e.target.value.toUpperCase())} placeholder="e.g. NEW" className="h-9 font-mono uppercase" />
          </Field>
          <Field label="SBU" required>
            <LovSelect value={sbu} onChange={setSbu} options={options?.sbus ?? []} placeholder={options ? "Select SBU…" : "Loading…"} disabled={!options} />
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-3.5">
          <Field label="Company Code">
            <LovSelect value={compCode} onChange={setCompCode} options={options?.companies ?? []} placeholder={options ? "Select company…" : "Loading…"} disabled={!options} />
          </Field>
          <Field label="Country" required>
            <LovSelect value={country} onChange={setCountry} options={options?.countries ?? []} placeholder={options ? "Select country…" : "Loading…"} disabled={!options} />
          </Field>
        </div>

        <div>
          <div className="text-xs font-medium text-neutral-600 mb-1.5">License / Inline</div>
          <div className="flex gap-2.5">
            {(options?.licenseTypes?.length ? options.licenseTypes : [{ code: "License", label: "License" }, { code: "Inline", label: "Inline" }]).map((t) => (
              <button key={t.code} type="button" onClick={() => setLicenseType(t.code)} className={pill(licenseType === t.code)}>
                {licenseType === t.code && "● "} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3.5">
          <Field label="File type" hint={fileType ? undefined : "Pilih tipe file brand"}>
            {availableFileTypes.length > 0 ? (
              <LovSelect value={fileType} onChange={setFileType} options={availableFileTypes.map((f) => ({ code: f, label: f }))} placeholder="Select file type…" />
            ) : (
              <Input value={fileType} onChange={(e) => setFileType(e.target.value)} placeholder="e.g. Linelist" className="h-9" />
            )}
          </Field>
          <Field label="Stibo endpoint">
            <LovSelect value={endpoint} onChange={setEndpoint} options={ENDPOINTS.map((e) => ({ code: e, label: e }))} placeholder="Select endpoint…" />
          </Field>
        </div>

        <div>
          <div className="text-xs font-medium text-neutral-600 mb-1.5">Multi / Mono</div>
          <div className="flex gap-2.5">
            {(options?.multiMono ?? [{ code: "Multi", label: "Multi" }, { code: "Mono", label: "Mono" }]).map((t) => (
              <button key={t.code} type="button" onClick={() => setMultiMono(t.code)} className={pill(multiMono === t.code)}>
                {multiMono === t.code && "● "} {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-5 pb-4 flex items-center justify-between gap-3">
        <div className="text-[11px] text-neutral-400">* wajib — brand, season+year, country, SBU</div>
        <Button onClick={submit} disabled={busy || !brandCode || !seasonCode || !country || !sbu} className="bg-[#DD1C24] hover:bg-[#b9151c] text-white">
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Cog className="h-4 w-4 mr-2" />} Run transform
        </Button>
      </div>
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 min-w-0">
      <Label className="text-xs text-neutral-600">{label}{required && <span className="text-[#DD1C24]"> *</span>}</Label>
      {children}
      {hint && <div className="text-[10px] text-neutral-400">{hint}</div>}
    </div>
  );
}

/** Searchable LOV select — type-to-filter, portal parity for long lists (brands, companies, SBU). */
function LovSelect({ value, onChange, options, placeholder, disabled }: {
  value: string; onChange: (v: string) => void; options: Opt[]; placeholder?: string; disabled?: boolean;
}) {
  const [filter, setFilter] = useState("");
  const selected = options.find((o) => o.code === value);
  const filtered = filter
    ? options.filter((o) => `${o.code} ${o.label}`.toLowerCase().includes(filter.toLowerCase()))
    : options;
  return (
    <Select value={value || undefined} onValueChange={(v) => { onChange(v); setFilter(""); }} disabled={disabled}>
      <SelectTrigger className="h-9 w-full">
        <SelectValue placeholder={placeholder}>
          {selected ? <span className="truncate">{selected.code} — {selected.label}</span> : placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <div className="p-1.5 sticky top-0 bg-white border-b z-10">
          <Input
            value={filter} onChange={(e) => setFilter(e.target.value)}
            placeholder="Cari kode / nama…" className="h-7 text-xs" autoFocus
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 && <div className="px-3 py-4 text-xs text-neutral-400 text-center">Tidak ada opsi.</div>}
          {filtered.map((o) => (
            <SelectItem key={o.code} value={o.code} className="text-xs">
              <span className="font-mono font-semibold">{o.code}</span>
              <span className="text-neutral-500"> — {o.label}</span>
            </SelectItem>
          ))}
        </div>
      </SelectContent>
    </Select>
  );
}

/* ─────────────────────────── result card (ALL template columns + editing) ─────────────────────────── */

function ResultCard({ upload, stats, busy, canEdit, onPreviewXml, onSend, onSaved }: {
  upload: UploadRecord; stats: Stats; busy: boolean; canEdit: boolean;
  onPreviewXml: () => Promise<string>; onSend: () => void; onSaved?: () => void;
}) {
  const { toast } = useToast();
  const [xml, setXml] = useState<string | null>(null);
  const [xmlLoading, setXmlLoading] = useState(false);
  const [rows, setRows] = useState<MappedRow[]>([]);
  const [rowLimit, setRowLimit] = useState(30);
  const [editMode, setEditMode] = useState(false);
  const [hideEmpty, setHideEmpty] = useState(false);
  const [pending, setPending] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);
  const [activeCell, setActiveCell] = useState<{ rowNo: number; attributeId: string } | null>(null);

  useEffect(() => {
    api<{ upload: { mappedSample: string } }>(`/api/uploads/${upload.id}`)
      .then((d) => setRows(JSON.parse(d.upload.mappedSample || "[]")))
      .catch(() => undefined);
  }, [upload.id]);

  const loadXml = async () => {
    setXmlLoading(true);
    try { setXml(await onPreviewXml()); } finally { setXmlLoading(false); }
  };

  const statusOf = (row: MappedRow, attributeId: string): string => {
    const cellPending = pending.get(`${row.rowNo}:${attributeId}`);
    if (cellPending !== undefined) return "mapped"; // edited cells render as filled
    return row.statuses.find((s) => s.attributeId === attributeId)?.status ?? "blank";
  };

  // column emptiness (for hide-empty toggle)
  const emptyCols = useMemo(() => {
    const set = new Set<string>();
    for (const col of TEMPLATE_COLUMNS) {
      if (!col.id) { set.add(col.name); continue; }
      const hasValue = rows.some((r) => (r.values[col.id] ?? "").trim() !== "");
      if (!hasValue) set.add(col.id);
    }
    return set;
  }, [rows]);

  const visibleColumns = hideEmpty
    ? TEMPLATE_COLUMNS.filter((c) => (c.id ? !emptyCols.has(c.id) : false))
    : TEMPLATE_COLUMNS;

  // cluster band spans
  const clusterBands = useMemo(() => {
    const bands: Array<{ cluster: string; span: number }> = [];
    for (const c of visibleColumns) {
      const last = bands[bands.length - 1];
      if (last && last.cluster === c.cluster) last.span += 1;
      else bands.push({ cluster: c.cluster, span: 1 });
    }
    return bands;
  }, [visibleColumns]);

  const columnValues = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const col of TEMPLATE_COLUMNS) {
      if (!col.id) continue;
      const vals = Array.from(new Set(rows.map((r) => (r.values[col.id] ?? "").trim()).filter(Boolean)));
      map.set(col.id, vals.slice(0, 30));
    }
    return map;
  }, [rows]);

  const setEdit = (rowNo: number, attributeId: string, value: string) => {
    setPending((prev) => new Map(prev).set(`${rowNo}:${attributeId}`, value));
  };

  const saveEdits = async () => {
    if (pending.size === 0) return;
    setSaving(true);
    try {
      const edits = Array.from(pending.entries()).map(([k, value]) => {
        const [rowNo, attributeId] = k.split(":");
        return { rowNo: Number(rowNo), attributeId, value };
      });
      const res = await api<{ applied: number }>(`/api/uploads/${upload.id}`, { method: "PATCH", body: JSON.stringify({ edits }) });
      // apply locally
      setRows((prev) =>
        prev.map((r) => {
          const clone = { ...r, values: { ...r.values }, statuses: r.statuses.map((s) => ({ ...s })) };
          for (const e of edits) {
            if (e.rowNo !== r.rowNo) continue;
            clone.values[e.attributeId] = e.value;
            const st = clone.statuses.find((s) => s.attributeId === e.attributeId);
            if (st) { st.value = e.value; if (e.value.trim()) st.status = "mapped"; st.note = "manual edit in portal"; }
          }
          return clone;
        })
      );
      setPending(new Map());
      setXml(null);
      onSaved?.();
      toast({ title: "Edits saved", description: `${res.applied} cell(s) updated — STEPXML akan di-generate ulang dari data terbaru.` });
    } catch (e) {
      toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const cov = stats.attributeCoverage;
  const totalCells = cov.mapped + cov.manual + cov.ai + cov.blank || 1;

  return (
    <div className="rounded-2xl border-2 border-black bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b-2 border-black bg-neutral-50 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-[#DD1C24] flex items-center justify-center"><CircleCheck className="h-5 w-5 text-white" /></div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-black">Transform selesai — {upload.brandName} · {upload.season || "season?"}</div>
          <div className="text-[11px] text-neutral-500">{upload.mappedRows || stats.mappedRows} rows diproses (preview maks 500 dari {stats.totalRows || upload.totalRows}) · status <StatusChip status={upload.status} /></div>
        </div>
      </div>

      <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Auto-mapped", value: cov.mapped || upload.mappedRows, cls: "text-emerald-600", icon: CircleCheck, note: "cells" },
          { label: "AI suggested", value: stats.rowsWithAi || cov.ai, cls: "text-neutral-900", icon: Sparkles, note: "need confirm" },
          { label: "Manual needed", value: stats.rowsWithManual || cov.manual, cls: "text-amber-600", icon: PenLine, note: "cells" },
          { label: "Errors", value: stats.rowsWithError, cls: "text-[#DD1C24]", icon: CircleAlert, note: "rows" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border-2 border-black p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-neutral-500 font-medium">{k.label}</span>
              <k.icon className={cn("h-3.5 w-3.5", k.cls)} />
            </div>
            <div className={cn("text-xl font-bold mt-1", k.cls)}>{k.value}</div>
            <div className="text-[10px] text-neutral-400">{k.note}</div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="rows" className="px-5 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <TabsList className="bg-neutral-100">
            <TabsTrigger value="rows" className="text-xs">Mapped rows — {TEMPLATE_COLUMNS.length} kolom template</TabsTrigger>
            <TabsTrigger value="xml" className="text-xs">STEPXML</TabsTrigger>
            <TabsTrigger value="issues" className="text-xs">Issues ({stats.topIssues.length})</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-1.5">
            {canEdit && upload.status !== "SENT" && (
              <Button
                variant="outline" size="sm"
                className={cn("h-7 text-[11px] border-2", editMode ? "border-[#DD1C24] text-[#DD1C24]" : "border-black text-black")}
                onClick={() => { setEditMode((v) => !v); setActiveCell(null); }}
              >
                {editMode ? <><EyeOff className="h-3 w-3 mr-1" /> Selesai edit</> : <><Pencil className="h-3 w-3 mr-1" /> Edit data</>}
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-7 text-[11px] border-neutral-200 text-neutral-600" onClick={() => setHideEmpty((v) => !v)}>
              {hideEmpty ? <><Eye className="h-3 w-3 mr-1" /> Show all</> : <><EyeOff className="h-3 w-3 mr-1" /> Hide empty</>}
            </Button>
            {editMode && pending.size > 0 && (
              <Button size="sm" className="h-7 text-[11px] bg-[#DD1C24] hover:bg-[#b9151c] text-white" disabled={saving} onClick={saveEdits}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <><Save className="h-3 w-3 mr-1" />Save {pending.size} edits</>}
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="rows">
          <div className="text-[10px] text-neutral-400 mb-1.5 flex flex-wrap items-center gap-3">
            <span><span className="inline-block h-2 w-2 rounded-sm bg-emerald-400 mr-1" />auto</span>
            <span><span className="inline-block h-2 w-2 rounded-sm bg-neutral-800 mr-1" />ai</span>
            <span><span className="inline-block h-2 w-2 rounded-sm bg-amber-400 mr-1" />manual</span>
            <span><span className="inline-block h-2 w-2 rounded-sm bg-neutral-300 mr-1" />n/a</span>
            {editMode && <span className="text-[#DD1C24] font-semibold">— klik sel untuk edit (Enter/Tab commit, Esc batal)</span>}
          </div>
          <div className="rounded-lg border-2 border-black overflow-auto max-h-[420px]">
            <table className="text-[10px] border-separate border-spacing-0">
              <thead>
                {/* cluster band */}
                <tr>
                  <th rowSpan={2} className="sticky left-0 z-20 top-[26px] bg-neutral-100 border-r-2 border-b-2 border-black px-2 py-1.5 font-bold text-neutral-600 min-w-[36px]">#</th>
                  {clusterBands.map((b, i) => (
                    <th key={i} colSpan={b.span} className="bg-black text-white px-2 py-1 text-[9px] font-bold uppercase tracking-wider border-r border-neutral-700 whitespace-nowrap">
                      {b.cluster} ({b.span})
                    </th>
                  ))}
                </tr>
                {/* attribute names */}
                <tr>
                  {visibleColumns.map((c, ci) => (
                    <th key={`h-${ci}`} title={`${c.name}${c.id ? ` · ${c.id} · ${c.validation}` : " · no AT id in template"}`}
                      className="bg-neutral-100 border-b-2 border-black px-2 py-1.5 font-semibold text-neutral-600 whitespace-nowrap max-w-[140px] truncate sticky top-[26px]">
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, rowLimit).map((r) => (
                  <tr key={r.rowNo} className="group">
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-neutral-50 border-r-2 border-b border-black px-2 py-1 text-neutral-400 font-semibold">{r.rowNo}</td>
                    {visibleColumns.map((c) => {
                      if (!c.id) return <td key={c.name} title={`${c.name} — tidak memiliki AT id (belum dipetakan ke Stibo)`} className="border-b border-neutral-200 bg-neutral-50/60 px-2 py-1 text-neutral-300 whitespace-nowrap max-w-[140px] truncate">n/a</td>;
                      const key = `${r.rowNo}:${c.id}`;
                      const edited = pending.get(key);
                      const shown = edited !== undefined ? edited : (r.values[c.id] ?? "");
                      const st = statusOf(r, c.id);
                      const isActive = activeCell?.rowNo === r.rowNo && activeCell?.attributeId === c.id;
                      if (isActive) {
                        return (
                          <td key={key} className="border-b border-neutral-200 p-0 bg-white">
                            <Input
                              autoFocus
                              defaultValue={shown}
                              list={`dl-${c.id}`}
                              className="h-6 text-[10px] rounded-none border-2 border-[#DD1C24] px-1"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === "Tab") { setEdit(r.rowNo, c.id, (e.target as HTMLInputElement).value); setActiveCell(null); }
                                if (e.key === "Escape") setActiveCell(null);
                              }}
                              onBlur={(e) => { setEdit(r.rowNo, c.id, e.target.value); setActiveCell(null); }}
                            />
                            <datalist id={`dl-${c.id}`}>
                              {(columnValues.get(c.id) ?? []).map((v) => <option key={v} value={v} />)}
                            </datalist>
                          </td>
                        );
                      }
                      return (
                        <td
                          key={key}
                          title={edited !== undefined ? `${shown} (edited)` : shown || `${c.id} — kosong`}
                          onClick={() => { if (editMode) setActiveCell({ rowNo: r.rowNo, attributeId: c.id }); }}
                          className={cn(
                            "border-b border-neutral-200 px-2 py-1 whitespace-nowrap max-w-[140px] truncate",
                            TYPE_STYLE[st]?.cell,
                            edited !== undefined && "bg-red-50 font-semibold text-[#DD1C24]",
                            st === "mapped" && !edited && "text-neutral-800",
                            st === "ai_suggested" && "text-neutral-900",
                            editMode && "cursor-cell hover:outline hover:outline-2 hover:outline-[#DD1C24]"
                          )}
                        >
                          {shown || (st === "blank" ? "·" : "—")}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={visibleColumns.length + 1} className="px-3 py-6 text-center text-neutral-400">Sample belum tersedia.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {rows.length > 0 && (
            <div className="text-[10px] text-neutral-400 mt-1 flex flex-wrap items-center gap-2">
              <span>
                Menampilkan {Math.min(rowLimit, rows.length)} dari {rows.length} baris × {visibleColumns.length} kolom (dari {TEMPLATE_COLUMNS.length} kolom template{hideEmpty ? `, ${TEMPLATE_COLUMNS.length - visibleColumns.length} kosong disembunyikan` : ""}).
              </span>
              {rows.length > rowLimit && (
                <button className="font-semibold text-[#DD1C24] hover:underline" onClick={() => setRowLimit((n) => Math.min(n + 50, rows.length))}>
                  Muat 50 baris lagi ↓
                </button>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="xml">
          {xml ? (
            <pre className="rounded-lg border-2 border-black bg-black text-emerald-300 p-4 text-[10px] font-mono overflow-auto max-h-72 whitespace-pre-wrap">{xml}</pre>
          ) : (
            <Button variant="outline" size="sm" onClick={loadXml} disabled={xmlLoading} className="text-xs border-2 border-black text-black">
              {xmlLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Cog className="h-3.5 w-3.5 mr-1.5" />} Generate STEPXML preview
            </Button>
          )}
        </TabsContent>

        <TabsContent value="issues">
          <div className="rounded-lg border-2 border-black divide-y max-h-60 overflow-auto">
            {stats.topIssues.map((iss, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                <div className="min-w-0">
                  <span className="font-mono text-neutral-700">{iss.attributeId}</span>
                  <span className="ml-2 text-neutral-400">{iss.attribute}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn("rounded border px-1.5 text-[10px]", TYPE_STYLE[iss.type]?.cls ?? "bg-neutral-50 text-neutral-500 border-neutral-200")}>{iss.type}</span>
                  <span className="font-semibold text-neutral-500">×{iss.count}</span>
                </div>
              </div>
            ))}
            {stats.topIssues.length === 0 && <div className="px-3 py-4 text-xs text-neutral-400">No issues — perfect run.</div>}
          </div>
        </TabsContent>
      </Tabs>

      {canEdit && upload.status !== "SENT" && (
        <div className="px-5 py-3.5 border-t-2 border-black bg-neutral-50 flex items-center justify-between gap-3">
          <div className="text-[11px] text-neutral-500 flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-[#DD1C24]" />
            STEPXML akan dikirim ke <b className="font-mono">{upload.endpoint}</b>. Konfirmasi diperlukan.
          </div>
          <Button onClick={onSend} className="bg-[#DD1C24] hover:bg-[#b9151c] text-white" disabled={busy}>
            <Send className="h-4 w-4 mr-1.5" /> Review &amp; send to Stibo
          </Button>
        </div>
      )}
      {upload.status === "SENT" && (
        <div className="px-5 py-3 border-t-2 border-black bg-emerald-50 text-xs text-emerald-700 flex items-center gap-2">
          <CircleCheck className="h-4 w-4" /> File ini sudah terkirim ke Stibo (lihat riwayat di bawah / tab Uploads).
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── sent card ─────────────────────────── */

function SentCard({ job, filename }: { job: Job; filename: string }) {
  const ok = job.status === "SUCCESS";
  return (
    <div className={cn("rounded-2xl border-2 shadow-sm overflow-hidden", ok ? "border-emerald-600" : "border-[#DD1C24]")}>
      <div className={cn("px-5 py-4 flex items-center gap-3", ok ? "bg-emerald-50" : "bg-red-50")}>
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", ok ? "bg-emerald-100" : "bg-red-100")}>
          {ok ? <CircleCheck className="h-5 w-5 text-emerald-600" /> : <CircleAlert className="h-5 w-5 text-[#DD1C24]" />}
        </div>
        <div>
          <div className="text-sm font-semibold text-black">{ok ? "Terkirim ke Stibo" : "Gagal terkirim"}</div>
          <div className="text-[11px] text-neutral-500 truncate max-w-[420px]">{filename}</div>
        </div>
      </div>
      <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {[
          ["Endpoint", job.endpoint], ["Mode", job.mode], ["bgId", job.bgId || "—"], ["HTTP", job.httpStatus || "—"],
          ["Duration", `${job.durationMs} ms`], ["Status", job.status],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border-2 border-black px-3 py-2">
            <div className="text-[10px] text-neutral-400">{k}</div>
            <div className="font-mono font-semibold text-neutral-700 truncate">{v}</div>
          </div>
        ))}
      </div>
      {job.responseSnippet && <pre className="mx-5 mb-4 rounded-lg bg-black text-neutral-200 p-3 text-[10px] font-mono overflow-auto max-h-32 whitespace-pre-wrap">{job.responseSnippet}</pre>}
    </div>
  );
}

/* ─────────────────────────── Q&A table + markdown ─────────────────────────── */

function QaTableCard({ table }: { table: QaTable }) {
  return (
    <div className="rounded-xl border-2 border-black bg-white overflow-hidden mt-2">
      <div className="px-3.5 py-2 border-b-2 border-black bg-neutral-50 text-[11px] font-semibold text-neutral-600 flex items-center gap-1.5">
        <Database className="h-3 w-3 text-[#DD1C24]" /> {table.title}
        <span className="ml-auto text-[10px] text-neutral-400 font-normal">{table.rows.length} baris</span>
      </div>
      <div className="overflow-x-auto max-h-64 overflow-y-auto">
        <table className="w-full text-[11px]">
          <thead className="bg-white border-b sticky top-0">
            <tr>{table.columns.map((c, i) => <th key={i} className="text-left px-3 py-2 font-semibold text-neutral-500 whitespace-nowrap">{c}</th>)}</tr>
          </thead>
          <tbody>
            {table.rows.map((r, ri) => (
              <tr key={ri} className="border-b last:border-0 hover:bg-neutral-50">
                {r.map((c, ci) => <td key={ci} className="px-3 py-1.5 text-neutral-600 whitespace-nowrap max-w-[220px] truncate" title={String(c)}>{String(c)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Minimal answer renderer: paragraphs, - bullets, **bold**, `code`. */
function Markdownish({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <span>
      {lines.map((line, i) => {
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return <span key={i} className="block pl-3 relative"><span className="absolute left-0 text-neutral-400">•</span><Inline text={line.slice(2)} /></span>;
        }
        if (line.startsWith("```") || line.endsWith("```")) return null;
        if (line.trim() === "") return <span key={i} className="block h-1.5" />;
        return <span key={i} className="block"><Inline text={line} /></span>;
      })}
    </span>
  );
}
