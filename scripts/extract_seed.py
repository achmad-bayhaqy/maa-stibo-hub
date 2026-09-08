#!/usr/bin/env python3
"""Recon + extract seed data from MAP Stibo Excel files → prisma/seed-data/*.json"""
import json, os, sys, re
from openpyxl import load_workbook

UP = "/home/z/my-project/upload"
OUT = "/home/z/my-project/prisma/seed-data"
os.makedirs(OUT, exist_ok=True)

def recon(path, max_rows=3, max_cols=12):
    wb = load_workbook(path, read_only=True, data_only=True)
    print(f"\n===== {os.path.basename(path)} — {len(wb.sheetnames)} sheets =====")
    for sn in wb.sheetnames:
        ws = wb[sn]
        print(f"\n--- sheet: {sn!r} dims={ws.max_row}x{ws.max_column}")
        for i, row in enumerate(ws.iter_rows(min_row=1, max_row=max_rows, max_col=max_cols, values_only=True)):
            vals = [str(v)[:28] if v is not None else "" for v in row]
            print("   ", " | ".join(vals))
    wb.close()

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "recon"
    if mode == "recon":
        for f in ["Brand Input files & Naming convention.xlsx",
                  "NEW - Brand mapping files Template.xlsx",
                  "Master Data Dictionary (MAA).xlsx"]:
            try:
                recon(os.path.join(UP, f))
            except Exception as e:
                print(f"ERR {f}: {e}")
