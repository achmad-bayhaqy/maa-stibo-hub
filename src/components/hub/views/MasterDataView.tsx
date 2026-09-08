"use client";

import { useCallback, useEffect, useState } from "react";
import { api, useHub } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Plus, Search, Loader2, Pencil, Trash2, ChevronLeft, ChevronRight, Database } from "lucide-react";

type Tab = "brands" | "attributes" | "lov" | "rules";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "brands", label: "Brands" },
  { key: "attributes", label: "Attributes" },
  { key: "lov", label: "LOV Tables" },
  { key: "rules", label: "Mapping Rules" },
];

const TYPE_BADGE: Record<string, string> = {
  SYSTEM_FORMULA: "border-sky-200 bg-sky-50 text-sky-700",
  DIRECT: "border-emerald-200 bg-emerald-50 text-emerald-700",
  MANUAL_PORTAL: "border-orange-200 bg-orange-50 text-orange-700",
  MANUAL: "border-amber-200 bg-amber-50 text-amber-700",
  MANUAL_DIRECT: "border-amber-200 bg-amber-50 text-amber-700",
  AI_ASSIST: "border-violet-200 bg-violet-50 text-violet-700",
  MAPPING: "border-teal-200 bg-teal-50 text-teal-700",
  NOT_AVAILABLE: "border-slate-200 bg-slate-50 text-slate-500",
  EXTERNAL_SOURCE: "border-rose-200 bg-rose-50 text-rose-700",
};

export function MasterDataView() {
  const { masterTab, setMasterTab, user } = useHub();
  const canEdit = user?.role === "ADMIN" || user?.role === "EDITOR";
  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <h2 className="text-lg font-bold text-slate-800">Data Master</h2>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">
        Referensi yang memakai mesin pemetaan — diekstrak dari Brand Mapping Template, MDD, dan RNA workbook.
      </p>
      <div className="flex gap-1.5 mb-5 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setMasterTab(t.key)}
            className={cn("px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
              masterTab === t.key ? "bg-[#0B1626] text-white" : "bg-white border text-slate-600 hover:bg-slate-50")}>
            {t.label}
          </button>
        ))}
      </div>
      {masterTab === "brands" && <BrandsTab canEdit={canEdit} isAdmin={isAdmin} />}
      {masterTab === "attributes" && <AttributesTab canEdit={canEdit} />}
      {masterTab === "lov" && <LovTab />}
      {masterTab === "rules" && <RulesTab canEdit={canEdit} />}
    </div>
  );
}

/* ── Brands ── */
interface Brand { id: string; code: string; name: string; division: string; status: string; fileTypes: string[] }

function BrandsTab({ canEdit, isAdmin }: { canEdit: boolean; isAdmin: boolean }) {
  const { toast } = useToast();
  const [items, setItems] = useState<Brand[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<Brand> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await api<Brand[]>(`/api/brands?q=${encodeURIComponent(q)}`)); } finally { setLoading(false); }
  }, [q]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!edit?.code || !edit.name) return;
    setBusy(true);
    try {
      if (edit.id) await api(`/api/brands/${edit.id}`, { method: "PATCH", body: JSON.stringify({ name: edit.name, division: edit.division, status: edit.status }) });
      else await api("/api/brands", { method: "POST", body: JSON.stringify({ code: edit.code, name: edit.name, division: edit.division, status: edit.status }) });
      toast({ title: edit.id ? "Brand updated" : "Brand created" });
      setEdit(null); load();
    } catch (e) { toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  return (
    <Panel
      title={`${items.length} brands`}
      search={<SearchBox value={q} onChange={setQ} placeholder="Cari kode / nama brand…" />}
      action={canEdit && <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setEdit({ division: "SPORTS", status: "ACTIVE" })}><Plus className="h-4 w-4 mr-1" /> Add brand</Button>}
    >
      <table className="w-full text-xs">
        <thead className="bg-slate-50 border-b"><tr>{["Code", "Name", "Division", "Status", "File types", ""].map((h) => <th key={h} className="text-left px-4 py-2.5 font-semibold text-slate-500">{h}</th>)}</tr></thead>
        <tbody>
          {loading && <Row colSpan={6}><Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-300" /></Row>}
          {!loading && items.map((b) => (
            <tr key={b.id} className="border-b last:border-0 hover:bg-slate-50/60">
              <td className="px-4 py-2.5 font-mono font-bold text-slate-700">{b.code}</td>
              <td className="px-4 py-2.5 font-medium text-slate-700">{b.name}</td>
              <td className="px-4 py-2.5 text-slate-500">{b.division}</td>
              <td className="px-4 py-2.5"><Badge variant="outline" className={b.status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200"}>{b.status}</Badge></td>
              <td className="px-4 py-2.5 text-slate-500 truncate max-w-[220px]">{b.fileTypes?.slice(0, 3).join(", ") || "—"}</td>
              <td className="px-4 py-2.5">
                {canEdit && (
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="sm" className="h-7" onClick={() => setEdit(b)}><Pencil className="h-3.5 w-3.5" /></Button>
                    {isAdmin && <Button variant="ghost" size="sm" className="h-7 text-red-500" onClick={async () => { if (confirm(`Delete brand ${b.code}?`)) { await api(`/api/brands/${b.id}`, { method: "DELETE" }); load(); } }}><Trash2 className="h-3.5 w-3.5" /></Button>}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">{edit?.id ? "Edit brand" : "New brand"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Code</Label><Input value={edit?.code ?? ""} disabled={!!edit?.id} onChange={(e) => setEdit((p) => ({ ...p!, code: e.target.value.toUpperCase() }))} className="h-9 font-mono" /></div>
            <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={edit?.name ?? ""} onChange={(e) => setEdit((p) => ({ ...p!, name: e.target.value }))} className="h-9" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Division</Label><Input value={edit?.division ?? ""} onChange={(e) => setEdit((p) => ({ ...p!, division: e.target.value }))} className="h-9" /></div>
              <div className="space-y-1"><Label className="text-xs">Status</Label>
                <select value={edit?.status ?? "ACTIVE"} onChange={(e) => setEdit((p) => ({ ...p!, status: e.target.value }))} className="h-9 w-full rounded-md border bg-white px-2 text-sm">
                  <option>ACTIVE</option><option>INACTIVE</option><option>ONBOARDING</option>
                </select></div>
            </div>
          </div>
          <DialogFooter><Button onClick={save} disabled={busy || !edit?.code || !edit?.name} className="bg-orange-500 hover:bg-orange-600 text-white">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

/* ── Attributes ── */
interface Attr { id: string; code: string; name: string; validation: string }

function AttributesTab({ canEdit }: { canEdit: boolean }) {
  const [data, setData] = useState<{ items: Attr[]; total: number }>({ items: [], total: 0 });
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const d = await api<{ items: Attr[]; total: number }>(`/api/attributes?q=${encodeURIComponent(q)}&page=${page}&pageSize=25`);
        if (alive) setData(d);
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [q, page]);

  return (
    <Panel title={`${data.total} attributes (MDD Core)`} search={<SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Cari AT_… / nama…" />}>
      <table className="w-full text-xs">
        <thead className="bg-slate-50 border-b"><tr>{["Attribute ID", "Name", "Validation", ""].map((h) => <th key={h} className="text-left px-4 py-2.5 font-semibold text-slate-500">{h}</th>)}</tr></thead>
        <tbody>
          {loading && <Row colSpan={4}><Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-300" /></Row>}
          {!loading && data.items.map((a) => (
            <tr key={a.id} className="border-b last:border-0 hover:bg-slate-50/60">
              <td className="px-4 py-2.5 font-mono font-semibold text-slate-700">{a.code}</td>
              <td className="px-4 py-2.5 text-slate-600">{a.name}</td>
              <td className="px-4 py-2.5"><Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">{a.validation}</Badge></td>
              <td className="px-4 py-2.5 text-right text-slate-300"><Database className="h-3.5 w-3.5 inline" /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager page={page} total={data.total} onChange={setPage} />
    </Panel>
  );
}

/* ── LOV ── */
interface LovTableMeta { id: string; key: string; sheetName: string; valueCount: number }
interface LovValue { id: string; code: string; label: string }

function LovTab() {
  const [tables, setTables] = useState<LovTableMeta[]>([]);
  const [sel, setSel] = useState<string>("");
  const [q, setQ] = useState("");
  const [values, setValues] = useState<{ items: LovValue[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { api<LovTableMeta[]>("/api/lov").then((t) => { setTables(t); if (t.length) setSel(t[0].key); }).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    if (!sel) return;
    api<{ items: LovValue[]; total: number }>(`/api/lov/${sel}?q=${encodeURIComponent(q)}&pageSize=60`).then(setValues).catch(() => undefined);
  }, [sel, q]);

  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-4">
      <Panel title={`${tables.length} LOV tables`}>
        <div className="max-h-[420px] overflow-auto divide-y">
          {loading && <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-300" /></div>}
          {tables.map((t) => (
            <button key={t.id} onClick={() => setSel(t.key)}
              className={cn("w-full text-left px-4 py-2.5 text-xs flex items-center justify-between hover:bg-slate-50", sel === t.key && "bg-orange-50 border-l-2 border-orange-500")}>
              <span className="font-mono font-semibold text-slate-700 truncate">{t.sheetName}</span>
              <span className="text-[10px] text-slate-400 shrink-0 ml-2">{t.valueCount}</span>
            </button>
          ))}
        </div>
      </Panel>
      <Panel title={sel ? `${values.total} values in ${sel}` : "Select a table"} search={<SearchBox value={q} onChange={setQ} placeholder="Cari code / label…" />}>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b sticky top-0"><tr>{["Code", "Label"].map((h) => <th key={h} className="text-left px-4 py-2.5 font-semibold text-slate-500">{h}</th>)}</tr></thead>
            <tbody>
              {values.items.map((v) => (
                <tr key={v.id} className="border-b last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-2 font-mono font-semibold text-slate-700">{v.code}</td>
                  <td className="px-4 py-2 text-slate-600">{v.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/* ── Rules ── */
interface Rule { id: string; brandSheet: string; brandCode: string; attribute: string; attributeId: string; mappingType: string; sourceField: string; logic: string; validation: string }
interface RulesResp { items: Rule[]; total: number; byType: Array<{ mappingType: string; _count: { mappingType: number } }>; brandSheets: Array<{ brandSheet: string; brandCode: string; count: number }> }

function RulesTab({ canEdit }: { canEdit: boolean }) {
  const [data, setData] = useState<RulesResp | null>(null);
  const [brand, setBrand] = useState("");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const d = await api<RulesResp>(`/api/rules?brand=${encodeURIComponent(brand)}&type=${encodeURIComponent(type)}&q=${encodeURIComponent(q)}&page=${page}&pageSize=25`);
        if (alive) setData(d);
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [brand, type, q, page]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={!brand} onClick={() => { setBrand(""); setPage(1); }}>All brands</FilterChip>
        {data?.brandSheets.filter((b) => b.brandCode).slice(0, 14).map((b) => (
          <FilterChip key={b.brandSheet} active={brand === b.brandCode} onClick={() => { setBrand(b.brandCode); setPage(1); }}>
            {b.brandCode} <span className="opacity-50">{b.count}</span>
          </FilterChip>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={!type} onClick={() => { setType(""); setPage(1); }}>All types</FilterChip>
        {data?.byType.sort((a, b) => b._count.mappingType - a._count.mappingType).map((t) => (
          <FilterChip key={t.mappingType} active={type === t.mappingType} onClick={() => { setType(t.mappingType); setPage(1); }}>
            {t.mappingType} <span className="opacity-50">{t._count.mappingType}</span>
          </FilterChip>
        ))}
      </div>
      <Panel
        title={`${data?.total ?? 0} mapping rules`}
        search={<SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Cari atribut / source field…" />}
      >
        <div className="overflow-auto max-h-[460px]">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b sticky top-0"><tr>{["Brand", "Attribute ID", "Attribute", "Type", "Source field", "Logic"].map((h) => <th key={h} className="text-left px-4 py-2.5 font-semibold text-slate-500">{h}</th>)}</tr></thead>
            <tbody>
              {loading && <Row colSpan={6}><Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-300" /></Row>}
              {!loading && data?.items.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-mono font-bold text-slate-600">{r.brandCode || "—"}</td>
                  <td className="px-4 py-2.5 font-mono font-semibold text-slate-700">{r.attributeId}</td>
                  <td className="px-4 py-2.5 text-slate-600 truncate max-w-[140px]">{r.attribute}</td>
                  <td className="px-4 py-2.5"><Badge variant="outline" className={TYPE_BADGE[r.mappingType] ?? ""}>{r.mappingType}</Badge></td>
                  <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500 truncate max-w-[120px]">{r.sourceField || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500 truncate max-w-[220px]" title={r.logic}>{r.logic || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={page} total={data?.total ?? 0} onChange={setPage} />
      </Panel>
    </div>
  );
}

/* ── shared bits ── */
function Panel({ title, search, action, children }: { title: string; search?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b bg-white">
        <span className="text-xs font-semibold text-slate-500">{title}</span>
        <div className="flex items-center gap-2">{search}{action}</div>
      </div>
      {children}
    </div>
  );
}
function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-8 h-8 w-48 md:w-56 text-xs" />
    </div>
  );
}
function Row({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return <tr><td colSpan={colSpan} className="px-4 py-10 text-center">{children}</td></tr>;
}
function Pager({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.ceil(total / 25);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t text-xs text-slate-500">
      <span>Page {page} of {pages} · {total} items</span>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" className="h-7" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft className="h-3.5 w-3.5" /></Button>
        <Button variant="outline" size="sm" className="h-7" disabled={page >= pages} onClick={() => onChange(page + 1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}
function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("px-2.5 py-1.5 rounded-full border text-[11px] font-medium transition-colors",
      active ? "bg-orange-500 border-orange-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50")}>
      {children}
    </button>
  );
}
