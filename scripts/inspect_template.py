#!/usr/bin/env python3
"""Inspect NEW - Brand mapping files Template.xlsx to understand the assigned columns."""
import openpyxl

path = "/home/z/my-project/upload/NEW - Brand mapping files Template.xlsx"
wb = openpyxl.load_workbook(path, data_only=True)
print("SHEETS:", wb.sheetnames)
for ws in wb.worksheets:
    print(f"\n=== Sheet: {ws.title} (dims={ws.dimensions}, max_row={ws.max_row}, max_col={ws.max_column}) ===")
    # print first 8 rows fully
    for r in range(1, min(9, ws.max_row + 1)):
        vals = []
        for c in range(1, min(ws.max_column + 1, 60)):
            v = ws.cell(row=r, column=c).value
            if v is not None:
                vals.append(f"[{openpyxl.utils.get_column_letter(c)}]{str(v)[:40]}")
        print(f"  Row{r}: {' | '.join(vals) if vals else '(empty)'}")
