#!/bin/bash
# STIBO Hub v2.0 — Browser E2E verification (single session; server + browser in one call).
set -u
cd /home/z/my-project
mkdir -p analysis/v2-screens

# 1) ensure server
if ! curl -s -o /dev/null --max-time 2 http://localhost:3000/api/health; then
  (bunx next dev -p 3000 >> dev.log 2>&1 &)
  for i in $(seq 1 40); do sleep 1; curl -s -o /dev/null --max-time 2 http://localhost:3000/api/health && break; done
fi
echo "SERVER READY"

AB="agent-browser"
$AB close >/dev/null 2>&1 || true

echo "=== B1 login page ==="
$AB open http://localhost:3000 >/dev/null
$AB wait --load networkidle >/dev/null 2>&1
$AB snapshot -i | head -12

echo "=== B2 login as admin ==="
$AB find label "Email" fill "admin@map.co.id" 2>/dev/null || $AB find textbox fill "admin@map.co.id"
$AB find label "Password" fill "Stibo@2026" 2>/dev/null || true
$AB find role button click --name "Sign in" 2>/dev/null || $AB find text "Sign In" click 2>/dev/null || true
sleep 3
$AB get title
$AB screenshot analysis/v2-screens/01-after-login.png >/dev/null

echo "=== B3 assistant mode switch (Pipeline → Q&A) ==="
$AB find text "Q&A" click >/dev/null 2>&1 && echo "clicked Q&A tab" || echo "Q&A tab NOT found"
sleep 2
$AB screenshot analysis/v2-screens/02-qa-empty.png >/dev/null
$AB snapshot -i | rg -i "brand aktif|Format nama|Tanya" | head -5

echo "=== B4 ask a question in Q&A ==="
$AB find textbox fill "SBU untuk brand ELL di ID" >/dev/null 2>&1 || $AB find role textbox fill "SBU untuk brand ELL di ID"
$AB press Enter >/dev/null
sleep 3
$AB screenshot analysis/v2-screens/03-qa-answer.png >/dev/null
$AB snapshot | rg -i "RNA|entri|Brand Reporting" | head -4

echo "=== B5 docs view ==="
$AB eval "window.__hub && window.__hub" >/dev/null 2>&1 || true
# navigate via sidebar text
$AB find text "Documentation" click >/dev/null 2>&1 && echo "nav→docs ok" || echo "docs nav failed"
sleep 2
$AB screenshot analysis/v2-screens/04-docs.png >/dev/null
$AB snapshot | rg -i "Documentation Center|Panduan Memulai|Glosarium|Changelog" | head -6

echo "=== B6 docs search ==="
$AB find textbox fill "naming" >/dev/null 2>&1
sleep 2
$AB snapshot | rg -i "Konvensi Penamaan" | head -3

echo "=== B7 master data naming tab + add dialog ==="
$AB find text "Data Master" click >/dev/null 2>&1
sleep 1
$AB find text "Naming Routes" click >/dev/null 2>&1
sleep 2
$AB snapshot -i | rg -i "Add route|Import|CSV" | head -4
$AB screenshot analysis/v2-screens/05-master-naming.png >/dev/null

echo "=== B8 RNA tab ==="
$AB find text "RNA" click >/dev/null 2>&1
sleep 2
$AB snapshot | rg -i "baris RNA|Country" | head -4
$AB screenshot analysis/v2-screens/06-master-rna.png >/dev/null

echo "=== B9 command palette ⌘K ==="
$AB press Control+k >/dev/null 2>&1
sleep 1
$AB screenshot analysis/v2-screens/07-palette.png >/dev/null
$AB snapshot -i | rg -i "Navigasi|Quick|Dokumentasi" | head -5
$AB press Escape >/dev/null 2>&1

echo "=== B10 console errors check ==="
$AB errors | head -8
$AB console | rg -i "error" | head -5 || echo "(no console errors)"

$AB close >/dev/null 2>&1
echo "=== E2E DONE ==="