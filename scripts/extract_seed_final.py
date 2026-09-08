#!/usr/bin/env python3
"""Extract seed data from MAP Stibo Excel files → prisma/seed-data/*.json"""
import json, os, re
from openpyxl import load_workbook

UP = "/home/z/my-project/upload"
OUT = "/home/z/my-project/prisma/seed-data"
os.makedirs(OUT, exist_ok=True)

def cell(v):
    if v is None: return ""
    s = str(v).replace("\n", " ").strip()
    return re.sub(r"\s+", " ", s)

def norm_type(raw):
    r = raw.lower()
    if "formula" in r: return "SYSTEM_FORMULA"
    if "ai" in r: return "AI_ASSIST"
    if "manual input in portal" in r: return "MANUAL_PORTAL"
    if "manual" in r: return "MANUAL"
    if "direct from principal" in r and ("manual" in r): return "MANUAL_DIRECT"
    if "direct" in r: return "DIRECT"
    if "mapping" in r: return "MAPPING"
    if "not avai" in r or r in ("n/a", "0"): return "NOT_AVAILABLE"
    if "source" in r or "dashboard" in r: return "EXTERNAL_SOURCE"
    return "OTHER"

def write(name, data):
    p = os.path.join(OUT, name)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"  {name}: {len(data) if isinstance(data, list) else 'obj'} items, {os.path.getsize(p)//1024} KB")

# ─────────────────────────────────────────────
print("1. Attributes (Template!MDD sheet)")
wb = load_workbook(os.path.join(UP, "NEW - Brand mapping files Template.xlsx"), read_only=True, data_only=True)
attrs = []
ws = wb["MDD"]
for row in ws.iter_rows(min_row=2, max_col=3, values_only=True):
    name, code, vtype = cell(row[0]), cell(row[1]), cell(row[2])
    if code.startswith("AT_"):
        attrs.append({"code": code, "name": name, "validation": vtype or "text"})
# dedupe
seen = set(); attributes = []
for a in attrs:
    if a["code"] not in seen:
        seen.add(a["code"]); attributes.append(a)
write("attributes.json", attributes)

# ─────────────────────────────────────────────
print("2. Mapping rules per brand sheet")
SPECIAL = {"Template", "MDD", "Source Mapping related RNA", "Summary Missing Requirements"}
rules = []
brand_sheets = []
for sn in wb.sheetnames:
    if sn in SPECIAL or "MD Mapping" in sn or "MD Mapping" in sn or "Ecom Mapping" in sn: continue
    ws = wb[sn]
    rows = list(ws.iter_rows(min_row=1, max_row=min(ws.max_row or 1, 300), max_col=12, values_only=True))
    # find header row
    hdr_idx = None
    for i, row in enumerate(rows[:6]):
        if row and cell(row[0]).startswith("Stibo Attribute"):
            hdr_idx = i; break
    if hdr_idx is None: continue
    brand_sheets.append(sn)
    n = 0
    for row in rows[hdr_idx + 1:]:
        attr_name, attr_id, valid, cluster, grouping, desc, mtype, brandfile, sheetname, srcfield, logic, extra = [cell(x) for x in (list(row) + [""] * 12)[:12]]
        if not attr_id or attr_id == "#N/A": continue
        rules.append({
            "brandSheet": sn, "attribute": attr_name, "attributeId": attr_id,
            "validation": valid or "text", "cluster": cluster, "grouping": grouping,
            "description": desc[:400], "mappingTypeRaw": mtype[:200],
            "mappingType": norm_type(mtype), "sourceField": srcfield[:120],
            "logic": logic[:300], "extra": extra[:300],
        })
        n += 1
    print(f"    {sn}: {n} rules")
write("rules.json", rules)
write("brand_sheets.json", brand_sheets)
wb.close()

# ─────────────────────────────────────────────
print("3. RNA master lookup (Source Mapping related RNA)")
wb = load_workbook(os.path.join(UP, "NEW - Brand mapping files Template.xlsx"), read_only=True, data_only=True)
ws = wb["Source Mapping related RNA"]
rna = []
for row in ws.iter_rows(min_row=2, max_col=12, values_only=True):
    c = [cell(x) for x in (list(row) + [""] * 12)[:12]]
    if not c[9] and not c[8]: continue
    rna.append({
        "country": c[0], "compCode": c[1], "sbuGrouping": c[2], "subSbu": c[3],
        "sbu": c[4], "brandGroup": c[5], "brandCategory": c[6], "brandType": c[7],
        "brandName": c[8], "brandCode": c[9], "reportingBrandCode": c[10], "reportingBrandName": c[11],
    })
write("rna.json", rna)
wb.close()

# ─────────────────────────────────────────────
print("4. Brands from RNA + naming sheet")
brands = {}
for r in rna:
    code = r["brandCode"]
    if code and code not in brands:
        brands[code] = {"code": code, "name": r["brandName"], "sbu": r["sbu"],
                        "brandGroup": r["brandGroup"], "brandCategory": r["brandCategory"], "brandType": r["brandType"]}
write("brands.json", list(brands.values()))

# ─────────────────────────────────────────────
print("5. Naming convention (Stibo sheet) → flow routing")
wb2 = load_workbook(os.path.join(UP, "Brand Input files & Naming convention.xlsx"), read_only=True, data_only=True)
ws = wb2["Stibo"]
naming = []
last_brand, last_inline = "", ""
ENDPOINT_MAP = {"article planning": "ARTICLE_PLANNING", "ean update": "EAN_UPDATE", "article maintenance": "ARTICLE_MAINTENANCE"}
for row in ws.iter_rows(min_row=2, max_col=6, values_only=True):
    c = [cell(x) for x in (list(row) + [""] * 6)[:6]]
    if c[0]: last_brand = c[0]
    if c[1]: last_inline = c[1]
    ft, trig, ep, comment = c[2], c[3], c[4], c[5]
    if not ft and not trig: continue
    ep_norm = ""
    for k, v in ENDPOINT_MAP.items():
        if k.lower() in (ep or "").lower() or k.lower() in (trig or "").lower():
            ep_norm = v; break
    naming.append({"brand": last_brand, "inline": last_inline, "fileType": ft,
                   "trigger": trig, "endpoint": ep_norm, "comment": comment[:150]})
write("naming.json", naming)
wb2.close()

# ─────────────────────────────────────────────
print("6. LOVs from MDD workbook")
wb3 = load_workbook(os.path.join(UP, "Master Data Dictionary (MAA).xlsx"), read_only=True, data_only=True)
LOV_SHEETS = ["Company Code LOV", "SBU LOV", "Company LOV", "Brand LOV", "Ecomm Concept LOV",
              "Price Range LOV", "UOM LOV", "Gender LOV", "Age LOV", "Standardized Color LOV",
              "Material LOV", "SAP Article Type LOV", "Article Category LOV", "Sports Category LOV",
              "Country Size LOV", "Country Origin LOV", "Color Code LOV", "Brand Group",
              "Brand Type LOV ", "Brand Status LOV ", "Brand Category LOV", "PatternPrint LOV",
              "Style Type LOV", "Ocassion LOV", "Fabric LOV", "Fastening LOV", "Silhouette LOV",
              "Color Group LOV", "Width LOV", "Fit LOV", "Heel Type LOV", "Heel Height LOV",
              "Country LOV", "Season LOV", "Retail Price Currency LOV", "SAP Product Flag LOV",
              "Channel Category LOV", "Channel Allocation LOV", "BY Article Type", "Content LOV",
              "E-com Ages Category LOV", "Nature of Article LOV", "Images Source LOV"]
CAP = {"Vendor LOV": 500, "Size Code LOV": 900, "Franchise LOV": 400, "MB Assortment Code LOV": 300}
ALL_LOVS = LOV_SHEETS + list(CAP.keys())
lovs = []
for sn in wb3.sheetnames:
    if sn not in ALL_LOVS: continue
    ws = wb3[sn]
    vals = []
    for row in ws.iter_rows(min_row=1, max_col=3, values_only=True):
        c0, c1 = cell(row[0]), cell(row[1]) if len(row) > 1 else ""
        if not c0: continue
        if c0.lower() in ("code", "lov", "value", "description") and vals == []: continue
        if vals == [] and any(c0.lower().startswith(p) for p in ("list of", "code &")): continue
        vals.append({"code": c0[:80], "label": (c1 or c0)[:120]})
    # drop header-ish first row if its label==code and looks like header
    if vals and vals[0]["code"].lower() in ("code", "lov", "value"): vals = vals[1:]
    cap = CAP.get(sn, 1200)
    lovs.append({"key": sn.strip().upper().replace(" ", "_").replace("-", "_"), "sheetName": sn.strip(), "values": vals[:cap]})
    print(f"    {sn}: {min(len(vals), cap)}")
write("lov.json", lovs)
wb3.close()

print("\nDONE. Seed data in", OUT)
