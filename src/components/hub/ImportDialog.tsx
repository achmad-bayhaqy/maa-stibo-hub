"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, exportCsv } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Loader2, UploadCloud, FileUp, CircleCheck, CircleAlert, Download, Eye } from "lucide-react";

export type ImportEntity = "brands" | "attributes" | "rules" | "lov-values";

interface ImportResult {
  mode: string; entity: string; total: number; validCount: number; failedCount: number;
  errors: Array<{ row: number; error: string }>;
  applied?: number; updated?: number; preview?: Record<string, string[] | string>[];
}

const ENTITY_LABEL: Record<ImportEntity, string> = {
  brands: "Brands", attributes: "Attributes", rules: "Mapping Rules", "lov-values": "LOV Values",
};

/**
 * Bulk Import dialog — btool PREVIEW → APPLY pattern.
 * Phase 1 (preview): parse + validate, show summary + row errors. No writes.
 * Phase 2 (apply): write valid rows (optional upsert), report inserted/updated/failed.
 */
export function ImportDialog({ entity, open, onOpenChange, onDone }: {
  entity: ImportEntity;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone?: () => void;
}) {
  const { toast } = useToast();
  const [csv, setCsv] = useState("");
  const [upsert, setUpsert] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [applied, setApplied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => { setCsv(""); setResult(null); setApplied(false); setUpsert(true); }, []);

  useEffect(() => { if (open) reset(); }, [open, reset]);

  const run = async (mode: "preview" | "apply") => {
    setBusy(true);
    try {
      const res = await api<ImportResult>(`/api/import/${entity}`, {
        method: "POST",
        body: JSON.stringify({ csv, mode, upsert }),
      });
      setResult(res);
      if (mode === "apply") {
        setApplied(true);
        toast({ title: "Import applied", description: `${res.applied ?? 0} inserted · ${res.updated ?? 0} updated · ${res.failedCount} failed` });
      }
    } catch (e) {
      toast({ title: "Import failed", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const downloadTemplate = () => {
    window.open(`/api/import/${entity}`, "_blank");
  };

  const handleOpenChange = (o: boolean) => {
    if (!o && applied) onDone?.(); // refresh parent list after a successful apply
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <UploadCloud className="h-4 w-4 text-red-500" /> Bulk Import — {ENTITY_LABEL[entity]}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Two-phase flow: <b>Preview</b> validates without writing, then <b>Apply</b> imports the valid rows.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-3">
            <div
              className={cn("rounded-xl border-2 border-dashed p-6 text-center transition-colors", csv ? "border-emerald-300 bg-emerald-50/50" : "border-slate-300 hover:border-red-300 hover:bg-red-50/30")}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) f.text().then(setCsv);
              }}
              onClick={() => fileRef.current?.click()}
              role="button" tabIndex={0}
            >
              <FileUp className="h-8 w-8 mx-auto text-slate-400 mb-2" />
              {csv ? (
                <div className="text-xs font-semibold text-emerald-700">✓ {csv.split("\n").length - 1} rows loaded — click to replace the file</div>
              ) : (
                <div className="text-xs text-slate-500">Drop a CSV file here or click to browse</div>
              )}
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => e.target.files?.[0]?.text().then(setCsv)} />
            </div>
            <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={5} placeholder="…or paste CSV directly here"
              className="w-full rounded-lg border font-mono text-[11px] p-3" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Checkbox id="upsert" checked={upsert} onCheckedChange={(c) => setUpsert(c === true)} />
                <Label htmlFor="upsert" className="text-xs">Upsert (update existing rows)</Label>
              </div>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={downloadTemplate}>
                <Download className="h-3.5 w-3.5 mr-1" /> Template CSV
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Total" value={result.total} cls="text-slate-700" />
              <Stat label={applied ? "Applied" : "Valid"} value={applied ? (result.applied ?? 0) : result.validCount} cls="text-emerald-600" />
              <Stat label="Failed" value={result.failedCount} cls={result.failedCount > 0 ? "text-red-500" : "text-slate-400"} />
            </div>
            {!applied && result.updated !== undefined && result.updated > 0 && (
              <div className="text-[11px] text-slate-500 px-1">{result.updated} existing rows will be updated (upsert).</div>
            )}
            {result.preview && !applied && result.preview.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <div className="px-3 py-1.5 bg-slate-50 border-b text-[10px] font-semibold text-slate-500 flex items-center gap-1"><Eye className="h-3 w-3" /> Preview first 10 rows</div>
                <pre className="max-h-32 overflow-auto text-[10px] font-mono p-3 text-slate-600">{JSON.stringify(result.preview, null, 1)}</pre>
              </div>
            )}
            {result.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 overflow-hidden">
                <div className="px-3 py-1.5 bg-red-50 border-b border-red-200 text-[10px] font-semibold text-red-600 flex items-center gap-1">
                  <CircleAlert className="h-3 w-3" /> Per-row errors ({result.errors.length})
                </div>
                <div className="max-h-40 overflow-auto divide-y">
                  {result.errors.map((e, i) => (
                    <div key={i} className="px-3 py-1.5 text-[11px] flex gap-2">
                      <span className="font-mono text-slate-400 shrink-0">baris {e.row}</span>
                      <span className="text-red-600">{e.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {applied && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
                <CircleCheck className="h-4 w-4" /> Import complete — recorded in the Audit Log.
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {result && !applied && (
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setResult(null)}>← Back to edit</Button>
          )}
          {!result ? (
            <Button size="sm" className="bg-[#DD1C24] hover:bg-[#b9151c] text-white text-xs" disabled={busy || !csv.trim()}
              onClick={() => run("preview")}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Eye className="h-4 w-4 mr-1" /> Preview</>}
            </Button>
          ) : (
            !applied && (
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs" disabled={busy || result.validCount === 0}
                onClick={() => run("apply")}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Apply {result.validCount} rows</>}
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="rounded-lg border bg-white px-3 py-2.5">
      <div className={cn("text-xl font-bold leading-none", cls)}>{value}</div>
      <div className="text-[10px] text-slate-400 mt-1">{label}</div>
    </div>
  );
}
