#!/usr/bin/env python3
"""Aggregate all brand mapping sheets: decode A-F letter codes vs 'Field Mapping Type',
collect distinct values of G/I/J, count rows. Also stats for MD mapping sheets."""
import openpyxl, json
from collections import Counter, defaultdict

PATH = "/home/z/my-project/upload/NEW - Brand mapping files Template.xlsx"
wb = openpyxl.load_workbook(PATH, data_only=True)

BRAND_SHEETS = []
for ws in wb.worksheets:
    if ws.cell(row=2, column=1).value == "Stibo Attribute":
        BRAND_SHEETS.append(ws.title)
print("Brand mapping sheets (%d):" % len(BRAND_SHEETS))
for s in BRAND_SHEETS: print("  -", s)

g2letter = defaultdict(Counter)   # G value -> Counter of letters
letters = set()
gvals = Counter()
hvals = Counter()
ivalues = Counter()
apps = Counter()                  # applicability header labels (row 2, cols M..V)
per_sheet_rows = {}
for s in BRAND_SHEETS:
    ws = wb[s]
    hdr2 = {c: ws.cell(row=2, column=c).value for c in range(1, ws.max_column + 1)}
    for c in range(12, ws.max_column + 1):
        v = hdr2.get(c)
        if v and str(v).strip(): apps[f"{ws.cell(row=2,column=c).coordinate}:{v}"] += 1
    n = 0
    for r in range(3, ws.max_row + 1):
        a = ws.cell(row=r, column=1).value
        if a is None or not str(a).strip(): continue
        n += 1
        g = ws.cell(row=r, column=7).value
        gvals[str(g).strip() if g else "(blank)"] += 1
        h = ws.cell(row=r, column=8).value
        if h and str(h).strip(): hvals[str(h).strip()[:60]] += 1
        i = ws.cell(row=r, column=9).value
        if i and str(i).strip(): ivalues[str(i).strip()[:60]] += 1
        for c in range(13, ws.max_column + 1):  # letter cols start col 13 (M) or later
            v = ws.cell(row=r, column=c).value
            if v is not None and str(v).strip() in list("ABCDEF"):
                letters.add(str(v).strip())
                g2letter[str(v).strip()][str(g).strip() if g else "(blank)"] += 1
    per_sheet_rows[s] = n

print("\n### Applicability column headers (row2, col>=12):")
for k, v in apps.most_common(): print(f"   {k}   x{v}")
print("\n### Distinct 'Field Mapping Type' (col G) values:")
for k, v in gvals.most_common(): print(f"   {k!r}: {v}")
print("\n### Letter-code -> Field Mapping Type correlation (across all sheets):")
for L in sorted(g2letter):
    print(f"   {L}: {dict(g2letter[L].most_common())}")
print("\n### Distinct 'Brand File Name & Link' (col H):")
for k, v in hvals.most_common(25): print(f"   {k!r}: {v}")
print("\n### Distinct 'Brand File Sheet Name' (col I):")
for k, v in ivalues.most_common(30): print(f"   {k!r}: {v}")
print("\n### Mapping rows per brand sheet:")
for k, v in per_sheet_rows.items(): print(f"   {k!r}: {v}")
print("\nTOTAL mapping rows across brand sheets:", sum(per_sheet_rows.values()))

# MDD hidden sheet (3 cols) - print fully
print("\n### MDD sheet (hidden) - PIM Attribute Name / ID / Validation Base Type:")
mdd = wb["MDD"]
rows = [(r[0].value, r[1].value, r[2].value) for r in mdd.iter_rows(min_row=1, max_row=403)]
nonnull = [x for x in rows if any(x)]
print("   header:", rows[0], "| non-empty rows:", len(nonnull))
for name, aid, val in nonnull[:12]:
    print(f"   {str(name)[:42]!r:46s} {str(aid)[:34]:36s} {val}")
names = [x[0] for x in nonnull[1:] if x[0]]
ids = [x[1] for x in nonnull[1:] if x[1]]
print("   distinct names:", len(set(names)), "| distinct IDs:", len(set(ids)), "| id prefix AT_:", sum(1 for i in ids if str(i).startswith('AT_')))
with open("/home/z/my-project/analysis/excel_dumps/MDD-sheet-full.txt", "w") as f:
    for name, aid, val in nonnull:
        f.write(f"{name}\t{aid}\t{val}\n")
print("   full MDD written to analysis/excel_dumps/MDD-sheet-full.txt")
