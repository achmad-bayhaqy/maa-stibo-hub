"use client";

/**
 * Pipeline cards rendered inside the unified Assistant thread:
 * UploadCard (source preview) · WizardCard (LOV-driven context form) ·
 * ResultCard (full template-column table with filter/delete/edit) · SentCard.
 */

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/store";
import { TEMPLATE_COLUMNS } from "@/lib/template-columns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  CircleAlert, CircleCheck, Sparkles, PenLine, Cog, Send, ShieldAlert, Wand2,
  Loader2, ArrowRight, Eye, EyeOff, Save, Pencil, Search, Trash2, Table2, FileImage,
} from "lucide-react";

/* ─────────────────────────── shared types ─────────────────────────── */

export interface Opt { code: string; label: string }
export interface LovOptions {
  countries: Opt[]; companies: Opt[]; sbus: Opt[]; brands: Opt[]; seasons: Opt[];
  licenseTypes: Opt[]; fileTypes: { Inline: string[]; Licensed: string[] };
  years: string[]; multiMono: Opt[];
}
export interface NameInfo {
  compCode: string; sbu: string; brandSlug: string; flow: string; gender: string;
  season: string; country: string; seq: string; valid: boolean; endpoint: string; issues: string[];
}
export interface UploadRecord {
  id: string; filename: string; size: number; status: string; mode: string;
  brandCode: string; brandName: string; season: string; country: string; sbu: string;
  compCode: string; flow: string; endpoint: string; totalRows: number; processedRows: number;
  mappedRows: number; warnRows: number; errorRows: number; filenameValid: boolean;
  createdBy: string; createdAt: string; sheetName: string;
}
export interface Preview { headers: string[]; rows: Array<Record<string, string>>; totalRows: number; sheetName: string; sheets: string[] }
export interface Stats {
  totalRows: number; mappedRows: number; rowsWithManual: number; rowsWithAi: number; rowsWithError: number;
  attributeCoverage: { mapped: number; manual: number; ai: number; blank: number };
  topIssues: Array<{ attributeId: string; attribute: string; type: string; count: number }>;
}
export interface ValueStatus { attributeId: string; attribute: string; value: string; status: string; note: string }
export interface MappedRow { rowNo: number; values: Record<string, string>; statuses: ValueStatus[]; mappedCount: number }
export interface Job { id: string; bgId: string; status: string; httpStatus: number; mode: string; endpoint: string; responseSnippet: string; durationMs: number; createdAt: string }
export interface WizardAnswers {
  compCode: string; sbu: string; brandCode: string; brandName: string;
  seasonCode: string; seasonYear: string; country: string; endpoint: string;
  licenseType: string; multiMono: string; fileType: string;
}

export const ENDPOINTS = ["ARTICLE_PLANNING", "EAN_UPDATE", "ARTICLE_MAINTENANCE"];
export const TYPE_STYLE: Record<string, { label: string; cls: string; cell: string }> = {
  mapped: { label: "auto", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", cell: "" },
  ai_suggested: { label: "AI", cls: "bg-neutral-100 text-neutral-900 border-neutral-300", cell: "bg-neutral-50" },
  manual_required: { label: "manual", cls: "bg-amber-50 text-amber-700 border-amber-200", cell: "bg-amber-50/60" },
  blank: { label: "n/a", cls: "bg-slate-50 text-slate-500 border-slate-200", cell: "" },
};

/* ─────────────────────────── status chip ─────────────────────────── */

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    PARSED: { cls: "bg-sky-50 text-sky-700 border-sky-200", label: "PARSED" },
    MAPPED: { cls: "bg-neutral-900 text-white border-black", label: "MAPPED" },
    SENT: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "SENT" },
    FAILED: { cls: "bg-red-50 text-red-700 border-red-200", label: "FAILED" },
  };
  const s = map[status] ?? { cls: "bg-neutral-50 text-neutral-600 border-neutral-200", label: status };
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide", s.cls)}>{s.label}</span>;
}

/* ─────────────────────────── upload card ─────────────────────────── */

export function UploadCard({ upload, nameInfo, preview }: { upload: UploadRecord; nameInfo: NameInfo; preview: Preview }) {
  return (
    <div className="rounded-2xl border-2 border-black bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b-2 border-black bg-neutral-50">
        <div className="h-10 w-10 rounded-lg bg-[#DD1C24]/10 border border-[#DD1C24]/30 flex items-center justify-center shrink-0">
          {preview.sheetName.startsWith("AI image extraction")
            ? <FileImage className="h-5 w-5 text-[#DD1C24]" />
            : <Table2 className="h-5 w-5 text-[#DD1C24]" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-black truncate">{upload.filename}</div>
          <div className="text-[11px] text-neutral-500 flex flex-wrap items-center gap-x-2">
            <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-black text-black font-semibold gap-1">
              <Table2 className="h-2.5 w-2.5" /> Sheet: {preview.sheetName}
            </Badge>
            <span>{preview.totalRows} data rows · {(upload.size / 1024 / 1024).toFixed(1)} MB · {preview.headers.length} columns</span>
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
            Sample — all {preview.headers.length} columns ({Math.min(preview.rows.length, 8)} of {preview.totalRows} rows)
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

/* ─────────────────────────── wizard card ─────────────────────────── */

export function WizardCard({ upload, nameInfo, options, busy, onSubmit }: {
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
        <div className="h-9 w-9 rounded-lg bg-[#DD1C24] flex items-center justify-center shrink-0"><Wand2 className="h-4.5 w-4.5 text-white" /></div>
        <div>
          <div className="text-sm font-semibold text-black">Wizard — confirm article context</div>
          <div className="text-[11px] text-neutral-500">
            All dropdowns follow the MDD LOV master. Auto-filled from filename — adjust if needed.
            {upload.sheetName && <> Source sheet: <b className="text-neutral-700">{upload.sheetName}</b></>}
          </div>
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
          <Field label="Brand Code" required>
            <LovSelect
              value={brandCode} onChange={(v) => setBrandCode(v)}
              options={(options?.brands ?? (brandCode ? [{ code: brandCode, label: brandCode }] : []))}
              placeholder={options ? "Select brand code…" : "Loading…"} disabled={!options}
            />
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
                {licenseType === t.code && "● "}{t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3.5">
          <Field label="File type" hint={fileType ? undefined : "Pick the brand file type"}>
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
                {multiMono === t.code && "● "}{t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-5 pb-4 flex items-center justify-between gap-3">
        <div className="text-[11px] text-neutral-400">* required — brand, season+year, country, SBU</div>
        <Button onClick={submit} disabled={busy || !brandCode || !seasonCode || !country || !sbu} className="bg-[#DD1C24] hover:bg-[#b9151c] text-white">
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Cog className="h-4 w-4 mr-2" />} Run transform
        </Button>
      </div>
    </div>
  );
}

export function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 min-w-0">
      <Label className="text-xs text-neutral-600">{label}{required && <span className="text-[#DD1C24]"> *</span>}</Label>
      {children}
      {hint && <div className="text-[10px] text-neutral-400">{hint}</div>}
    </div>
  );
}

/** Searchable LOV select — type-to-filter; shows "CODE — Label" (or just the value when equal). */
export function LovSelect({ value, onChange, options, placeholder, disabled }: {
  value: string; onChange: (v: string) => void; options: Opt[]; placeholder?: string; disabled?: boolean;
}) {
  const [filter, setFilter] = useState("");
  const selected = options.find((o) => o.code === value);
  const filtered = filter
    ? options.filter((o) => `${o.code} ${o.label}`.toLowerCase().includes(filter.toLowerCase()))
    : options;
  const render = (o: Opt) => (o.code === o.label ? o.code : `${o.code} — ${o.label}`);
  return (
    <Select value={value || undefined} onValueChange={(v) => { onChange(v); setFilter(""); }} disabled={disabled}>
      <SelectTrigger className="h-9 w-full">
        <SelectValue placeholder={placeholder}>
          {selected ? <span className="truncate">{render(selected)}</span> : placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <div className="p-1.5 sticky top-0 bg-white border-b z-10">
          <Input
            value={filter} onChange={(e) => setFilter(e.target.value)}
            placeholder="Search code / name…" className="h-7 text-xs" autoFocus
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 && <div className="px-3 py-4 text-xs text-neutral-400 text-center">No options.</div>}
          {filtered.map((o) => (
            <SelectItem key={o.code} value={o.code} className="text-xs">
              <span className="font-mono font-semibold">{o.code}</span>
              {o.code !== o.label && <span className="text-neutral-500"> — {o.label}</span>}
            </SelectItem>
          ))}
        </div>
      </SelectContent>
    </Select>
  );
}

/* ─────────────────────────── result card ─────────────────────────── */

export function ResultCard({ upload, stats, busy, canEdit, onPreviewXml, onSend, onSaved }: {
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
  // R4: filter & delete
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "mapped" | "ai_suggested" | "manual_required">("all");
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);

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
    if (cellPending !== undefined) return "mapped";
    return row.statuses.find((s) => s.attributeId === attributeId)?.status ?? "blank";
  };

  const rowStatusClass = (row: MappedRow): string => {
    if (row.statuses.some((s) => s.status === "manual_required")) return "manual_required";
    if (row.statuses.some((s) => s.status === "ai_suggested")) return "ai_suggested";
    return "mapped";
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && rowStatusClass(r) !== statusFilter) return false;
      if (!q) return true;
      return Object.values(r.values).some((v) => v.toLowerCase().includes(q)) || String(r.rowNo) === q;
    });
  }, [rows, search, statusFilter]);

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
      toast({ title: "Edits saved", description: `${res.applied} cell(s) updated — STEPXML will be regenerated.` });
    } catch (e) {
      toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const toggleRow = (rowNo: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNo)) next.delete(rowNo); else next.add(rowNo);
      return next;
    });
  };

  const deleteSelected = async () => {
    if (selectedRows.size === 0) return;
    setDeleting(true);
    try {
      const res = await api<{ deleted: number; remaining: number }>(`/api/uploads/${upload.id}`, {
        method: "PATCH",
        body: JSON.stringify({ deleteRows: Array.from(selectedRows) }),
      });
      setRows((prev) => prev.filter((r) => !selectedRows.has(r.rowNo)));
      setSelectedRows(new Set());
      setXml(null);
      onSaved?.();
      toast({ title: "Rows deleted", description: `${res.deleted} row(s) removed — ${res.remaining} remaining in the outbound sample.` });
    } catch (e) {
      toast({ title: "Delete failed", description: (e as Error).message, variant: "destructive" });
    } finally { setDeleting(false); }
  };

  const cov = stats.attributeCoverage;
  const totalCells = cov.mapped + cov.manual + cov.ai + cov.blank || 1;

  return (
    <div className="rounded-2xl border-2 border-black bg-white shadow-sm overflow-hidden max-w-full">
      <div className="px-5 py-4 border-b-2 border-black bg-neutral-50 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-[#DD1C24] flex items-center justify-center shrink-0"><CircleCheck className="h-5 w-5 text-white" /></div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-black">Transform complete — {upload.brandName} · {upload.season || "season?"}</div>
          <div className="text-[11px] text-neutral-500 flex flex-wrap items-center gap-x-2">
            <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-black text-black font-semibold gap-1">
              <Table2 className="h-2.5 w-2.5" /> Sheet: {upload.sheetName || "—"}
            </Badge>
            <span>{upload.mappedRows || stats.mappedRows} rows ready (preview max 500 of {stats.totalRows || upload.totalRows})</span>
            <StatusChip status={upload.status} />
          </div>
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
            <TabsTrigger value="rows" className="text-xs">Mapped rows — {TEMPLATE_COLUMNS.length} template columns</TabsTrigger>
            <TabsTrigger value="xml" className="text-xs">STEPXML</TabsTrigger>
            <TabsTrigger value="issues" className="text-xs">Issues ({stats.topIssues.length})</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-1.5">
            {canEdit && upload.status !== "SENT" && (
              <Button
                variant="outline" size="sm"
                className={cn("h-7 text-[11px] border-2", editMode ? "border-[#DD1C24] text-[#DD1C24]" : "border-black text-black")}
                onClick={() => { setEditMode((v) => !v); setActiveCell(null); }}
              >
                {editMode ? <><EyeOff className="h-3 w-3 mr-1" /> Done editing</> : <><Pencil className="h-3 w-3 mr-1" /> Edit data</>}
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-7 text-[11px] border-neutral-200 text-neutral-600" onClick={() => setHideEmpty((v) => !v)}>
              {hideEmpty ? <><Eye className="h-3 w-3 mr-1" /> Show all columns</> : <><EyeOff className="h-3 w-3 mr-1" /> Hide empty columns</>}
            </Button>
            {editMode && pending.size > 0 && (
              <Button size="sm" className="h-7 text-[11px] bg-[#DD1C24] hover:bg-[#b9151c] text-white" disabled={saving} onClick={saveEdits}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <><Save className="h-3 w-3 mr-1" />Save {pending.size} edits</>}
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="rows">
          {/* filter toolbar */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <Input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter rows by any value…"
                className="h-8 w-56 pl-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-1">
              {(["all", "mapped", "ai_suggested", "manual_required"] as const).map((f) => (
                <button key={f} onClick={() => setStatusFilter(f)}
                  className={cn(
                    "px-2.5 py-1 rounded-full border text-[10px] font-semibold transition-colors",
                    statusFilter === f ? "border-black bg-black text-white" : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-400"
                  )}>
                  {f === "all" ? "All" : TYPE_STYLE[f].label}
                </button>
              ))}
            </div>
            {canEdit && upload.status !== "SENT" && selectedRows.size > 0 && (
              <Button size="sm" className="h-7 text-[11px] bg-[#DD1C24] hover:bg-[#b9151c] text-white ml-auto" disabled={deleting} onClick={deleteSelected}>
                {deleting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <><Trash2 className="h-3 w-3 mr-1" />Delete {selectedRows.size} row(s)</>}
              </Button>
            )}
          </div>

          <div className="text-[10px] text-neutral-400 mb-1.5 flex flex-wrap items-center gap-3">
            <span><span className="inline-block h-2 w-2 rounded-sm bg-emerald-400 mr-1" />auto</span>
            <span><span className="inline-block h-2 w-2 rounded-sm bg-neutral-800 mr-1" />ai</span>
            <span><span className="inline-block h-2 w-2 rounded-sm bg-amber-400 mr-1" />manual</span>
            <span><span className="inline-block h-2 w-2 rounded-sm bg-neutral-300 mr-1" />n/a</span>
            {editMode && <span className="text-[#DD1C24] font-semibold">— click a cell to edit (Enter/Tab commits, Esc cancels)</span>}
            {canEdit && upload.status !== "SENT" && !editMode && <span>— tick rows then Delete to remove unwanted data</span>}
          </div>

          <div className="rounded-lg border-2 border-black overflow-auto max-h-[420px]">
            <table className="text-[10px] border-separate border-spacing-0">
              <thead>
                <tr>
                  {canEdit && upload.status !== "SENT" && (
                    <th rowSpan={2} className="sticky left-[36px] z-20 top-[26px] bg-neutral-100 border-r-2 border-b-2 border-black px-1.5 py-1.5 min-w-[32px]">
                      <Checkbox
                        aria-label="Select all filtered rows"
                        checked={filteredRows.length > 0 && filteredRows.every((r) => selectedRows.has(r.rowNo))}
                        onCheckedChange={(c) => {
                          setSelectedRows((prev) => {
                            const next = new Set(prev);
                            if (c) filteredRows.slice(0, rowLimit).forEach((r) => next.add(r.rowNo));
                            else filteredRows.forEach((r) => next.delete(r.rowNo));
                            return next;
                          });
                        }}
                        className="h-3.5 w-3.5"
                      />
                    </th>
                  )}
                  <th rowSpan={2} className={cn("sticky left-0 z-20 top-[26px] bg-neutral-100 border-r-2 border-b-2 border-black px-2 py-1.5 font-bold text-neutral-600 min-w-[36px]", !canEdit && "z-20")}>#</th>
                  {clusterBands.map((b, i) => (
                    <th key={i} colSpan={b.span} className="bg-black text-white px-2 py-1 text-[9px] font-bold uppercase tracking-wider border-r border-neutral-700 whitespace-nowrap">
                      {b.cluster} ({b.span})
                    </th>
                  ))}
                </tr>
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
                {filteredRows.slice(0, rowLimit).map((r) => (
                  <tr key={r.rowNo} className="group">
                    {canEdit && upload.status !== "SENT" && (
                      <td className="sticky left-[36px] z-10 bg-white group-hover:bg-neutral-50 border-r-2 border-b border-black px-1.5 py-1">
                        <Checkbox checked={selectedRows.has(r.rowNo)} onCheckedChange={() => toggleRow(r.rowNo)} className="h-3.5 w-3.5" aria-label={`Select row ${r.rowNo}`} />
                      </td>
                    )}
                    <td className={cn("sticky left-0 z-10 bg-white group-hover:bg-neutral-50 border-r-2 border-b border-black px-2 py-1 text-neutral-400 font-semibold", canEdit && upload.status !== "SENT" && selectedRows.has(r.rowNo) && "bg-red-50")}>{r.rowNo}</td>
                    {visibleColumns.map((c) => {
                      if (!c.id) return <td key={c.name} title={`${c.name} — no AT id in template`} className="border-b border-neutral-200 bg-neutral-50/60 px-2 py-1 text-neutral-300 whitespace-nowrap max-w-[140px] truncate">n/a</td>;
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
                          title={edited !== undefined ? `${shown} (edited)` : shown || `${c.id} — empty`}
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
                {filteredRows.length === 0 && (
                  <tr><td colSpan={visibleColumns.length + 2} className="px-3 py-6 text-center text-neutral-400">
                    {rows.length === 0 ? "No sample rows available." : "No rows match the current filter."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredRows.length > 0 && (
            <div className="text-[10px] text-neutral-400 mt-1 flex flex-wrap items-center gap-2">
              <span>
                Showing {Math.min(rowLimit, filteredRows.length)} of {filteredRows.length} matching rows ({rows.length} total) × {visibleColumns.length} columns (of {TEMPLATE_COLUMNS.length} template columns{hideEmpty ? `, ${TEMPLATE_COLUMNS.length - visibleColumns.length} empty hidden` : ""}).
              </span>
              {filteredRows.length > rowLimit && (
                <button className="font-semibold text-[#DD1C24] hover:underline" onClick={() => setRowLimit((n) => Math.min(n + 50, filteredRows.length))}>
                  Load 50 more rows ↓
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
            STEPXML will be sent to <b className="font-mono">{upload.endpoint}</b>. Confirmation required.
          </div>
          <Button onClick={onSend} className="bg-[#DD1C24] hover:bg-[#b9151c] text-white" disabled={busy}>
            <Send className="h-4 w-4 mr-1.5" /> Review &amp; send to Stibo
          </Button>
        </div>
      )}
      {upload.status === "SENT" && (
        <div className="px-5 py-3 border-t-2 border-black bg-emerald-50 text-xs text-emerald-700 flex items-center gap-2">
          <CircleCheck className="h-4 w-4" /> This file was already sent to Stibo (see history below / Uploads tab).
        </div>
      )}
      <div className="px-5 pb-3 text-[10px] text-neutral-300 flex items-center gap-1">
        <ArrowRight className="h-2.5 w-2.5" /> Source: {upload.filename} · sheet {upload.sheetName || "—"}
      </div>
    </div>
  );
}

/* ─────────────────────────── sent card ─────────────────────────── */

export function SentCard({ job, filename }: { job: Job; filename: string }) {
  const ok = job.status === "SUCCESS";
  return (
    <div className={cn("rounded-2xl border-2 shadow-sm overflow-hidden", ok ? "border-emerald-600" : "border-[#DD1C24]")}>
      <div className={cn("px-5 py-4 flex items-center gap-3", ok ? "bg-emerald-50" : "bg-red-50")}>
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", ok ? "bg-emerald-100" : "bg-red-100")}>
          {ok ? <CircleCheck className="h-5 w-5 text-emerald-600" /> : <CircleAlert className="h-5 w-5 text-[#DD1C24]" />}
        </div>
        <div>
          <div className="text-sm font-semibold text-black">{ok ? "Sent to Stibo" : "Send failed"}</div>
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
