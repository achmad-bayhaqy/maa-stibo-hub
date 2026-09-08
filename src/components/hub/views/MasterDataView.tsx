"use client";

import { useCallback, useEffect, useState } from "react";
import { api, useHub, exportCsv } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ImportDialog, type ImportEntity } from "@/components/hub/ImportDialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Plus, Search, Loader2, Pencil, Trash2, ChevronLeft, ChevronRight, Database,
  Download, UploadCloud, ArrowUpDown,
} from "lucide-react";

type Tab = "brands" | "attributes" | "lov" | "rules" | "naming" | "rna";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "brands", label: "Brands" },
  { key: "attributes", label: "Attributes" },
  { key: "lov", label: "LOV Tables" },
  { key: "rules", label: "Mapping Rules" },
  { key: "naming", label: "Naming Routes" },
  { key: "rna", label: "RNA" },
];

const TYPE_BADGE: Record<string, string> = {
  SYSTEM_FORMULA: "border-sky-200 bg-sky-50 text-sky-700",
  DIRECT: "border-emerald-200 bg-emerald-50 text-emerald-700",
  MANUAL_PORTAL: "border-red-200 bg-red-50 text-red-700",
  MANUAL: "border-amber-200 bg-amber-50 text-amber-700",
  MANUAL_DIRECT: "border-amber-200 bg-amber-50 text-amber-700",
  AI_ASSIST: "border-neutral-200 bg-neutral-50 text-neutral-700",
  MAPPING: "border-teal-200 bg-teal-50 text-teal-700",
  NOT_AVAILABLE: "border-slate-200 bg-slate-50 text-slate-500",
  EXTERNAL_SOURCE: "border-rose-200 bg-rose-50 text-rose-700",
};

const ENDPOINTS = ["ARTICLE_PLANNING", "EAN_UPDATE", "ARTICLE_MAINTENANCE"];
const IMPORT_ENTITY: Record<Tab, ImportEntity | null> = {
  brands: "brands", attributes: "attributes", rules: "rules", lov: "lov-values", naming: null, rna: null,
};

export function MasterDataView() {
  const { masterTab, setMasterTab, user } = useHub();
  const canEdit = user?.role === "ADMIN" || user?.role === "EDITOR";
  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <h2 className="text-lg font-bold text-slate-800">Data Master</h2>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">
        Reference data that powers the mapping engine — extracted from the Brand Mapping Template, MDD, and RNA workbooks.
        {canEdit ? " Edit inline; every change is recorded in the Audit Log." : " Your role is view-only."}
      </p>
      <div className="flex gap-1.5 mb-5 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setMasterTab(t.key)}
            className={cn("px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
              masterTab === t.key ? "bg-[#141414] text-white" : "bg-white border text-slate-600 hover:bg-slate-50")}>
            {t.label}
          </button>
        ))}
      </div>
      {masterTab === "brands" && <BrandsTab canEdit={canEdit} isAdmin={isAdmin} />}
      {masterTab === "attributes" && <AttributesTab canEdit={canEdit} isAdmin={isAdmin} />}
      {masterTab === "lov" && <LovTab canEdit={canEdit} isAdmin={isAdmin} />}
      {masterTab === "rules" && <RulesTab canEdit={canEdit} isAdmin={isAdmin} />}
      {masterTab === "naming" && <NamingTab canEdit={canEdit} isAdmin={isAdmin} />}
      {masterTab === "rna" && <RnaTab canEdit={canEdit} isAdmin={isAdmin} />}
    </div>
  );
}

/* ──────────────────────── Brands ──────────────────────── */
interface Brand { id: string; code: string; name: string; division: string; status: string; fileTypes: string }

function BrandsTab({ canEdit, isAdmin }: { canEdit: boolean; isAdmin: boolean }) {
  const { toast } = useToast();
  const [items, setItems] = useState<Brand[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<Brand> | null>(null);
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

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
      toast({ title: edit.id ? "Brand diperbarui" : "Brand dibuat" });
      setEdit(null); load();
    } catch (e) { toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  return (
    <Panel
      title={`${items.length} brands`}
      search={<SearchBox value={q} onChange={setQ} placeholder="Search brand code / name…" />}
      action={canEdit && (
        <div className="flex gap-1.5">
          <ImportButton onClick={() => setImportOpen(true)} />
          <ExportButton filename="brands" columns={["code", "name", "division", "status"]} rows={items.map((b) => [b.code, b.name, b.division, b.status])} />
          <Button size="sm" className="bg-[#DD1C24] hover:bg-[#b9151c] text-white" onClick={() => setEdit({ division: "SPORTS", status: "ACTIVE" })}><Plus className="h-4 w-4 mr-1" /> Add brand</Button>
        </div>
      )}
    >
      <DataTable
        loading={loading} colSpan={6} empty="Belum ada brand"
        columns={["Code", "Name", "Division", "Status", "File types", ""]}
        rows={items.map((b) => (
          <tr key={b.id} className="border-b last:border-0 hover:bg-slate-50/60">
            <td className="px-4 py-2.5 font-mono font-bold text-slate-700">{b.code}</td>
            <td className="px-4 py-2.5 font-medium text-slate-700">{b.name}</td>
            <td className="px-4 py-2.5 text-slate-500">{b.division}</td>
            <td className="px-4 py-2.5"><Badge variant="outline" className={b.status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200"}>{b.status}</Badge></td>
            <td className="px-4 py-2.5 text-slate-500 truncate max-w-[220px]">{safeTypes(b.fileTypes).slice(0, 3).join(", ") || "—"}</td>
            <ActionsCell
              canEdit={canEdit} onEdit={() => setEdit(b)}
              canDelete={isAdmin} onDelete={async () => { if (confirm(`Delete brand ${b.code}?`)) { await api(`/api/brands/${b.id}`, { method: "DELETE" }); load(); } }}
            />
          </tr>
        ))}
      />

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">{edit?.id ? "Edit brand" : "Brand baru"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Code"><Input value={edit?.code ?? ""} disabled={!!edit?.id} onChange={(e) => setEdit((p) => ({ ...p!, code: e.target.value.toUpperCase() }))} className="h-9 font-mono" /></Field>
            <Field label="Name"><Input value={edit?.name ?? ""} onChange={(e) => setEdit((p) => ({ ...p!, name: e.target.value }))} className="h-9" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Division"><Input value={edit?.division ?? ""} onChange={(e) => setEdit((p) => ({ ...p!, division: e.target.value }))} className="h-9" /></Field>
              <Field label="Status">
                <select value={edit?.status ?? "ACTIVE"} onChange={(e) => setEdit((p) => ({ ...p!, status: e.target.value }))} className="h-9 w-full rounded-md border bg-white px-2 text-sm">
                  <option>ACTIVE</option><option>INACTIVE</option><option>ONBOARDING</option>
                </select>
              </Field>
            </div>
          </div>
          <DialogFooter><Button onClick={save} disabled={busy || !edit?.code || !edit?.name} className="bg-[#DD1C24] hover:bg-[#b9151c] text-white">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportDialog entity="brands" open={importOpen} onOpenChange={setImportOpen} onDone={load} />
    </Panel>
  );
}

/* ──────────────────────── Attributes ──────────────────────── */
interface Attr { id: string; code: string; name: string; validation: string; description: string }

function AttributesTab({ canEdit, isAdmin }: { canEdit: boolean; isAdmin: boolean }) {
  const { toast } = useToast();
  const [data, setData] = useState<{ items: Attr[]; total: number }>({ items: [], total: 0 });
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<Attr> | null>(null);
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ items: Attr[]; total: number }>(`/api/attributes?q=${encodeURIComponent(q)}&page=${page}&pageSize=25`);
      setData(d);
    } finally { setLoading(false); }
  }, [q, page]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!edit?.code || !edit.name) return;
    setBusy(true);
    try {
      if (edit.id) await api(`/api/attributes/${edit.id}`, { method: "PATCH", body: JSON.stringify({ name: edit.name, validation: edit.validation, description: edit.description }) });
      else await api("/api/attributes", { method: "POST", body: JSON.stringify({ code: edit.code, name: edit.name, validation: edit.validation, description: edit.description }) });
      toast({ title: edit.id ? "Atribut diperbarui" : "Atribut dibuat" });
      setEdit(null); load();
    } catch (e) { toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  return (
    <Panel
      title={`${data.total} attributes (MDD Core)`}
      search={<SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search AT_… / name…" />}
      action={canEdit && (
        <div className="flex gap-1.5">
          <ImportButton onClick={() => setImportOpen(true)} />
          <ExportButton filename="attributes" columns={["code", "name", "validation", "description"]} rows={data.items.map((a) => [a.code, a.name, a.validation, a.description])} />
          <Button size="sm" className="bg-[#DD1C24] hover:bg-[#b9151c] text-white" onClick={() => setEdit({ validation: "text" })}><Plus className="h-4 w-4 mr-1" /> Add attribute</Button>
        </div>
      )}
    >
      <DataTable
        loading={loading} colSpan={6} empty="Tidak ada atribut cocok"
        columns={["Attribute ID", "Name", "Validation", "Description", "", ""]}
        rows={data.items.map((a) => (
          <tr key={a.id} className="border-b last:border-0 hover:bg-slate-50/60">
            <td className="px-4 py-2.5 font-mono font-semibold text-slate-700">{a.code}</td>
            <td className="px-4 py-2.5 text-slate-600">{a.name}</td>
            <td className="px-4 py-2.5"><Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">{a.validation}</Badge></td>
            <td className="px-4 py-2.5 text-slate-500 truncate max-w-[200px]" title={a.description}>{a.description || "—"}</td>
            <ActionsCell
              canEdit={canEdit} onEdit={() => setEdit(a)}
              canDelete={isAdmin} onDelete={async () => { if (confirm(`Delete atribut ${a.code}?`)) { await api(`/api/attributes/${a.id}`, { method: "DELETE" }); load(); } }}
            />
          </tr>
        ))}
      />
      <Pager page={page} total={data.total} onChange={setPage} />

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-sm">{edit?.id ? "Edit atribut" : "Atribut baru"}</DialogTitle>
            <DialogDescription className="text-xs">Kode atribut wajib berawalan AT_ (konvensi MDD Stibo).</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Field label="Attribute ID"><Input value={edit?.code ?? ""} disabled={!!edit?.id} onChange={(e) => setEdit((p) => ({ ...p!, code: e.target.value.toUpperCase() }))} className="h-9 font-mono" placeholder="AT_…" /></Field>
            <Field label="Name"><Input value={edit?.name ?? ""} onChange={(e) => setEdit((p) => ({ ...p!, name: e.target.value }))} className="h-9" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Validation">
                <select value={edit?.validation ?? "text"} onChange={(e) => setEdit((p) => ({ ...p!, validation: e.target.value }))} className="h-9 w-full rounded-md border bg-white px-2 text-sm">
                  {["text", "lov", "number", "date", "boolean", "regex"].map((v) => <option key={v}>{v}</option>)}
                </select>
              </Field>
              <Field label="Urutan tampil"><Input type="number" value={0} disabled className="h-9 opacity-50" /></Field>
            </div>
            <Field label="Description"><Textarea value={edit?.description ?? ""} onChange={(e) => setEdit((p) => ({ ...p!, description: e.target.value }))} rows={2} className="text-xs" /></Field>
          </div>
          <DialogFooter><Button onClick={save} disabled={busy || !edit?.code || !edit?.name} className="bg-[#DD1C24] hover:bg-[#b9151c] text-white">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportDialog entity="attributes" open={importOpen} onOpenChange={setImportOpen} onDone={load} />
    </Panel>
  );
}

/* ──────────────────────── LOV ──────────────────────── */
interface LovTableMeta { id: string; key: string; sheetName: string; valueCount: number }
interface LovValue { id: string; code: string; label: string }

function LovTab({ canEdit, isAdmin }: { canEdit: boolean; isAdmin: boolean }) {
  const { toast } = useToast();
  const [tables, setTables] = useState<LovTableMeta[]>([]);
  const [sel, setSel] = useState<string>("");
  const [q, setQ] = useState("");
  const [values, setValues] = useState<{ items: LovValue[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [tableEdit, setTableEdit] = useState<{ mode: "new" | "rename"; key?: string; sheetName?: string; keyInput?: string } | null>(null);
  const [valueEdit, setValueEdit] = useState<Partial<LovValue> | null>(null);
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const loadTables = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api<LovTableMeta[]>("/api/lov");
      setTables(list);
      // auto-select the first table so the tab never looks empty
      setSel((cur) => cur || list[0]?.key || "");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { loadTables(); }, [loadTables]);

  useEffect(() => {
    if (!sel) return;
    api<{ items: LovValue[]; total: number }>(`/api/lov/${sel}/values?q=${encodeURIComponent(q)}&pageSize=60`).then(setValues).catch(() => undefined);
  }, [sel, q]);

  const saveTable = async () => {
    if (!tableEdit) return;
    setBusy(true);
    try {
      if (tableEdit.mode === "new") await api("/api/lov", { method: "POST", body: JSON.stringify({ key: tableEdit.keyInput, sheetName: tableEdit.sheetName }) });
      else if (tableEdit.key) await api(`/api/lov/${tableEdit.key}`, { method: "PATCH", body: JSON.stringify({ sheetName: tableEdit.sheetName }) });
      toast({ title: "LOV table saved" });
      setTableEdit(null); loadTables();
    } catch (e) { toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const saveValue = async () => {
    if (!valueEdit?.code) return;
    setBusy(true);
    try {
      if (valueEdit.id) await api(`/api/lov/values/${valueEdit.id}`, { method: "PATCH", body: JSON.stringify({ code: valueEdit.code, label: valueEdit.label }) });
      else await api(`/api/lov/${sel}/values`, { method: "POST", body: JSON.stringify({ code: valueEdit.code, label: valueEdit.label }) });
      toast({ title: "LOV value saved" });
      setValueEdit(null);
      const d = await api<{ items: LovValue[]; total: number }>(`/api/lov/${sel}/values?pageSize=60`);
      setValues(d); loadTables();
    } catch (e) { toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-4">
      <Panel
        title={`${tables.length} LOV tables`}
        action={canEdit && <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setTableEdit({ mode: "new", sheetName: "" })}><Plus className="h-3 w-3 mr-1" /> Table</Button>}
      >
        <div className="max-h-[420px] overflow-auto divide-y">
          {loading && <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-300" /></div>}
          {tables.map((t) => (
            <button key={t.id} onClick={() => setSel(t.key)}
              className={cn("w-full text-left px-4 py-2.5 text-xs flex items-center justify-between hover:bg-slate-50", sel === t.key && "bg-red-50 border-l-2 border-red-500")}>
              <span className="font-mono font-semibold text-slate-700 truncate">{t.sheetName}</span>
              <span className="text-[10px] text-slate-400 shrink-0 ml-2">{t.valueCount}</span>
            </button>
          ))}
        </div>
      </Panel>
      <Panel
        title={sel ? `${values.total} values in ${sel}` : "Select a table"}
        search={<SearchBox value={q} onChange={setQ} placeholder="Search code / label…" />}
        action={sel && canEdit && (
          <div className="flex gap-1.5">
            <ImportButton onClick={() => setImportOpen(true)} />
            <ExportButton filename={`lov-${sel}`} columns={["code", "label"]} rows={values.items.map((v) => [v.code, v.label])} />
            {tableEdit === null && sel && (
              <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => { const t = tables.find((x) => x.key === sel); setTableEdit({ mode: "rename", key: sel, sheetName: t?.sheetName }); }}>
                <Pencil className="h-3 w-3 mr-1" /> Rename
              </Button>
            )}
            <Button size="sm" className="bg-[#DD1C24] hover:bg-[#b9151c] text-white h-8 text-[11px]" onClick={() => setValueEdit({})}><Plus className="h-3 w-3 mr-1" /> Value</Button>
          </div>
        )}
      >
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b sticky top-0"><tr>{["Code", "Label", ""].map((h) => <th key={h} className="text-left px-4 py-2.5 font-semibold text-slate-500">{h}</th>)}</tr></thead>
            <tbody>
              {values.items.map((v) => (
                <tr key={v.id} className="border-b last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-2 font-mono font-semibold text-slate-700">{v.code}</td>
                  <td className="px-4 py-2 text-slate-600">{v.label}</td>
                  <td className="px-4 py-2">
                    {canEdit && (
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" className="h-6" onClick={() => setValueEdit(v)}><Pencil className="h-3 w-3" /></Button>
                        {isAdmin && <Button variant="ghost" size="sm" className="h-6 text-red-500" onClick={async () => { if (confirm(`Delete value ${v.code}?`)) { await api(`/api/lov/values/${v.id}`, { method: "DELETE" }); setValues((p) => ({ ...p, items: p.items.filter((x) => x.id !== v.id) })); } }}><Trash2 className="h-3 w-3" /></Button>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* table dialog */}
      <Dialog open={!!tableEdit} onOpenChange={(o) => !o && setTableEdit(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">{tableEdit?.mode === "new" ? "New LOV table" : `Rename ${tableEdit?.key}`}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {tableEdit?.mode === "new" && (
              <Field label="Key (A-Z, 0-9, underscore)"><Input value={tableEdit?.keyInput ?? ""} onChange={(e) => setTableEdit((p) => ({ ...p!, keyInput: e.target.value.toUpperCase() }))} className="h-9 font-mono" placeholder="SIZE_GRID" /></Field>
            )}
            <Field label="Sheet name"><Input value={tableEdit?.sheetName ?? ""} onChange={(e) => setTableEdit((p) => ({ ...p!, sheetName: e.target.value }))} className="h-9" /></Field>
          </div>
          <DialogFooter><Button onClick={saveTable} disabled={busy || !tableEdit?.sheetName} className="bg-[#DD1C24] hover:bg-[#b9151c] text-white">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* value dialog */}
      <Dialog open={!!valueEdit} onOpenChange={(o) => !o && setValueEdit(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">{valueEdit?.id ? "Edit nilai LOV" : `Nilai baru untuk ${sel}`}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Code"><Input value={valueEdit?.code ?? ""} onChange={(e) => setValueEdit((p) => ({ ...p!, code: e.target.value.toUpperCase() }))} className="h-9 font-mono" /></Field>
            <Field label="Label"><Input value={valueEdit?.label ?? ""} onChange={(e) => setValueEdit((p) => ({ ...p!, label: e.target.value }))} className="h-9" /></Field>
          </div>
          <DialogFooter><Button onClick={saveValue} disabled={busy || !valueEdit?.code} className="bg-[#DD1C24] hover:bg-[#b9151c] text-white">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportDialog entity="lov-values" open={importOpen} onOpenChange={setImportOpen} onDone={loadTables} />
    </div>
  );
}

/* ──────────────────────── Rules ──────────────────────── */
interface Rule { id: string; brandSheet: string; brandCode: string; attribute: string; attributeId: string; mappingType: string; sourceField: string; logic: string; validation: string; active: boolean }
interface RulesResp { items: Rule[]; total: number; byType: Array<{ mappingType: string; _count: { mappingType: number } }>; brandSheets: Array<{ brandSheet: string; brandCode: string; count: number }> }

const RULE_TYPES = ["SYSTEM_FORMULA", "DIRECT", "MAPPING", "MANUAL_PORTAL", "MANUAL", "MANUAL_DIRECT", "AI_ASSIST", "EXTERNAL_SOURCE", "NOT_AVAILABLE", "OTHER"];

function RulesTab({ canEdit, isAdmin }: { canEdit: boolean; isAdmin: boolean }) {
  const { toast } = useToast();
  const [data, setData] = useState<RulesResp | null>(null);
  const [brand, setBrand] = useState("");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<Rule> | null>(null);
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<RulesResp>(`/api/rules?brand=${encodeURIComponent(brand)}&type=${encodeURIComponent(type)}&q=${encodeURIComponent(q)}&page=${page}&pageSize=25`);
      setData(d);
    } finally { setLoading(false); }
  }, [brand, type, q, page]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!edit?.brandSheet || !edit?.attributeId || !edit?.mappingType) return;
    setBusy(true);
    try {
      if (edit.id) {
        await api(`/api/rules/${edit.id}`, {
          method: "PATCH",
          body: JSON.stringify({ mappingType: edit.mappingType, sourceField: edit.sourceField, logic: edit.logic, validation: edit.validation, active: edit.active, attribute: edit.attribute }),
        });
      } else {
        await api("/api/rules", {
          method: "POST",
          body: JSON.stringify({ brandSheet: edit.brandSheet, brandCode: edit.brandCode, attributeId: edit.attributeId, attribute: edit.attribute, mappingType: edit.mappingType, sourceField: edit.sourceField, logic: edit.logic, validation: edit.validation }),
        });
      }
      toast({ title: edit.id ? "Rule diperbarui" : "Rule dibuat" });
      setEdit(null); load();
    } catch (e) { toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

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
        search={<SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search attribute / source field…" />}
        action={canEdit && (
          <div className="flex gap-1.5">
            <ImportButton onClick={() => setImportOpen(true)} />
            <ExportButton
              filename="mapping-rules" columns={["brand", "attributeId", "attribute", "type", "sourceField", "logic"]}
              rows={(data?.items ?? []).map((r) => [r.brandCode, r.attributeId, r.attribute, r.mappingType, r.sourceField, r.logic])}
            />
            <Button size="sm" className="bg-[#DD1C24] hover:bg-[#b9151c] text-white" onClick={() => setEdit({ mappingType: "DIRECT", validation: "text" })}><Plus className="h-4 w-4 mr-1" /> Add rule</Button>
          </div>
        )}
      >
        <DataTable
          loading={loading} colSpan={7} empty="Tidak ada rule cocok"
          columns={["Brand", "Attribute ID", "Attribute", "Type", "Source field", "Logic", ""]}
          rows={data?.items.map((r) => (
            <tr key={r.id} className={cn("border-b last:border-0 hover:bg-slate-50/60", !r.active && "opacity-50")}>
              <td className="px-4 py-2.5 font-mono font-bold text-slate-600">{r.brandCode || "—"}</td>
              <td className="px-4 py-2.5 font-mono font-semibold text-slate-700">{r.attributeId}</td>
              <td className="px-4 py-2.5 text-slate-600 truncate max-w-[140px]">{r.attribute}</td>
              <td className="px-4 py-2.5">
                <Badge variant="outline" className={cn(TYPE_BADGE[r.mappingType] ?? "", !r.active && "line-through")}>{r.mappingType}</Badge>
              </td>
              <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500 truncate max-w-[120px]">{r.sourceField || "—"}</td>
              <td className="px-4 py-2.5 text-slate-500 truncate max-w-[220px]" title={r.logic}>{r.logic || "—"}</td>
              <ActionsCell
                canEdit={canEdit} onEdit={() => setEdit(r)}
                canDelete={isAdmin} onDelete={async () => { if (confirm(`Delete rule ${r.brandCode}/${r.attributeId}?`)) { await api(`/api/rules/${r.id}`, { method: "DELETE" }); load(); } }}
              />
            </tr>
          )) ?? []}
        />
        <Pager page={page} total={data?.total ?? 0} onChange={setPage} />
      </Panel>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="text-sm">{edit?.id ? "Edit mapping rule" : "Mapping rule baru"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Brand sheet"><Input value={edit?.brandSheet ?? ""} disabled={!!edit?.id} onChange={(e) => setEdit((p) => ({ ...p!, brandSheet: e.target.value }))} className="h-9 font-mono text-xs" placeholder="adidas" /></Field>
              <Field label="Brand code"><Input value={edit?.brandCode ?? ""} disabled={!!edit?.id} onChange={(e) => setEdit((p) => ({ ...p!, brandCode: e.target.value.toUpperCase() }))} className="h-9 font-mono text-xs" placeholder="ADI" /></Field>
            </div>
            <Field label="Attribute ID"><Input value={edit?.attributeId ?? ""} disabled={!!edit?.id} onChange={(e) => setEdit((p) => ({ ...p!, attributeId: e.target.value.toUpperCase() }))} className="h-9 font-mono text-xs" placeholder="AT_BRAND" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mapping type">
                <select value={edit?.mappingType ?? "DIRECT"} onChange={(e) => setEdit((p) => ({ ...p!, mappingType: e.target.value }))} className="h-9 w-full rounded-md border bg-white px-2 text-xs">
                  {RULE_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Validation">
                <select value={edit?.validation ?? "text"} onChange={(e) => setEdit((p) => ({ ...p!, validation: e.target.value }))} className="h-9 w-full rounded-md border bg-white px-2 text-xs">
                  {["text", "lov", "number", "date", "boolean", "regex"].map((v) => <option key={v}>{v}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Source field"><Input value={edit?.sourceField ?? ""} onChange={(e) => setEdit((p) => ({ ...p!, sourceField: e.target.value }))} className="h-9 font-mono text-xs" placeholder="colBrand / B" /></Field>
            <Field label="Logic (formula / catatan)"><Textarea value={edit?.logic ?? ""} onChange={(e) => setEdit((p) => ({ ...p!, logic: e.target.value }))} rows={2} className="text-xs" /></Field>
            {edit?.id && (
              <div className="flex items-center gap-2">
                <Switch checked={edit?.active ?? true} onCheckedChange={(c) => setEdit((p) => ({ ...p!, active: c }))} id="rule-active" />
                <Label htmlFor="rule-active" className="text-xs">Rule aktif (mesin transformasi melewati rule nonaktif)</Label>
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={save} disabled={busy} className="bg-[#DD1C24] hover:bg-[#b9151c] text-white">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportDialog entity="rules" open={importOpen} onOpenChange={setImportOpen} onDone={load} />
    </div>
  );
}

/* ──────────────────────── Naming Routes ──────────────────────── */
interface NamingRoute { id: string; brand: string; inline: string; fileType: string; trigger: string; endpoint: string; comment: string }

function NamingTab({ canEdit, isAdmin }: { canEdit: boolean; isAdmin: boolean }) {
  const { toast } = useToast();
  const [data, setData] = useState<{ items: NamingRoute[]; total: number }>({ items: [], total: 0 });
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<NamingRoute> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ items: NamingRoute[]; total: number }>(`/api/naming?q=${encodeURIComponent(q)}`);
      setData(d);
    } finally { setLoading(false); }
  }, [q]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!edit?.brand || !edit?.endpoint) return;
    setBusy(true);
    try {
      if (edit.id) await api(`/api/naming/${edit.id}`, { method: "PATCH", body: JSON.stringify(edit) });
      else await api("/api/naming", { method: "POST", body: JSON.stringify(edit) });
      toast({ title: edit.id ? "Route diperbarui" : "Route dibuat" });
      setEdit(null); load();
    } catch (e) { toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  return (
    <Panel
      title={`${data.total} naming routes`}
      search={<SearchBox value={q} onChange={setQ} placeholder="Search brand / flow / endpoint…" />}
      action={canEdit && (
        <div className="flex gap-1.5">
          <ExportButton
            filename="naming-routes" columns={["brand", "inline", "fileType", "trigger", "endpoint"]}
            rows={data.items.map((r) => [r.brand, r.inline, r.fileType, r.trigger, r.endpoint])}
          />
          <Button size="sm" className="bg-[#DD1C24] hover:bg-[#b9151c] text-white" onClick={() => setEdit({ endpoint: "ARTICLE_PLANNING" })}><Plus className="h-4 w-4 mr-1" /> Add route</Button>
        </div>
      )}
    >
      <DataTable
        loading={loading} colSpan={7} empty="Tidak ada route cocok"
        columns={["Brand", "Inline", "File type", "Trigger", "Endpoint", "Comment", ""]}
        rows={data.items.map((r) => (
          <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/60">
            <td className="px-4 py-2.5 font-mono font-bold text-slate-700">{r.brand}</td>
            <td className="px-4 py-2.5 text-slate-500 truncate max-w-[110px]">{r.inline || "—"}</td>
            <td className="px-4 py-2.5 text-slate-500 truncate max-w-[110px]">{r.fileType || "—"}</td>
            <td className="px-4 py-2.5 text-slate-500">{r.trigger || "—"}</td>
            <td className="px-4 py-2.5"><Badge variant="outline" className="border-neutral-200 bg-neutral-50 text-neutral-700 font-mono text-[10px]">{r.endpoint}</Badge></td>
            <td className="px-4 py-2.5 text-slate-500 truncate max-w-[140px]" title={r.comment}>{r.comment || "—"}</td>
            <ActionsCell
              canEdit={canEdit} onEdit={() => setEdit(r)}
              canDelete={isAdmin} onDelete={async () => { if (confirm(`Delete route ${r.brand}?`)) { await api(`/api/naming/${r.id}`, { method: "DELETE" }); load(); } }}
            />
          </tr>
        ))}
      />

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-sm">{edit?.id ? "Edit naming route" : "Naming route baru"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Brand (code / sheet)"><Input value={edit?.brand ?? ""} onChange={(e) => setEdit((p) => ({ ...p!, brand: e.target.value }))} className="h-9 font-mono text-xs" placeholder="ELL" /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Inline"><Input value={edit?.inline ?? ""} onChange={(e) => setEdit((p) => ({ ...p!, inline: e.target.value }))} className="h-9 text-xs" /></Field>
              <Field label="File type"><Input value={edit?.fileType ?? ""} onChange={(e) => setEdit((p) => ({ ...p!, fileType: e.target.value }))} className="h-9 text-xs" /></Field>
              <Field label="Trigger"><Input value={edit?.trigger ?? ""} onChange={(e) => setEdit((p) => ({ ...p!, trigger: e.target.value }))} className="h-9 text-xs" /></Field>
            </div>
            <Field label="Endpoint">
              <select value={edit?.endpoint ?? "ARTICLE_PLANNING"} onChange={(e) => setEdit((p) => ({ ...p!, endpoint: e.target.value }))} className="h-9 w-full rounded-md border bg-white px-2 text-xs font-mono">
                {ENDPOINTS.map((e) => <option key={e}>{e}</option>)}
              </select>
            </Field>
            <Field label="Comment"><Input value={edit?.comment ?? ""} onChange={(e) => setEdit((p) => ({ ...p!, comment: e.target.value }))} className="h-9 text-xs" /></Field>
          </div>
          <DialogFooter><Button onClick={save} disabled={busy || !edit?.brand || !edit?.endpoint} className="bg-[#DD1C24] hover:bg-[#b9151c] text-white">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

/* ──────────────────────── RNA ──────────────────────── */
interface RnaRow {
  id: string; country: string; compCode: string; sbuGrouping: string; subSbu: string; sbu: string;
  brandGroup: string; brandCategory: string; brandType: string; brandName: string; brandCode: string;
  reportingBrandCode: string; reportingBrandName: string;
}
const RNA_FIELDS: Array<{ key: keyof RnaRow; label: string }> = [
  { key: "country", label: "Country" }, { key: "compCode", label: "Comp code" }, { key: "sbuGrouping", label: "SBU grouping" },
  { key: "subSbu", label: "Sub SBU" }, { key: "sbu", label: "SBU" }, { key: "brandGroup", label: "Brand group" },
  { key: "brandCategory", label: "Brand category" }, { key: "brandType", label: "Brand type" },
  { key: "brandName", label: "Brand name" }, { key: "brandCode", label: "Brand code" },
  { key: "reportingBrandCode", label: "Reporting brand code" }, { key: "reportingBrandName", label: "Reporting brand name" },
];

function RnaTab({ canEdit, isAdmin }: { canEdit: boolean; isAdmin: boolean }) {
  const { toast } = useToast();
  const [data, setData] = useState<{ items: RnaRow[]; total: number; countries: Array<{ country: string; count: number }> }>({ items: [], total: 0, countries: [] });
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<RnaRow> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<typeof data>(`/api/rna?q=${encodeURIComponent(q)}&country=${encodeURIComponent(country)}&page=${page}&pageSize=25`);
      setData(d);
    } finally { setLoading(false); }
  }, [q, country, page]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!edit?.country || !edit?.compCode || !edit?.brandCode) return;
    setBusy(true);
    try {
      if (edit.id) await api(`/api/rna/${edit.id}`, { method: "PATCH", body: JSON.stringify(edit) });
      else await api("/api/rna", { method: "POST", body: JSON.stringify(edit) });
      toast({ title: edit.id ? "Baris RNA diperbarui" : "Baris RNA dibuat" });
      setEdit(null); load();
    } catch (e) { toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={!country} onClick={() => { setCountry(""); setPage(1); }}>All countries</FilterChip>
        {data.countries.map((c) => (
          <FilterChip key={c.country} active={country === c.country} onClick={() => { setCountry(c.country); setPage(1); }}>
            {c.country} <span className="opacity-50">{c.count}</span>
          </FilterChip>
        ))}
      </div>
      <Panel
        title={`${data.total.toLocaleString("id-ID")} baris RNA`}
        search={<SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search brand / SBU / comp…" />}
        action={canEdit && (
          <div className="flex gap-1.5">
            <ExportButton
              filename="rna" columns={RNA_FIELDS.map((f) => f.key)}
              rows={data.items.map((r) => RNA_FIELDS.map((f) => r[f.key]))}
            />
            <Button size="sm" className="bg-[#DD1C24] hover:bg-[#b9151c] text-white" onClick={() => setEdit({ country: "ID", compCode: "0888" })}><Plus className="h-4 w-4 mr-1" /> Add row</Button>
          </div>
        )}
      >
        <DataTable
          loading={loading} colSpan={8} empty="Tidak ada baris cocok"
          columns={["Country", "Comp", "SBU", "Sub SBU", "Brand name", "Code", "Reporting", ""]}
          rows={data.items.map((r) => (
            <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/60">
              <td className="px-4 py-2.5 font-semibold text-slate-700">{r.country}</td>
              <td className="px-4 py-2.5 font-mono text-slate-600">{r.compCode}</td>
              <td className="px-4 py-2.5 text-slate-600">{r.sbu || "—"}</td>
              <td className="px-4 py-2.5 text-slate-500">{r.subSbu || "—"}</td>
              <td className="px-4 py-2.5 text-slate-600 truncate max-w-[140px]">{r.brandName || "—"}</td>
              <td className="px-4 py-2.5 font-mono font-semibold text-slate-700">{r.brandCode}</td>
              <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500">{r.reportingBrandCode || "—"}</td>
              <ActionsCell
                canEdit={canEdit} onEdit={() => setEdit(r)}
                canDelete={isAdmin} onDelete={async () => { if (confirm(`Delete baris RNA ${r.country}/${r.brandCode}?`)) { await api(`/api/rna/${r.id}`, { method: "DELETE" }); load(); } }}
              />
            </tr>
          ))}
        />
        <Pager page={page} total={data.total} onChange={setPage} />
      </Panel>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle className="text-sm">{edit?.id ? "Edit baris RNA" : "Baris RNA baru"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {RNA_FIELDS.map((f) => (
              <Field key={f.key} label={f.label}>
                <Input value={String(edit?.[f.key] ?? "")} onChange={(e) => setEdit((p) => ({ ...p!, [f.key]: e.target.value }))} className="h-9 text-xs" />
              </Field>
            ))}
          </div>
          <DialogFooter><Button onClick={save} disabled={busy || !edit?.country || !edit?.compCode || !edit?.brandCode} className="bg-[#DD1C24] hover:bg-[#b9151c] text-white">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ──────────────────────── shared bits ──────────────────────── */
function safeTypes(json: string | string[]): string[] {
  try { return typeof json === "string" ? JSON.parse(json || "[]") : json ?? []; } catch { return []; }
}

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
function Pager({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.ceil(total / 25);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t text-xs text-slate-500">
      <span>Halaman {page} dari {pages} · {total.toLocaleString("id-ID")} item</span>
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
      active ? "bg-[#DD1C24] border-red-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50")}>
      {children}
    </button>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
function ActionsCell({ canEdit, onEdit, canDelete, onDelete }: { canEdit: boolean; onEdit: () => void; canDelete: boolean; onDelete: () => void }) {
  if (!canEdit && !canDelete) return <td className="px-4 py-2.5 text-right text-slate-300"><Database className="h-3.5 w-3.5 inline" /></td>;
  return (
    <td className="px-4 py-2.5">
      <div className="flex gap-1 justify-end">
        {canEdit && <Button variant="ghost" size="sm" className="h-7" onClick={onEdit} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></Button>}
        {canDelete && <Button variant="ghost" size="sm" className="h-7 text-red-500" onClick={onDelete} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>}
      </div>
    </td>
  );
}
function DataTable({ loading, colSpan, empty, columns, rows }: { loading: boolean; colSpan: number; empty: string; columns: string[]; rows: React.ReactNode[] }) {
  return (
    <div className="overflow-auto max-h-[480px]">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 border-b sticky top-0 z-10">
          <tr>{columns.map((h, i) => <th key={i} className="text-left px-4 py-2.5 font-semibold text-slate-500 whitespace-nowrap">
            <span className="inline-flex items-center gap-1">{h !== "" && <ArrowUpDown className="h-3 w-3 text-slate-300" />}{h}</span>
          </th>)}</tr>
        </thead>
        <tbody>
          {loading && <tr><td colSpan={colSpan} className="px-4 py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-300" /></td></tr>}
          {!loading && rows.length === 0 && <tr><td colSpan={colSpan} className="px-4 py-10 text-center text-slate-400 text-xs">{empty}</td></tr>}
          {!loading && rows}
        </tbody>
      </table>
    </div>
  );
}
function ImportButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={onClick}>
      <UploadCloud className="h-3.5 w-3.5 mr-1" /> Import
    </Button>
  );
}
function ExportButton({ filename, columns, rows }: { filename: string; columns: string[]; rows: (string | number)[][] }) {
  return (
    <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => exportCsv(`${filename}-${new Date().toISOString().slice(0, 10)}.csv`, columns, rows)}>
      <Download className="h-3.5 w-3.5 mr-1" /> CSV
    </Button>
  );
}
