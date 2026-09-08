#!/usr/bin/env python3
"""Generate src/lib/template-columns.ts from extracted Template sheet attributes."""
import json

attrs = json.load(open("/home/z/my-project/scripts/template_attrs.json"))

# Dedupe by attribute id keep first occurrence; keep #N/A ids out of mapped preview
# but still list them (they exist in the template with name only).
lines = []
seen = set()
out = []
for a in attrs:
    name = a["name"]
    if not name:
        continue
    key = (a["id"], name)
    if key in seen:
        continue
    seen.add(key)
    aid = a["id"] if a["id"] not in ("", "#N/A") else ""
    validation = a["validation"] if a["validation"] not in ("", "#N/A") else "text"
    cluster = a["cluster"] or "Other"
    out.append({"name": name, "id": aid, "validation": validation, "cluster": cluster})

body = ",\n".join(
    f'  {{ name: {json.dumps(o["name"])}, id: {json.dumps(o["id"])}, validation: {json.dumps(o["validation"].lower())}, cluster: {json.dumps(o["cluster"])} }}'
    for o in out
)

ts = f'''/**
 * Full column contract of "NEW - Brand mapping files Template.xlsx" (Template sheet).
 * {len(out)} attributes in template order, grouped by cluster. Every transformed
 * sample row shown in the portal carries ALL of these columns — columns the
 * mapping engine could not fill stay empty so reviewers see the complete
 * Stibo attribute assignment at a glance.
 */

export interface TemplateColumn {{
  /** Human attribute name, e.g. "Country" */
  name: string;
  /** Stibo attribute id, e.g. "AT_Country" — empty when #N/A in template */
  id: string;
  /** validation type: lov | text | number | regexp | date | legacyisodatetime */
  validation: string;
  /** template cluster: Basic | Commercial | Price | Cost | MC | Hierarchy | Online | Image (Online) | ... */
  cluster: string;
}}

export const TEMPLATE_COLUMNS: TemplateColumn[] = [
{body},
];

/** Unique clusters in template order (for grouped table headers). */
export const TEMPLATE_CLUSTERS: string[] = Array.from(
  new Set(TEMPLATE_COLUMNS.map((c) => c.cluster))
);

/** id -> column index for fast row assembly. */
export const TEMPLATE_INDEX: Record<string, number> = TEMPLATE_COLUMNS.reduce(
  (acc, c, i) => {{
    if (c.id) acc[c.id] = i;
    return acc;
  }},
  {{}} as Record<string, number>
);

/** Expand a sparse mapped row {{AT_X: v}} into a dense array aligned to TEMPLATE_COLUMNS. */
export function denseRow(values: Record<string, string>): string[] {{
  const dense = TEMPLATE_COLUMNS.map(() => "");
  for (const [k, v] of Object.entries(values)) {{
    const idx = TEMPLATE_INDEX[k];
    if (idx !== undefined) dense[idx] = v ?? "";
  }}
  return dense;
}}
'''

with open("/home/z/my-project/src/lib/template-columns.ts", "w") as f:
    f.write(ts)
print(f"generated template-columns.ts with {len(out)} columns")
clusters = []
for o in out:
    if o["cluster"] not in clusters:
        clusters.append(o["cluster"])
print("clusters:", clusters)
