"use client";

/**
 * Unified Assistant — one ChatGPT-style thread for everything:
 *   • upload Excel/CSV (sheet confirmation picker) or an image (AI table extraction)
 *   • confirm article context in the LOV-driven wizard → transform
 *   • review ALL template columns, filter/delete rows, edit cells before send
 *   • ask any question — answered inline in the same thread
 * A "New chat" action resets the thread; every message can be copied,
 * and your own messages can be edited & re-sent.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHub, api } from "@/lib/store";
import {
  type LovOptions, type NameInfo, type UploadRecord, type Preview, type Stats,
  type MappedRow, type Job, type WizardAnswers, type Opt,
  UploadCard, WizardCard, ResultCard, SentCard, StatusChip,
} from "@/components/hub/views/pipeline-cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Inline } from "@/components/hub/Markdown";
import {
  Bot, User, UploadCloud, Loader2, ArrowRight, Sparkles, Send,
  Paperclip, BookOpen, Database, History, SquarePen, Copy, Check, Table2, FileImage, Eye,
} from "lucide-react";

/* ─────────────────────────── types ─────────────────────────── */

interface QaTable { title: string; columns: string[]; rows: (string | number)[][] }
interface QaMeta {
  intent?: string; sources?: string[]; table?: QaTable | null;
  chips?: string[]; deepLink?: { view: string; tab?: string } | null;
}

interface SheetPick {
  name: string;
  visible: boolean;
  dataRows: number;
  colCount: number;
  headerPreview: string[];
  recommended?: boolean;
}

type Msg =
  | { kind: "chat"; id: string; role: "user" | "assistant"; content: string; meta?: QaMeta }
  | { kind: "upload"; id: string; upload: UploadRecord; nameInfo: NameInfo; preview: Preview }
  | { kind: "wizard"; id: string; upload: UploadRecord; nameInfo?: NameInfo }
  | { kind: "result"; id: string; upload: UploadRecord; stats: Stats }
  | { kind: "sent"; id: string; job: Job; filename: string };

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];
const ACCEPT = ".xlsx,.xlsm,.xlsb,.xls,.csv,.png,.jpg,.jpeg,.webp";

const SUGGESTED: Array<{ icon: React.ElementType; label: string; q: string }> = [
  { icon: Database, label: "Active brands", q: "Which brands are active in the SPORTS division?" },
  { icon: BookOpen, label: "File naming format", q: "What is the correct file naming format?" },
  { icon: Database, label: "SEASON LOV", q: "Show the SEASON LOV values" },
  { icon: BookOpen, label: "What is an IIEP?", q: "What is an IIEP endpoint?" },
  { icon: History, label: "My uploads", q: "Show my recent uploads" },
  { icon: Sparkles, label: "MANUAL rules", q: "How many MANUAL mapping rules are there?" },
];

/* ─────────────────────────── main ─────────────────────────── */

export function AssistantView() {
  const { user, setView, setMasterTab, setDocsSlug, newChatNonce } = useHub();
  const { toast } = useToast();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [options, setOptions] = useState<LovOptions | null>(null);
  const [history, setHistory] = useState<UploadRecord[]>([]);
  const [sendDialog, setSendDialog] = useState<{ upload: UploadRecord } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  // sheet confirmation (R3)
  const [pendingSheet, setPendingSheet] = useState<{ file: File; sheets: SheetPick[] } | null>(null);
  // message editing (R1)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const canEdit = user?.role === "ADMIN" || user?.role === "EDITOR";

  const resetThread = useCallback(() => {
    setMsgs([]);
    setEditingId(null); setEditText("");
    setPendingSheet(null); setSendDialog(null); setConfirmText("");
  }, []);

  /* "New chat" from the thread header or Topbar → fresh thread */
  useEffect(() => { if (newChatNonce > 0) resetThread(); }, [newChatNonce, resetThread]);

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
      push({ kind: "chat", id: `e-${Date.now()}`, role: "assistant", content: `Sorry, something went wrong: ${(e as Error).message}` });
    } finally { setBusy(false); }
  }, [busy]);

  const isImage = (name: string) => IMAGE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));

  /* file upload → upload card + wizard card (image via AI extraction) */
  const uploadFile = async (file: File) => {
    if (!canEdit) { toast({ title: "Viewers cannot upload files", variant: "destructive" }); return; }
    setBusy(true);
    push({
      kind: "chat", id: `u-${Date.now()}`, role: "user",
      content: isImage(file.name) ? `Upload image: ${file.name}` : `Upload: ${file.name}`,
    });
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (isImage(file.name)) {
        const d = await api<{ upload: UploadRecord; nameInfo: NameInfo; preview: Preview }>("/api/uploads/image", { method: "POST", body: fd });
        push({ kind: "upload", id: `up-${d.upload.id}`, upload: d.upload, nameInfo: d.nameInfo, preview: d.preview });
        push({ kind: "wizard", id: `wz-${d.upload.id}`, upload: d.upload, nameInfo: d.nameInfo });
        toast({ title: "Image processed", description: `${d.preview.totalRows} rows extracted by AI — verify them before sending.` });
      } else {
        const d = await api<{ upload?: UploadRecord; nameInfo?: NameInfo; preview?: Preview; needsSheet?: boolean; sheets?: SheetPick[] }>(
          "/api/uploads", { method: "POST", body: fd }
        );
        if (d.needsSheet && d.sheets) {
          setPendingSheet({ file, sheets: d.sheets });
          push({ kind: "chat", id: `s-${Date.now()}`, role: "assistant", content: `**${file.name}** has multiple sheets. Which sheet should I import? Pick one below — only visible sheets are listed.` });
        } else if (d.upload && d.nameInfo && d.preview) {
          push({ kind: "upload", id: `up-${d.upload.id}`, upload: d.upload, nameInfo: d.nameInfo, preview: d.preview });
          push({ kind: "wizard", id: `wz-${d.upload.id}`, upload: d.upload, nameInfo: d.nameInfo });
        }
      }
      refreshHistory();
    } catch (e) {
      push({ kind: "chat", id: `e-${Date.now()}`, role: "assistant", content: `Failed to process the file: ${(e as Error).message}` });
      toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const confirmSheet = async (sheetName: string) => {
    if (!pendingSheet) return;
    const { file } = pendingSheet;
    setPendingSheet(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("sheet", sheetName);
      const d = await api<{ upload: UploadRecord; nameInfo: NameInfo; preview: Preview }>("/api/uploads", { method: "POST", body: fd });
      push({ kind: "chat", id: `s2-${Date.now()}`, role: "assistant", content: `Importing sheet **${sheetName}** — ${d.preview.totalRows} rows × ${d.preview.headers.length} columns.` });
      push({ kind: "upload", id: `up-${d.upload.id}`, upload: d.upload, nameInfo: d.nameInfo, preview: d.preview });
      push({ kind: "wizard", id: `wz-${d.upload.id}`, upload: d.upload, nameInfo: d.nameInfo });
      refreshHistory();
    } catch (e) {
      push({ kind: "chat", id: `e-${Date.now()}`, role: "assistant", content: `Failed to import sheet: ${(e as Error).message}` });
      toast({ title: "Import failed", description: (e as Error).message, variant: "destructive" });
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
      toast({ title: "Transform complete", description: `${stats.mappedRows} rows mapped — review, filter or edit before sending.` });
    } catch (e) {
      push({ kind: "chat", id: `e-${Date.now()}`, role: "assistant", content: `Transform failed: ${(e as Error).message}` });
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
    if (msgs.some((m) => (m.kind === "wizard" || m.kind === "result") && m.upload.id === id)) return;
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

  /* R1: copy + edit own messages */
  const copyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    } catch {
      toast({ title: "Copy failed", description: "Your browser blocked clipboard access.", variant: "destructive" });
    }
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const newText = editText.trim();
    setEditingId(null); setEditText("");
    if (!newText) return;
    const idx = msgs.findIndex((m) => m.kind === "chat" && m.id === editingId);
    if (idx < 0) return;
    const updated = msgs.slice(0, idx + 1).map((m, i) =>
      i === idx && m.kind === "chat" ? { ...m, content: newText } : m
    );
    setMsgs(updated);
    await ask(newText);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* thread header */}
      <div className="shrink-0 h-11 px-4 border-b-2 border-black bg-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[13px] font-bold text-black">Assistant</span>
          <Badge variant="outline" className="hidden sm:inline-flex text-[9px] border-black text-neutral-600">upload · transform · ask — one thread</Badge>
        </div>
        <Button
          size="sm" onClick={resetThread}
          className="h-7 text-[11px] border-2 border-black bg-white text-black hover:border-[#DD1C24] hover:text-[#DD1C24]"
          title="Start a new chat / new transformation"
        >
          <SquarePen className="h-3.5 w-3.5 mr-1.5" /> New chat
        </Button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* history rail */}
        <div className="hidden xl:flex w-[220px] shrink-0 border-r-2 border-black bg-white flex-col">
          <div className="px-4 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-100">Recent uploads</div>
          <ScrollArea className="flex-1 px-2 pb-3">
            {history.length === 0 && <div className="px-3 py-6 text-xs text-neutral-400">No uploads yet.</div>}
            {history.map((h) => (
              <button key={h.id} onClick={() => openUpload(h.id)} className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-neutral-100 group">
                <div className="flex items-center gap-2">
                  <Table2 className="h-3.5 w-3.5 text-[#DD1C24] shrink-0" />
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
          <ScrollArea className="flex-1 min-h-0">
            <div
              className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-5"
              onDragOver={(e) => { e.preventDefault(); if (canEdit) setDragging(true); }}
              onDragLeave={() => setDragging(false)}
            >
              {msgs.length === 0 && !busy && (
                <EmptyHero userName={user?.name?.split(" ")[0]} canEdit={canEdit} onPick={() => fileRef.current?.click()} onAsk={ask} />
              )}
              {msgs.map((m) => (
                <MsgRow
                  key={m.id} msg={m}
                  copied={copiedId === m.id}
                  onCopy={() => { if (m.kind === "chat") copyMessage(m.id, m.content); }}
                  onStartEdit={() => { if (m.kind === "chat") { setEditingId(m.id); setEditText(m.content); } }}
                  isEditing={editingId === m.id}
                  editText={editText}
                  onEditText={setEditText}
                  onSaveEdit={saveEdit}
                  onCancelEdit={() => { setEditingId(null); setEditText(""); }}
                >
                  {m.kind === "upload" && <UploadCard upload={m.upload} nameInfo={m.nameInfo} preview={m.preview} />}
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
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#DD1C24]" /> Working…
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {dragging && (
            <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm border-4 border-dashed border-[#DD1C24] flex flex-col items-center justify-center pointer-events-none">
              <UploadCloud className="h-10 w-10 text-[#DD1C24] mb-2" />
              <div className="text-sm font-semibold text-black">Drop your file to start the pipeline</div>
              <div className="text-xs text-neutral-500">Excel / CSV — or a photo/screenshot of a table (.png .jpg .webp)</div>
            </div>
          )}

          {/* unified composer: attach + free text */}
          <div className="shrink-0 border-t-2 border-black bg-white p-3 md:px-6">
            <div className="max-w-3xl mx-auto flex items-center gap-2 rounded-2xl border-2 border-black bg-white px-3 py-2 focus-within:border-[#DD1C24] transition-colors">
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }}
              />
              <Button
                variant="ghost" size="icon" disabled={busy || !canEdit}
                className="h-9 w-9 shrink-0 text-neutral-500 hover:text-[#DD1C24] hover:bg-neutral-100"
                onClick={() => fileRef.current?.click()}
                aria-label="Attach Excel, CSV or image"
                title={canEdit ? "Attach Excel / CSV / image (png, jpg, webp)" : "Viewer role — ask an Admin to upload"}
              >
                <Paperclip className="h-4.5 w-4.5" />
              </Button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }}
                disabled={busy}
                placeholder={canEdit ? "Ask anything, or attach a file to start the pipeline…" : "Ask anything… (viewer)"}
                className="flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
                aria-label="Question or command"
              />
              <Button
                size="icon" disabled={busy || !input.trim()}
                onClick={() => ask(input)}
                className="h-9 w-9 rounded-full bg-[#DD1C24] hover:bg-[#b9151c] text-white shrink-0"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-w-3xl mx-auto mt-1.5 px-1 text-[10px] text-neutral-400 flex flex-wrap items-center justify-between gap-1">
              <span>Enter to send · Shift+Enter for a new line · drag &amp; drop files anywhere · images are read by AI table extraction</span>
              <span className="font-mono">naming: 0888-SP-BRAND-FileType-Gender-Season-CC-1.xlsx</span>
            </div>
          </div>
        </div>
      </div>

      {/* sheet confirmation dialog (R3) */}
      <Dialog open={!!pendingSheet} onOpenChange={(o) => { if (!o) setPendingSheet(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm"><Table2 className="h-4 w-4 text-[#DD1C24]" /> Choose the sheet to import</DialogTitle>
            <DialogDescription>
              <b className="text-neutral-700">{pendingSheet?.file.name}</b> has multiple sheets. Only <b>visible</b> sheets are listed — hidden sheets are never imported automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[320px] overflow-y-auto rounded-lg border-2 border-black divide-y">
            {(pendingSheet?.sheets ?? []).filter((s) => s.visible).map((s) => (
              <button
                key={s.name}
                onClick={() => confirmSheet(s.name)}
                className={cn("w-full text-left px-4 py-3 hover:bg-red-50/50 transition-colors flex items-center gap-3", s.recommended && "bg-neutral-50")}
              >
                <Table2 className="h-4 w-4 text-neutral-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-neutral-800 flex items-center gap-2">
                    {s.name}
                    {s.recommended && <Badge className="h-4 px-1.5 text-[9px] bg-[#DD1C24] text-white border-0">recommended</Badge>}
                  </div>
                  <div className="text-[10px] text-neutral-400 truncate">{s.dataRows} rows × {s.colCount} cols{s.headerPreview.length ? ` · ${s.headerPreview.slice(0, 5).join(", ")}` : ""}</div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-neutral-300 shrink-0" />
              </button>
            ))}
            {(pendingSheet?.sheets ?? []).every((s) => !s.visible) && (
              <div className="px-4 py-6 text-xs text-neutral-400 text-center">No visible sheets with data — every sheet in this workbook is hidden.</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setPendingSheet(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2-phase confirm dialog */}
      <Dialog open={!!sendDialog} onOpenChange={(o) => { if (!o) { setSendDialog(null); setConfirmText(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#DD1C24]">
              <Sparkles className="h-5 w-5" /> Confirm send to Stibo STEP
            </DialogTitle>
            <DialogDescription>
              XML will be POSTed to endpoint <b>{sendDialog?.upload.endpoint}</b> for brand <b>{sendDialog?.upload.brandName}</b> (season {sendDialog?.upload.season}). This is recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-neutral-50 border-2 border-black p-3 text-xs text-neutral-600 space-y-1">
              <div className="flex justify-between"><span>File</span><span className="font-mono truncate max-w-[200px]">{sendDialog?.upload.filename}</span></div>
              <div className="flex justify-between"><span>Rows (preview)</span><span>{sendDialog?.upload.processedRows || sendDialog?.upload.totalRows}</span></div>
              <div className="flex justify-between"><span>Mode</span><span className="font-semibold">{sendDialog?.upload.mode || "MOCK"}</span></div>
            </div>
            <Input
              value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
              placeholder='Type SEND to confirm' autoComplete="off"
            />
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

/* ─────────────────────────── row wrapper (copy/edit) ─────────────────────────── */

function MsgRow({ msg, children, copied, onCopy, onStartEdit, isEditing, editText, onEditText, onSaveEdit, onCancelEdit }: {
  msg: Msg; children?: React.ReactNode;
  copied: boolean; onCopy: () => void; onStartEdit: () => void;
  isEditing: boolean; editText: string; onEditText: (v: string) => void; onSaveEdit: () => void; onCancelEdit: () => void;
}) {
  if (msg.kind === "chat") {
    const isUser = msg.role === "user";
    return (
      <div className="space-y-1">
        <div className={cn("group flex gap-3", isUser && "flex-row-reverse")}>
          <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0 border-2", isUser ? "bg-neutral-100 border-black" : "bg-black border-black")}>
            {isUser ? <User className="h-4 w-4 text-neutral-700" /> : <Bot className="h-4 w-4 text-[#DD1C24]" />}
          </div>
          <div className={cn("max-w-[85%] min-w-0", isUser && "flex flex-col items-end")}>
            {isEditing ? (
              <div className={cn("w-full max-w-[560px] rounded-2xl border-2 border-[#DD1C24] bg-white p-3 space-y-2")}>
                <textarea
                  value={editText}
                  onChange={(e) => onEditText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSaveEdit(); if (e.key === "Escape") onCancelEdit(); }}
                  rows={3}
                  className="w-full text-sm text-neutral-800 outline-none resize-y border border-neutral-200 rounded-lg p-2 focus:border-[#DD1C24]"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={onCancelEdit}>Cancel</Button>
                  <Button size="sm" className="h-7 text-[11px] bg-[#DD1C24] hover:bg-[#b9151c] text-white" onClick={onSaveEdit}>
                    <Check className="h-3 w-3 mr-1" /> Save &amp; resend
                  </Button>
                </div>
              </div>
            ) : (
              <div className={cn(
                "rounded-2xl px-4 py-3 text-sm leading-relaxed select-text cursor-text",
                isUser ? "bg-[#DD1C24] text-white rounded-tr-sm" : "bg-white border-2 border-black rounded-tl-sm text-neutral-700"
              )}>
                {isUser ? msg.content : <Markdownish text={msg.content} />}
              </div>
            )}
            {/* hover actions: copy (all) + edit (own messages) */}
            {!isEditing && (
              <div className={cn("flex items-center gap-1 px-1 pt-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity", isUser && "flex-row-reverse")}>
                <button
                  onClick={onCopy}
                  className="inline-flex items-center gap-1 text-[10px] text-neutral-400 hover:text-[#DD1C24] px-1 py-0.5 rounded"
                  title="Copy message"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />} {copied ? "Copied" : "Copy"}
                </button>
                {isUser && (
                  <button
                    onClick={onStartEdit}
                    className="inline-flex items-center gap-1 text-[10px] text-neutral-400 hover:text-[#DD1C24] px-1 py-0.5 rounded"
                    title="Edit & resend"
                  >
                    <SquarePen className="h-3 w-3" /> Edit
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        {/* extras (data table, sources, chips) hang below the assistant bubble */}
        {!isUser && !isEditing && children}
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
              Open page <ArrowRight className="h-3 w-3" />
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
            <div className="text-sm font-bold text-black">Hi {userName ?? "there"}! How can I help?</div>
            <div className="text-[11px] text-neutral-500">Upload a brand file for the Stibo pipeline, or ask anything about the master data.</div>
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
              <div className="text-sm font-semibold text-black">Upload a brand file (.xlsx / .csv) or an image (.png / .jpg)</div>
              <div className="text-[11px] text-neutral-500">
                I validate the file name, confirm which sheet to import (hidden sheets are skipped), map everything to Stibo attributes with the LOV wizard — and photos of tables are read by AI extraction.
              </div>
            </div>
            {canEdit && <Badge variant="outline" className="border-black text-black">Browse files</Badge>}
          </div>
        </button>
        <div className="px-6 py-4">
          <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2.5">Or try asking</div>
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

/* ─────────────────────────── Q&A table + markdown ─────────────────────────── */

function QaTableCard({ table }: { table: QaTable }) {
  return (
    <div className="rounded-xl border-2 border-black bg-white overflow-hidden mt-2 max-w-full">
      <div className="px-3.5 py-2 border-b-2 border-black bg-neutral-50 text-[11px] font-semibold text-neutral-600 flex items-center gap-1.5">
        <Database className="h-3 w-3 text-[#DD1C24]" /> {table.title}
        <span className="ml-auto text-[10px] text-neutral-400 font-normal">{table.rows.length} rows</span>
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

/* keep unused-import linter happy for types referenced by JSDoc only */
export type { Opt, MappedRow, Preview };
