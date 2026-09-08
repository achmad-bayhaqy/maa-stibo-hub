#!/usr/bin/env python3
"""Post-process the generated DOCX for WPS/Word page-number compatibility:
1. Remove empty <w:pgNumType/> elements (docx-js artifact that confuses WPS)
2. Patch footer PAGE fields with explicit format switches:
   - front-matter footer -> PAGE \\* ROMAN \\* MERGEFORMAT
   - body footer         -> PAGE \\* arabic \\* MERGEFORMAT
   Footer-to-section mapping resolved via document.xml footerReference order:
   first referenced footer belongs to the Roman section, second to the Arabic body.
"""
import re
import shutil
import sys
import zipfile

DOCX = "/home/z/my-project/download/MAP-Stibo_System_Documentation.docx"
TMP = DOCX + ".tmp"

with zipfile.ZipFile(DOCX, "r") as zin:
    names = zin.namelist()
    data = {n: zin.read(n) for n in names}

doc_xml = data["word/document.xml"].decode("utf-8")

# 1. remove empty pgNumType
before = doc_xml.count("<w:pgNumType/>")
doc_xml = doc_xml.replace("<w:pgNumType/>", "")
print(f"removed empty pgNumType: {before}")

# 2. footer references in document order (default footers only)
refs = re.findall(r'<w:footerReference w:type="default" r:id="(rId\d+)"/>', doc_xml)
print("footer refs in order:", refs)

rels_xml = data["word/_rels/document.xml.rels"].decode("utf-8")
rid_to_target = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="([^"]+)"', rels_xml))
targets = [rid_to_target[r].lstrip("/").replace("word/", "") for r in refs]
print("footer files in order:", targets)

def patch_footer(xml: str, fmt: str) -> str:
    return re.sub(
        r'(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)',
        rf'\1 PAGE \\* {fmt} \\* MERGEFORMAT \2',
        xml,
    )

if len(targets) >= 2:
    roman_f, arabic_f = targets[0], targets[1]
    key_r = "word/" + roman_f
    key_a = "word/" + arabic_f
    data[key_r] = patch_footer(data[key_r].decode("utf-8"), "ROMAN").encode("utf-8")
    data[key_a] = patch_footer(data[key_a].decode("utf-8"), "arabic").encode("utf-8")
    print(f"patched {roman_f} -> ROMAN, {arabic_f} -> arabic")
elif len(targets) == 1:
    key_a = "word/" + targets[0]
    data[key_a] = patch_footer(data[key_a].decode("utf-8"), "arabic").encode("utf-8")
    print(f"patched single footer {targets[0]} -> arabic")
else:
    print("WARNING: no footer references found")

data["word/document.xml"] = doc_xml.encode("utf-8")

with zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as zout:
    for n in names:
        zout.writestr(n, data[n])
shutil.move(TMP, DOCX)
print("post-process done")
