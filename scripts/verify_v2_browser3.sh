#!/bin/bash
# STIBO Hub v2.0 — Browser E2E pass 3: ref-driven Q&A + master CRUD dialogs.
set -u
cd /home/z/my-project
AB="agent-browser"

if ! curl -s -o /dev/null --max-time 2 http://localhost:3000/api/health; then
  (bunx next dev -p 3000 >> dev.log 2>&1 &)
  for i in $(seq 1 40); do sleep 1; curl -s -o /dev/null --max-time 2 http://localhost:3000/api/health && break; done
fi
echo "SERVER READY"
curl -s -o /dev/null --max-time 120 http://localhost:3000/   # force compile root page
curl -s -o /dev/null http://localhost:3000/api/auth/me
sleep 2
$AB close >/dev/null 2>&1 || true

$AB open http://localhost:3000 >/dev/null; sleep 4
$AB find label "Work email" fill "admin@map.co.id" >/dev/null
$AB find label "Password" fill "Stibo@2026" >/dev/null
$AB find role button click --name "Sign in" >/dev/null; sleep 3

echo "=== Q1 switch to Q&A via ref ==="
$AB click @e12 >/dev/null 2>&1 || { $AB snapshot -i | rg "Q&A" | head -2; $AB find role button click --name "Q&A"; }
sleep 2
$AB snapshot | rg -i "Halo Admin|Tanya apa saja|Brand aktif" | head -4

echo "=== Q2 suggested prompt → brand list answer ==="
$AB find role button click --name "Brand aktif" 2>/dev/null | head -1
sleep 3
$AB screenshot analysis/v2-screens/11-qa-brands.png >/dev/null
$AB snapshot | rg -i "Daftar brand|ADIDAS|AIRWALK|30 baris" | head -5

echo "=== Q3 free-text question ==="
QREF=$($AB snapshot -i | rg -o 'textbox[^,]*\[ref=(e[0-9]+)\]' | head -1 | rg -o 'e[0-9]+')
echo "textbox ref: $QREF"
if [ -n "$QREF" ]; then
  $AB fill @$QREF "rule MANUAL brand adidas" >/dev/null
  $AB press Enter >/dev/null
  sleep 3
  $AB screenshot analysis/v2-screens/12-qa-rules.png >/dev/null
  $AB snapshot | rg -i "rule|MANUAL|baris" | head -6
fi

echo "=== Q4 sources & chips rendered ==="
$AB snapshot | rg -i "Data Master|Buka halaman" | head -4

echo "=== Q5 RNA tab + add dialog ==="
$AB find role button click --name "Data Master Brands · Rules · LOV · RNA" >/dev/null; sleep 2
$AB find role button click --name "RNA" >/dev/null 2>&1 || $AB find text "RNA" click >/dev/null 2>&1
sleep 2
$AB snapshot | rg -i "baris RNA" | head -2
$AB screenshot analysis/v2-screens/13-rna.png >/dev/null

echo "=== Q6 add attribute dialog ==="
$AB find role button click --name "Attributes" >/dev/null 2>&1; sleep 2
$AB find role button click --name "Add attribute" 2>&1 | head -1
sleep 1
$AB snapshot -i | rg -i "dialog|Attribute ID|Name|Save" | head -8
$AB screenshot analysis/v2-screens/14-attr-dialog.png >/dev/null
$AB press Escape >/dev/null 2>&1

echo "=== Q7 import dialog ==="
$AB find role button click --name "Import" >/dev/null 2>&1
sleep 1
$AB snapshot | rg -i "Bulk Import|Preview|Template CSV|Upsert" | head -6
$AB screenshot analysis/v2-screens/15-import-dialog.png >/dev/null
$AB press Escape >/dev/null 2>&1

echo "=== Q8 docs page render + cross-link nav ==="
$AB find role button click --name "Documentation Guides & reference" >/dev/null; sleep 2
$AB find role button click --name "Konvensi Penamaan File" >/dev/null 2>&1 || true
sleep 1
$AB screenshot analysis/v2-screens/16-docs-naming.png >/dev/null
$AB snapshot | rg -i "Konvensi Penamaan|naming route|Panduan Assistant" | head -5

echo "=== Q9 final errors ==="
$AB errors | head -5 || true
$AB close >/dev/null 2>&1
echo "=== PASS3 DONE ==="