"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, useHub } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Inline } from "@/components/hub/Markdown";
import {
  Bot, User, Send, Sparkles, Trash2, Loader2, ArrowRight, BookOpen, Database, History,
} from "lucide-react";

/* ─────────────────────────── types ─────────────────────────── */

interface QaTable { title: string; columns: string[]; rows: (string | number)[][] }
interface AskResponse {
  intent: string;
  answer: string;
  table?: QaTable;
  sources: string[];
  chips: string[];
  deepLink?: { view: string; tab?: string };
}
interface QaMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  meta?: { intent?: string; sources?: string[]; table?: QaTable | null; chips?: string[]; deepLink?: AskResponse["deepLink"] | null };
}
const SUGGESTED: Array<{ icon: React.ElementType; label: string; q: string }> = [
  { icon: Database, label: "Brand aktif", q: "Brand apa saja yang aktif di divisi SPORTS?" },
  { icon: BookOpen, label: "Format nama file", q: "Bagaimana format nama file yang benar?" },
  { icon: Sparkles, label: "Rule MANUAL", q: "Ada berapa rule bertipe MANUAL?" },
  { icon: Database, label: "LOV SEASON", q: "Nilai LOV untuk SEASON" },
  { icon: History, label: "Upload saya", q: "Upload terakhir saya apa saja?" },
  { icon: BookOpen, label: "Apa itu IIEP?", q: "Apa itu IIEP endpoint?" },
];

/* ─────────────────────────── component ─────────────────────────── */

export function QaChat() {
  const { user, setView, setMasterTab, setDocsSlug } = useHub();
  const { toast } = useToast();
  const [messages, setMessages] = useState<QaMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<{ messages: QaMessage[] }>("/api/assistant/history")
      .then((d) => setMessages(d.messages))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  const send = useCallback(async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: q }]);
    try {
      const res = await api<AskResponse>("/api/assistant/ask", { method: "POST", body: JSON.stringify({ question: q }) });
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: res.answer, meta: res }]);
    } catch (e) {
      toast({ title: "Assistant error", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  }, [busy, toast]);

  const clearHistory = async () => {
    try {
      await api("/api/assistant/history", { method: "DELETE" });
      setMessages([]);
      toast({ title: "Riwayat dihapus" });
    } catch (e) {
      toast({ title: "Gagal menghapus riwayat", description: (e as Error).message, variant: "destructive" });
    }
  };

  const navigate = (deepLink?: AskResponse["deepLink"]) => {
    if (!deepLink) return;
    if (deepLink.view === "master" && deepLink.tab) setMasterTab(deepLink.tab as never);
    if (deepLink.view === "docs" && deepLink.tab) setDocsSlug(deepLink.tab);
    setView(deepLink.view as never);
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto w-full">
      {/* header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white/60 backdrop-blur">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-full bg-violet-100 border border-violet-200 flex items-center justify-center shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-violet-600" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-slate-800 leading-tight">Tanya apa saja</div>
            <div className="text-[10px] text-slate-500 leading-tight">Jawaban berbasis data master live — bukan teks statis</div>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-[11px] text-slate-400 hover:text-red-500" onClick={clearHistory}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loaded && messages.length === 0 && (
          <div className="pt-6 pb-2 text-center">
            <div className="h-12 w-12 mx-auto rounded-2xl bg-violet-100 border border-violet-200 flex items-center justify-center mb-3">
              <Sparkles className="h-6 w-6 text-violet-600" />
            </div>
            <div className="text-sm font-bold text-slate-800">Halo {user?.name?.split(" ")[0]}! Saya STIBO Hub Assistant.</div>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Saya bisa menjawab pertanyaan tentang brand, atribut, mapping rules, LOV, naming routes, RNA, status pipeline Anda, dan dokumentasi sistem.
            </p>
            <div className="grid sm:grid-cols-2 gap-2 mt-5 max-w-lg mx-auto text-left">
              {SUGGESTED.map((s) => (
                <button key={s.label} onClick={() => send(s.q)}
                  className="flex items-center gap-2.5 rounded-xl border bg-white px-3.5 py-3 text-xs hover:border-violet-300 hover:bg-violet-50/50 transition-colors group">
                  <s.icon className="h-4 w-4 text-slate-400 group-hover:text-violet-600 shrink-0" />
                  <span className="font-medium text-slate-700">{s.label}</span>
                  <ArrowRight className="h-3 w-3 ml-auto text-slate-300 group-hover:text-violet-500" />
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => <QaBubble key={m.id} m={m} onChip={send} onNavigate={navigate} />)}

        {busy && (
          <div className="flex items-start gap-2.5">
            <div className="h-8 w-8 rounded-full bg-[#0B1626] flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-orange-400" />
            </div>
            <div className="rounded-2xl rounded-tl-md bg-white border px-4 py-3 flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Mencari di data master…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* composer */}
      <div className="border-t bg-white px-4 py-3">
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Contoh: "SBU untuk brand ELL di ID" atau "rule mapping adidas"…'
            className="h-10 rounded-full text-sm"
            disabled={busy}
          />
          <Button type="submit" size="icon" disabled={busy || !input.trim()}
            className="h-10 w-10 rounded-full bg-[#0B1626] hover:bg-[#16283f] text-orange-400 shrink-0" aria-label="Kirim pertanyaan">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────────── bubble ─────────────────────────── */

function QaBubble({ m, onChip, onNavigate }: { m: QaMessage; onChip: (q: string) => void; onNavigate: (l?: AskResponse["deepLink"]) => void }) {
  const isUser = m.role === "user";
  return (
    <div className={cn("flex items-start gap-2.5", isUser && "justify-end")}>
      {!isUser && (
        <div className="h-8 w-8 rounded-full bg-[#0B1626] flex items-center justify-center shrink-0">
          <Bot className="h-4 w-4 text-orange-400" />
        </div>
      )}
      <div className={cn("max-w-[85%] space-y-2", isUser && "max-w-[75%]")}>
        <div className={cn(
          "rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
          isUser ? "bg-[#0B1626] text-slate-100 rounded-tr-md" : "bg-white border text-slate-700 rounded-tl-md"
        )}>
          {isUser ? m.content : <Markdownish text={m.content} />}
        </div>

        {/* data table card */}
        {m.meta?.table && <QaTableCard table={m.meta.table} />}

        {/* sources + deep link */}
        {!isUser && (m.meta?.sources?.length || m.meta?.deepLink) && (
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            {m.meta?.sources?.map((s, i) => (
              <Badge key={i} variant="outline" className="text-[9px] border-slate-200 bg-slate-50 text-slate-500 gap-1">
                <BookOpen className="h-2.5 w-2.5" /> {s}
              </Badge>
            ))}
            {m.meta?.deepLink && (
              <button onClick={() => onNavigate(m.meta?.deepLink ?? undefined)}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-600 hover:underline px-1">
                Buka halaman <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* follow-up chips */}
        {!isUser && m.meta?.chips && m.meta.chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1 pt-0.5">
            {m.meta.chips.slice(0, 4).map((c, i) => (
              <button key={i} onClick={() => onChip(c)}
                className="px-2.5 py-1 rounded-full border bg-white text-[10px] text-slate-600 hover:border-violet-300 hover:bg-violet-50 transition-colors">
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
      {isUser && (
        <div className="h-8 w-8 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center shrink-0">
          <User className="h-4 w-4 text-orange-600" />
        </div>
      )}
    </div>
  );
}

function QaTableCard({ table }: { table: QaTable }) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="px-3.5 py-2 border-b bg-slate-50 text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
        <Database className="h-3 w-3 text-slate-400" /> {table.title}
        <span className="ml-auto text-[10px] text-slate-400 font-normal">{table.rows.length} baris</span>
      </div>
      <div className="overflow-x-auto max-h-64 overflow-y-auto">
        <table className="w-full text-[11px]">
          <thead className="bg-white border-b sticky top-0">
            <tr>{table.columns.map((c, i) => <th key={i} className="text-left px-3 py-2 font-semibold text-slate-500 whitespace-nowrap">{c}</th>)}</tr>
          </thead>
          <tbody>
            {table.rows.map((r, ri) => (
              <tr key={ri} className="border-b last:border-0 hover:bg-slate-50/60">
                {r.map((c, ci) => <td key={ci} className="px-3 py-1.5 text-slate-600 whitespace-nowrap max-w-[220px] truncate" title={String(c)}>{String(c)}</td>)}
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
          return <span key={i} className="block pl-3 relative"><span className="absolute left-0 text-slate-400">•</span><Inline text={line.slice(2)} /></span>;
        }
        if (line.startsWith("```") || line.endsWith("```")) return null;
        if (line.trim() === "") return <span key={i} className="block h-1.5" />;
        return <span key={i} className="block"><Inline text={line} /></span>;
      })}
    </span>
  );
}
