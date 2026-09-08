#!/bin/bash
# STIBO Hub v2.0 — Browser E2E pass 4: resilient, retry-on-browser-death.
set -u
cd /home/z/my-project
AB="agent-browser"

if ! curl -s -o /dev/null --max-time 2 http://localhost:3000/api/health; then
  (bunx next dev -p 3000 >> dev.log 2>&1 &)
  for i in $(seq 1 40); do sleep 1; curl -s -o /dev/null --max-time 2 http://localhost:3000/api/health && break; done
fi
curl -s -o /dev/null --max-time 120 http://localhost:3000/
echo "SERVER READY"

open_and_login() {
  $AB close --all >/dev/null 2>&1 || true
  sleep 1
  $AB open http://localhost:3000 >/dev/null 2>&1
  sleep 3
  # retry open if page blank
  for i in 1 2 3; do
    T=$($AB get title 2>/dev/null)
    [ "$T" = "STIBO Hub — MAP Master Data Integration Portal" ] && break
    $AB open http://localhost:3000 >/dev/null 2>&1; sleep 3
  done
  if $AB snapshot -i 2>/dev/null | rg -q "Work email"; then
    $AB find label "Work email" fill "admin@map.co.id" >/dev/null 2>&1
    $AB find label "Password" fill "Stibo@2026" >/dev/null 2>&1
    $AB find role button click --name "Sign in" >/dev/null 2>&1
    sleep 3
    echo "LOGIN OK"
  else
    # maybe already logged in from earlier cookie session
    if $AB snapshot 2>/dev/null | rg -q "Pipeline overview|Tanya apa saja|Q&A"; then echo "ALREADY LOGGED IN"; else echo "LOGIN STATE UNKNOWN"; fi
  fi
}

ensure_page() {  # re-open + login if browser died
  T=$($AB get title 2>/dev/null)
  if [ "$T" != "STIBO Hub — MAP Master Data Integration Portal" ]; then open_and_login; fi
}

open_and_login

echo "=== Q1 switch to Q&A ==="
ensure_page
$AB snapshot -i | rg -o 'button "Q&amp;A" \[ref=(e[0-9]+)\]|button "Q&A" \[ref=(e[0-9]+)\]' | head -1
QAREF=$($AB snapshot -i | rg -o 'button "Q.&A" \[ref=(e[0-9]+)\]' -r '$1' | head -1)
if [ -n "$QAREF" ]; then $AB click @$QAREF >/dev/null 2>&1; echo "clicked Q&A @$QAREF"; else $AB find role button click --name "Q&A" 2>&1 | head -1; fi
sleep 2
$AB snapshot | rg -i "Halo Admin|Tanya apa saja|Brand aktif" | head -3
$AB screenshot analysis/v2-screens/20-qa-home.png >/dev/null

echo "=== Q2 suggested prompt answer ==="
ensure_page
$AB find role button click --name "Brand aktif" >/dev/null 2>&1 && echo "prompt clicked"
sleep 3
$AB screenshot analysis/v2-screens/21-qa-brands.png >/dev/null
$AB snapshot | rg -i "Daftar brand|ADIDAS|AIRWALK|30 baris|BARIS" | head -5

echo "=== Q3 typed question ==="
ensure_page
INREF=$($AB snapshot -i | rg -o 'textbox "[^"]*" \[ref=(e[0-9]+)\]' -r '$1' | head -1)
echo "input ref: $INREF"
if [ -n "$INREF" ]; then
  $AB fill @$INREF "rule MANUAL brand adidas" >/dev/null 2>&1
  $AB press Enter >/dev/null 2>&1
  sleep 3
  $AB screenshot analysis/v2-screens/22-qa-rules.png >/dev/null
  $AB snapshot | rg -i "MANUAL|rule|baris" | head -6
fi

echo "=== Q4 chips + sources ==="
ensure_page
$AB snapshot | rg -i "Buka halaman|Data Master →" | head -4

echo "=== Q5 RNA tab ==="
ensure_page
$AB find role button click --name "Data Master Brands · Rules · LOV · RNA" >/dev/null 2>&1; sleep 2
$AB snapshot -i | rg -o 'button "RNA" \[ref=(e[0-9]+)\]' | head -1
RNAREF=$($AB snapshot -i | rg -o 'button "RNA" \[ref=(e[0-9]+)\]' -r '$1' | head -1)
[ -n "$RNAREF" ] && $AB click @$RNAREF >/dev/null 2>&1
sleep 2
$AB snapshot | rg -i "baris RNA|INDONESIA" | head -4
$AB screenshot analysis/v2-screens/23-rna.png >/dev/null

echo "=== Q6 attribute dialog ==="
ensure_page
ATTREF=$($AB snapshot -i | rg -o 'button "Attributes" \[ref=(e[0-9]+)\]' -r '$1' | head -1)
[ -n "$ATTREF" ] && $AB click @$ATTREF >/dev/null 2>&1
sleep 2
$AB find role button click --name "Add attribute" >/dev/null 2>&1 && echo "dialog opened"
sleep 1
$AB screenshot analysis/v2-screens/24-attr-dialog.png >/dev/null
$AB snapshot | rg -i "Atribut baru|Attribute ID|AT_" | head -5
$AB press Escape >/dev/null 2>&1

echo "=== Q7 import dialog ==="
ensure_page
IMPREF=$($AB snapshot -i | rg -o 'button "Import" \[ref=(e[0-9]+)\]' -r '$1' | head -1)
[ -n "$IMPREF" ] && $AB click @$IMPREF >/dev/null 2>&1
sleep 1.5
$AB snapshot | rg -i "Bulk Import|Preview|Template CSV" | head -5
$AB screenshot analysis/v2-screens/25-import.png >/dev/null
$AB press Escape >/dev/null 2>&1

echo "=== Q8 docs navigation ==="
ensure_page
$AB find role button click --name "Documentation Guides & reference" >/dev/null 2>&1; sleep 2
$AB snapshot | rg -i "Documentation Center|Panduan Memulai" | head -3
$AB screenshot analysis/v2-screens/26-docs.png >/dev/null

echo "=== Q9 palette ==="
ensure_page
$AB press Control+k >/dev/null 2>&1; sleep 1
$AB snapshot -i | rg -i "Ketik perintah|Navigasi" | head -3
$AB screenshot analysis/v2-screens/27-palette.png >/dev/null
$AB press Escape >/dev/null 2>&1

echo "=== Q10 errors ==="
$AB errors 2>/dev/null | head -5
$AB close --all >/dev/null 2>&1
echo "=== PASS4 DONE ==="