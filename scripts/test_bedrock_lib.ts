/* Quick E2E test of the Bedrock extraction lib (bun scripts/test_bedrock_lib.ts) */
import { bedrockExtract, safeParseTable, bedrockEnabled } from "../src/lib/bedrock";
import { readFileSync } from "fs";

async function main() {
  console.log("bedrockEnabled:", bedrockEnabled());
  const img = readFileSync("/tmp/stibo-test-table.png");
  const t0 = Date.now();
  const res = await bedrockExtract(img, "image/png");
  const table = safeParseTable(res.raw);
  console.log(`provider=${res.provider} model=${res.model} in ${Date.now() - t0}ms`);
  console.log("headers:", table.headers);
  console.log("rows:", table.rows);
  if (table.headers.length < 2 || table.rows.length === 0) {
    throw new Error("EMPTY TABLE — test failed");
  }
  console.log("BEDROCK LIB TEST PASS");
}
main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
