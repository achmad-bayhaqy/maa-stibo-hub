#!/usr/bin/env python3
"""
Deep-dive 'NEW - Brand mapping files Template.xlsx'.
Loads twice: data_only=True (cached values) + data_only=False (formulas),
so we can see both the displayed value and any embedded Excel formula.
Usage: python3 analyze_mapping.py [SectionName ...]   (no args = all)
Sections: STATS Template AdidasAPI Ellesse ANTA Crocs LottoMD RNAMap
          Summary MDD PazzionMat ReebokMD1 DRMartensMD BirkenMD AsicsMD
          BirkenEcom NewEraMD OtherMD Formulas
"""
import sys, os, re
import openpyxl

PATH = "/home/z/my-project/upload/NEW - Brand mapping files Template.xlsx"
OUT = "/home/z/my-project/analysis/excel_dumps"
os.makedirs(OUT, exist_ok=True)

wbv = openpyxl.load_workbook(PATH, read_only=False, data_only=True)   # values
wbf = openpyxl.load_workbook(PATH, read_only=False, data_only=False)  # formulas

TRUNC = 70
def cellstr(v):
    s = str(v).replace("\n", "\\n")
    return s[:TRUNC] + ("…" if len(s) > TRUNC else "")

def dump(sheet, r1, r2, cols=None, trunc=TRUNC, out=None):
    """Print non-empty cells for rows r1..r2, showing formula when present."""
    wsv, wsf = wbv[sheet], wbf[sheet]
    w = out if out else sys.stdout
    n = 0
    for row in wsv.iter_rows(min_row=r1, max_row=r2, max_col=wsf.max_column):
        parts = []
        for c in row:
            if cols and c.column not in cols: continue
            v = c.value
            if v is None or (isinstance(v, str) and not v.strip()): continue
            f = wsf.cell(row=c.row, column=c.column).value
            tag = ""
            if isinstance(f, str) and f.startswith("="):
                tag = f"  ⟨F:{cellstr(f)}⟩"
            parts.append(f"{c.coordinate}={cellstr(v)}{tag}")
        if parts:
            n += 1
            print(f"r{row[0].row:>4}: " + " | ".join(parts), file=w)
    return n

def colstats(sheet):
    """Non-empty count per column + formula count per column."""
    wsv, wsf = wbv[sheet], wbf[sheet]
    cnt, fcnt, hdr = {}, {}, {}
    for row in wsf.iter_rows():
        for c in row:
            if c.value is not None and str(c.value).strip():
                fcnt[c.column] = fcnt.get(c.column, 0) + 1
    for row in wsv.iter_rows():
        for c in row:
            if c.value is not None and str(c.value).strip():
                cnt[c.column] = cnt.get(c.column, 0) + 1
    for c in range(1, wsf.max_column + 1):
        h = wsv.cell(row=1, column=c).value
        hdr[c] = cellstr(h) if h is not None else ""
    return hdr, cnt, fcnt, wsv.max_row

def section_stats(names):
    for s in names:
        hdr, cnt, fcnt, mr = colstats(s)
        print(f"\n### SHEET {s!r}  (rows={mr}, cols={wbv[s].max_column}) merged={len(wbv[s].merged_cells.ranges)}")
        print("   merged ranges:", [str(r) for r in list(wbv[s].merged_cells.ranges)[:12]])
        for c in sorted(cnt):
            f = fcnt.get(c, 0)
            print(f"   col{c:>2} {hdr[c][:38]:40s} non-empty={cnt[c]:>4} formulas={f}")

def section_dump(name, sheet, r1, r2, fname=None, cols=None):
    print(f"\n{'='*90}\n### DUMP {name} -> sheet {sheet!r} rows {r1}..{r2}\n{'='*90}")
    if fname:
        with open(os.path.join(OUT, fname), "w", encoding="utf-8") as f:
            n = dump(sheet, r1, r2, cols=cols, trunc=200, out=f)
        print(f"   ({n} non-empty rows written to analysis/excel_dumps/{fname})")
    else:
        dump(sheet, r1, r2, cols=cols)

want = sys.argv[1:] or ["STATS", "Template", "AdidasAPI", "Ellesse", "ANTA", "Crocs",
                        "LottoMD", "RNAMap", "Summary", "MDD", "PazzionMat", "ReebokMD1",
                        "DRMartensMD", "BirkenMD", "AsicsMD", "BirkenEcom", "NewEraMD", "Formulas"]

if "STATS" in want:
    sheets = ["Template", "Adidas-API", "Sample Lotto - Inline", "Crocs(Inline)", "Ellesse(Licensed)",
              "ANTA", "Pazzion(Inline)", "Reebok (Licensed)", "Lotto MD Mappings", "Birken-MD Mappings",
              "Reebok MD Mappings sheet 1", "Pazzion MD Mapping-Material", "Source Mapping related RNA",
              "Summary Missing Requirements", "MDD", "Asics MD Mappings"]
    section_stats(sheets)

if "Template" in want:    section_dump("Template header+data", "Template", 1, 60, "Template.txt")
if "AdidasAPI" in want:   section_dump("Adidas-API full", "Adidas-API", 1, 60, "Adidas-API.txt")
if "Ellesse" in want:     section_dump("Ellesse(Licensed) full", "Ellesse(Licensed)", 1, 60, "Ellesse-Licensed.txt")
if "ANTA" in want:        section_dump("ANTA full", "ANTA", 1, 60, "ANTA.txt")
if "Crocs" in want:       section_dump("Crocs(Inline) full", "Crocs(Inline)", 1, 60, "Crocs-Inline.txt")

if "LottoMD" in want:
    section_dump("Lotto MD Mappings", "Lotto MD Mappings", 1, 80, "Lotto-MD-Mappings.txt")
if "RNAMap" in want:
    section_dump("Source Mapping related RNA", "Source Mapping related RNA", 1, 45, "RNA-SourceMapping.txt")
if "Summary" in want:
    section_dump("Summary Missing Requirements (full)", "Summary Missing Requirements", 1, 15)
if "MDD" in want:
    section_dump("MDD (hidden, first 60)", "MDD", 1, 60, "MDD-sheet.txt")
if "PazzionMat" in want:
    section_dump("Pazzion MD Mapping-Material (full)", "Pazzion MD Mapping-Material", 1, 53)
if "ReebokMD1" in want:
    section_dump("Reebok MD Mappings sheet 1 (full)", "Reebok MD Mappings sheet 1", 1, 53)
if "DRMartensMD" in want:
    section_dump("DR.Martens MD Mappings (full)", "DR.Martens MD Mappings", 1, 41)
if "BirkenMD" in want:
    section_dump("Birken-MD Mappings", "Birken-MD Mappings", 1, 60, "Birken-MD-Mappings.txt")
if "AsicsMD" in want:
    section_dump("Asics MD Mappings", "Asics MD Mappings", 1, 40, "Asics-MD-Mappings.txt")
if "BirkenEcom" in want:
    section_dump("Birken Ecom Mappings (full)", "Birken Ecom Mappings", 1, 54)
if "NewEraMD" in want:
    section_dump("New Era MD Mappings (full)", "New Era MD Mappings", 1, 56)
if "Formulas" in want:
    print("\n### FORMULA COUNT PER SHEET (formulas = embedded transform logic)")
    for s in wbv.sheetnames:
        wsf = wbf[s]
        nf = 0
        ex = []
        for row in wsf.iter_rows():
            for c in row:
                if isinstance(c.value, str) and c.value.startswith("="):
                    nf += 1
                    if len(ex) < 2: ex.append(f"{c.coordinate}={cellstr(c.value)}")
        if nf: print(f"   {s!r:42s} formulas={nf:>4}  e.g. {ex}")
print("\nDONE")
