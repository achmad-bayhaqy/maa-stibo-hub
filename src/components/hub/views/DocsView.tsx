"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, exportCsv, useHub } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Markdown } from "@/components/hub/Markdown";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  BookOpen, Search, Loader2, Plus, Pencil, Trash2, FileText, Clock, User, Download,
} from "lucide-react";

interface DocMeta {
  id: string; slug: string; title: string; category: string; order: number;
  summary: string; updatedBy: string; updatedAt: string;
}
interface DocFull extends DocMeta { body: string }

const CATEGORY_ORDER = ["Guide", "Reference", "Integration", "Governance"];
const CATEGORY_BADGE: Record<string, string> = {
  Guide: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Reference: "border-sky-200 bg-sky-50 text-sky-700",
  Integration: "border-violet-200 bg-violet-50 text-violet-700",
  Governance: "border-amber-200 bg-amber-50 text-amber-700",
};

export function DocsView() {
  const { user, docsSlug, setDocsSlug } = useHub();
  const { toast } = useToast();
  const canEdit = user?.role === "ADMIN" || user?.role === "EDITOR";
  const isAdmin = user?.role === "ADMIN";

  const [pages, setPages] = useState<DocMeta[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<DocFull | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [editing, setEditing] = useState<Partial<DocFull> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ pages: DocMeta[] }>(`/api/docs?q=${encodeURIComponent(q)}`);
      setPages(d.pages);
      return d.pages;
    } finally { setLoading(false); }
  }, [q]);

  useEffect(() => { load().catch(() => undefined); }, [load]);

  // Load current doc (by slug from store or first page)
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingDoc(true);
      try {
        const target = pages.find((p) => p.slug === docsSlug)?.slug ?? pages[0]?.slug;
        if (!target) { setCurrent(null); return; }
        const d = await api<DocFull>(`/api/docs/${target}`);
        if (alive) setCurrent(d);
      } finally { if (alive) setLoadingDoc(false); }
    })();
    return () => { alive = false; };
  }, [pages, docsSlug]);

  const grouped = useMemo(() => {
    const map = new Map<string, DocMeta[]>();
    for (const p of pages) {
      if (!map.has(p.category)) map.set(p.category, []);
      map.get(p.category)!.push(p);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({ category: c, items: map.get(c)! }))
      .concat([...map.keys()].filter((c) => !CATEGORY_ORDER.includes(c)).map((c) => ({ category: c, items: map.get(c)! })));
  }, [pages]);

  const save = async () => {
    if (!editing?.title) return;
    setBusy(true);
    try {
      if (editing.id) {
        await api(`/api/docs/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title: editing.title, category: editing.category, summary: editing.summary, bodyContent: editing.body, order: editing.order }),
        });
      } else {
        await api("/api/docs", {
          method: "POST",
          body: JSON.stringify({ slug: editing.slug, title: editing.title, category: editing.category, summary: editing.summary, bodyContent: editing.body, order: editing.order }),
        });
      }
      toast({ title: editing.id ? "Halaman diperbarui" : "Halaman dibuat" });
      setEditing(null);
      await load();
    } catch (e) {
      toast({ title: "Gagal menyimpan", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const remove = async (p: DocMeta) => {
    if (!confirm(`Hapus halaman "${p.title}"?`)) return;
    try {
      await api(`/api/docs/${p.id}`, { method: "DELETE" });
      toast({ title: "Halaman dihapus" });
      if (current?.id === p.id) setCurrent(null);
      await load();
    } catch (e) {
      toast({ title: "Gagal menghapus", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-violet-100 border border-violet-200 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 leading-tight">Documentation Center</h2>
            <p className="text-xs text-slate-500">Panduan sistem, referensi integrasi Stibo, dan tata kelola — {pages.length} halaman.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari di semua halaman…" className="pl-8 h-9 w-52 md:w-64 text-xs" />
          </div>
          {canEdit && (
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white h-9"
              onClick={() => setEditing({ category: "Guide", order: 200, title: "", slug: "", summary: "", body: "" })}>
              <Plus className="h-4 w-4 mr-1" /> New page
            </Button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-[270px_1fr] gap-4">
        {/* TOC sidebar */}
        <div className="space-y-3">
          {loading && <div className="rounded-xl border bg-white p-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-300" /></div>}
          {!loading && grouped.map((g) => (
            <div key={g.category} className="rounded-xl border bg-white overflow-hidden">
              <div className="px-3.5 py-2.5 border-b bg-slate-50 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{g.category}</span>
                <span className="text-[10px] text-slate-400">{g.items.length}</span>
              </div>
              <div className="py-1">
                {g.items.map((p) => (
                  <button key={p.id}
                    onClick={() => setDocsSlug(p.slug)}
                    className={cn(
                      "w-full text-left px-3.5 py-2 text-xs flex items-start gap-2 hover:bg-slate-50 group",
                      (current?.slug === p.slug) && "bg-violet-50 border-l-2 border-violet-500"
                    )}>
                    <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400 group-hover:text-violet-500" />
                    <span className="min-w-0">
                      <span className={cn("block font-medium leading-snug", current?.slug === p.slug ? "text-violet-800" : "text-slate-700")}>{p.title}</span>
                      {p.summary && <span className="block text-[10px] text-slate-400 leading-snug line-clamp-2">{p.summary}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {!loading && pages.length === 0 && (
            <div className="rounded-xl border bg-white p-8 text-center text-xs text-slate-400">Tidak ada halaman cocok &quot;{q}&quot;</div>
          )}
        </div>

        {/* Content */}
        <div className="rounded-xl border bg-white min-w-0">
          {loadingDoc && <div className="p-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-300" /></div>}
          {!loadingDoc && current && (
            <>
              <div className="px-5 md:px-8 pt-5 pb-4 border-b flex flex-wrap items-start justify-between gap-3 bg-slate-50/50 rounded-t-xl">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={CATEGORY_BADGE[current.category] ?? ""}>{current.category}</Badge>
                    <span className="font-mono text-[10px] text-slate-400">/{current.slug}</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mt-1.5">{current.title}</h3>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(current.updatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                    <span className="flex items-center gap-1"><User className="h-3 w-3" /> {current.updatedBy}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" className="h-8 text-xs"
                    onClick={() => exportCsv(`${current.slug}.md.txt`, ["content"], [[current.body]])}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {canEdit && (
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setEditing({ ...current })}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                  )}
                  {isAdmin && (
                    <Button variant="ghost" size="sm" className="h-8 text-red-500" onClick={() => remove(current)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="px-5 md:px-8 py-5 max-h-[calc(100vh-290px)] overflow-y-auto">
                <Markdown text={current.body} onNavigate={(slug) => setDocsSlug(slug)} />
              </div>
            </>
          )}
          {!loadingDoc && !current && (
            <div className="p-16 text-center text-sm text-slate-400">Pilih halaman dari daftar di kiri.</div>
          )}
        </div>
      </div>

      {/* Editor dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-sm">{editing?.id ? `Edit: ${editing.title}` : "Halaman dokumentasi baru"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Judul</Label>
                <Input value={editing?.title ?? ""} onChange={(e) => setEditing((p) => ({ ...p!, title: e.target.value }))} className="h-9" /></div>
              <div className="space-y-1"><Label className="text-xs">Slug (URL)</Label>
                <Input value={editing?.slug ?? ""} disabled={!!editing?.id} onChange={(e) => setEditing((p) => ({ ...p!, slug: e.target.value.toLowerCase() }))} className="h-9 font-mono text-xs" placeholder="my-page" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Kategori</Label>
                <Select value={editing?.category ?? "Guide"} onValueChange={(v) => setEditing((p) => ({ ...p!, category: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORY_ORDER.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Urutan</Label>
                <Input type="number" value={editing?.order ?? 200} onChange={(e) => setEditing((p) => ({ ...p!, order: Number(e.target.value) }))} className="h-9" /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Ringkasan</Label>
              <Input value={editing?.summary ?? ""} onChange={(e) => setEditing((p) => ({ ...p!, summary: e.target.value }))} className="h-9 text-xs" /></div>
            <div className="space-y-1">
              <Label className="text-xs">Konten (Markdown — heading, tabel, list, code block didukung)</Label>
              <Textarea value={editing?.body ?? ""} onChange={(e) => setEditing((p) => ({ ...p!, body: e.target.value }))} rows={14} className="font-mono text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={busy || !editing?.title} className="bg-orange-500 hover:bg-orange-600 text-white">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
