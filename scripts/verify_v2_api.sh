#!/bin/bash
# STIBO Hub v2.0 — API verification suite (single server session).
set -u
cd /home/z/my-project
J="Content-Type: application/json"
C=/tmp/ck.txt
rm -f "$C"

# ensure server
if ! curl -s -o /dev/null --max-time 2 http://localhost:3000/api/health; then
  (bunx next dev -p 3000 >> dev.log 2>&1 &)
  for i in $(seq 1 40); do sleep 1; curl -s -o /dev/null --max-time 2 http://localhost:3000/api/health && break; done
fi
echo "=== server ready ==="

curl -s -c "$C" -X POST localhost:3000/api/auth/login -H "$J" -d '{"email":"admin@map.co.id","password":"Stibo@2026"}' | head -c 60; echo

py() { python3 -c "$1"; }

echo "=== T3 assistant intents ==="
while IFS= read -r q; do
  curl -s -b "$C" -X POST localhost:3000/api/assistant/ask -H "$J" -d "{\"question\":\"$q\"}" > /tmp/ask.json
  py "import json; d=json.load(open('/tmp/ask.json')); print(f\"{d.get('intent','ERR')} | table={'Y' if d.get('table') else 'N'} | chips={len(d.get('chips',[]))} | src={len(d.get('sources',[]))}\")" 2>/dev/null \
    || { echo -n "RAW: "; head -c 120 /tmp/ask.json; echo; }
done << 'QS'
apa itu IIEP
brand apa saja yang aktif di divisi SPORTS
detail AT_COLOR_CODE
rule MANUAL brand adidas
nilai LOV untuk SEASON
SBU untuk brand ELL di ID
upload terakhir saya
berapa send hari ini
ringkasan statistik
bantuan
QS

echo "=== T4 assistant history ==="
curl -s -b "$C" localhost:3000/api/assistant/history | py "import json; d=json.load(open('/tmp/h.json')) if False else None; d=json.load(sys.stdin); print('messages:', len(d['messages']))"

echo "=== T5 naming CRUD ==="
NEW=$(curl -s -b "$C" -X POST localhost:3000/api/naming -H "$J" -d '{"brand":"TST","inline":"Test","fileType":"RecapSample","trigger":"test","endpoint":"ARTICLE_PLANNING","comment":"v2 test"}')
echo "$NEW" | py "import json,sys; d=json.load(sys.stdin); print('created:', d.get('brand'), d.get('endpoint'))"
NID=$(echo "$NEW" | py "import json,sys; print(json.load(sys.stdin).get('id',''))")
curl -s -b "$C" -X PATCH localhost:3000/api/naming/$NID -H "$J" -d '{"endpoint":"EAN_UPDATE"}' | py "import json,sys; print('patched →', json.load(sys.stdin).get('endpoint'))"
curl -s -b "$C" -X DELETE localhost:3000/api/naming/$NID | head -c 40; echo

echo "=== T6 rna list ==="
curl -s -b "$C" "localhost:3000/api/rna?country=ID&pageSize=3" | py "import json,sys; d=json.load(sys.stdin); print('total:', d['total'], '| countries:', len(d['countries']))"

echo "=== T7 lov CRUD ==="
curl -s -b "$C" -X POST localhost:3000/api/lov -H "$J" -d '{"key":"TEST_V2","sheetName":"Test V2"}' | py "import json,sys; print('table:', json.load(sys.stdin).get('key'))"
curl -s -b "$C" -X POST localhost:3000/api/lov/TEST_V2/values -H "$J" -d '{"code":"T1","label":"Test One"}' | py "import json,sys; print('value:', json.load(sys.stdin).get('code'))"
VID=$(curl -s -b "$C" "localhost:3000/api/lov/TEST_V2?pageSize=5" | py "import json,sys; d=json.load(sys.stdin); print(d['items'][0]['id'])")
curl -s -b "$C" -X PATCH localhost:3000/api/lov/values/$VID -H "$J" -d '{"label":"Test One Edited"}' | py "import json,sys; print('patched label:', json.load(sys.stdin).get('label'))"
curl -s -b "$C" -X DELETE localhost:3000/api/lov/TEST_V2 | head -c 60; echo

echo "=== T8 attribute CRUD ==="
NEWA=$(curl -s -b "$C" -X POST localhost:3000/api/attributes -H "$J" -d '{"code":"AT_TEST_V2","name":"Test V2 Attr","validation":"text","description":"v2 verification"}')
echo "$NEWA" | py "import json,sys; print('created:', json.load(sys.stdin).get('code'))"
AID=$(echo "$NEWA" | py "import json,sys; print(json.load(sys.stdin).get('id',''))")
curl -s -b "$C" -X PATCH localhost:3000/api/attributes/$AID -H "$J" -d '{"description":"edited"}' | py "import json,sys; print('patched:', json.load(sys.stdin).get('description'))"
curl -s -b "$C" -X DELETE localhost:3000/api/attributes/$AID | head -c 40; echo

echo "=== T9 rules CRUD ==="
NEWR=$(curl -s -b "$C" -X POST localhost:3000/api/rules -H "$J" -d '{"brandSheet":"testv2","brandCode":"TV2","attributeId":"AT_TEST_V2","attribute":"Test V2","mappingType":"DIRECT","sourceField":"colTest"}')
echo "$NEWR" | py "import json,sys; print('rule:', json.load(sys.stdin).get('brandCode'), json.load(sys.stdin).get('mappingType'))"
RID=$(echo "$NEWR" | py "import json,sys; print(json.load(sys.stdin).get('id',''))")
curl -s -b "$C" -X PATCH localhost:3000/api/rules/$RID -H "$J" -d '{"active":false}' | py "import json,sys; print('deactivated:', json.load(sys.stdin).get('active'))"
curl -s -b "$C" -X DELETE localhost:3000/api/rules/$RID | head -c 40; echo

echo "=== T10 import preview + apply (brands) ==="
CSV='code,name,division,status
TV2A,Test Brand A,SPORTS,ACTIVE
TV2B,Test Brand B,FASHION,ACTIVE
BAD,,SPORTS,ACTIVE'
echo "$CSV" > /tmp/imp.csv
python3 - << 'PYEOF'
import json, urllib.request
csv = open('/tmp/imp.csv').read()
def call(mode):
    req = urllib.request.Request('http://localhost:3000/api/import/brands',
        data=json.dumps({"csv": csv, "mode": mode, "upsert": True}).encode(),
        headers={"Content-Type": "application/json", "Cookie": open('/tmp/ck.txt').read().split('\n')[-2].split()[-1] and 'stibo_session=' + [l.split('\t')[-1] for l in open('/tmp/ck.txt') if 'stibo_session' in l][0].strip()})
    try:
        with urllib.request.urlopen(req) as r: return json.load(r)
    except urllib.error.HTTPError as e: return json.load(e)
p = call('preview')
print('preview: total', p['total'], '| valid', p['validCount'], '| failed', p['failedCount'], '| errors:', [e['error'][:30] for e in p['errors']])
a = call('apply')
print('apply: applied', a.get('applied'), '| updated', a.get('updated'), '| failed', a.get('failedCount'))
PYEOF

echo "=== T11 import template ==="
curl -s -b "$C" localhost:3000/api/import/rules | head -2

echo "=== T12 cleanup test brands ==="
for code in TV2A TV2B; do
  BID=$(curl -s -b "$C" "localhost:3000/api/brands?q=$code" | py "import json,sys; d=json.load(sys.stdin); items=[b for b in d if b['code']=='$code']; print(items[0]['id'] if items else '')")
  [ -n "$BID" ] && curl -s -b "$C" -X DELETE localhost:3000/api/brands/$BID | head -c 30 && echo " ($code removed)"
done

echo "=== T13 role guard (viewer cannot edit) ==="
C2=/tmp/ck2.txt; rm -f $C2
curl -s -c $C2 -X POST localhost:3000/api/auth/login -H "$J" -d '{"email":"viewer@map.co.id","password":"Stibo@2026"}' -o /dev/null
curl -s -b $C2 -X POST localhost:3000/api/attributes -H "$J" -d '{"code":"AT_NOPE","name":"Nope"}' | head -c 60; echo

echo "=== T14 audit log entries ==="
curl -s -b "$C" "localhost:3000/api/audit?pageSize=8" | py "import json,sys; d=json.load(sys.stdin); [print(' •', a['action'], '→', a['target'][:40]) for a in d['items'][:8]]"

echo "=== ALL API TESTS DONE ==="
