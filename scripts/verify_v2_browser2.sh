#!/bin/bash
# STIBO Hub v2.0 — Browser E2E pass 2: ref-based precise interactions.
set -u
cd /home/z/my-project
AB="agent-browser"

if ! curl -s -o /dev/null --max-time 2 http://localhost:3000/api/health; then
  (bunx next dev -p 3000 >> dev.log 2>&1 &)
  for i in $(seq 1 40); do sleep 1; curl -s -o /dev/null --max-time 2 http://localhost:3000/api/health && break; done
fi
echo "SERVER READY"
$AB close >/dev/null 2>&1 || true

echo "=== P1 login ==="
$AB open http://localhost:3000 >/dev/null; sleep 2
$AB find label "Work email" fill "admin@map.co.id" >/dev/null
$AB find label "Password" fill "Stibo@2026" >/dev/null
$AB find role button click --name "Sign in" >/dev/null; sleep 3
echo "title: $($AB get title)"

echo "=== P2 mode tabs present? ==="
$AB snapshot -i | rg -i "pipeline|q&a|tanya" | head -6

echo "=== P3 click Q&A via find text ==="
$AB find text "Q&A" click 2>&1 | head -2
sleep 2
$AB snapshot | rg -i "Tanya apa saja|Halo|Saya STIBO Hub Assistant" | head -4

echo "=== P4 ask via textbox ref ==="
REF=$($AB snapshot -i --json | python3 -c "import json,sys; d=json.load(sys.stdin); els=d if isinstance(d,list) else d.get('elements',d.get('tree',[])); print('')" 2>/dev/null)
$AB snapshot -i | rg "textbox" | head -3
# try the suggested-prompt button instead (more deterministic)
$AB find text "Brand aktif" click >/dev/null 2>&1 && echo "clicked suggested 'Brand aktif'"
sleep 3
$AB screenshot analysis/v2-screens/08-qa-brand-answer.png >/dev/null
$AB snapshot | rg -i "Daftar brand|2XU|ADIDAS|baris" | head -6

echo "=== P5 follow-up chip click ==="
$AB snapshot | rg -o 'button "[^"]+"' | head -20

echo "=== P6 palette via topbar Search button ==="
$AB find text "Search…" click >/dev/null 2>&1 && echo "palette opened via topbar"
sleep 1
$AB screenshot analysis/v2-screens/09-palette-open.png >/dev/null
$AB snapshot -i | rg -i "Navigasi|Documentation|Data Master" | head -5
$AB press Escape >/dev/null 2>&1

echo "=== P7 RNA tab via ref ==="
$AB find text "Data Master" click >/dev/null; sleep 2
$AB snapshot -i | rg -i "RNA|Naming Routes" | head -4
$AB find text "RNA" click 2>&1 | head -1; sleep 2
$AB snapshot | rg -i "baris RNA|INDONESIA|brandCode" | head -4
$AB screenshot analysis/v2-screens/10-rna-rows.png >/dev/null

echo "=== P8 attribute edit dialog ==="
$AB find text "Attributes" click >/dev/null 2>&1; sleep 2
$AB snapshot -i | rg -i "Add attribute|Import|CSV" | head -4

echo "=== P9 errors ==="
$AB errors | head -6
$AB console 2>/dev/null | rg -i '"level":"error"|error' | head -5 || echo "(console clean)"
$AB close >/dev/null 2>&1
echo "=== PASS2 DONE ==="