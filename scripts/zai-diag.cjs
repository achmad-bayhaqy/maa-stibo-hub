const fs = require("fs");
try {
  const raw = fs.readFileSync("/app/.z-ai-config", "utf8").trim();
  const c = JSON.parse(raw);
  console.log("config keys:", Object.keys(c).join(","));
  const url = c.baseUrl || c.baseURL || c.endpoint || c.api_base || "";
  console.log("baseUrl host:", url ? new URL(url).host : "(none found)");
  const target = url || "https://api.z.ai";
  fetch(target, { method: "GET" })
    .then((r) => console.log("reach:", new URL(target).host, "HTTP", r.status))
    .catch((e) => console.log("reach FAILED:", new URL(target).host, "-", e.message, e.cause ? String(e.cause).slice(0, 120) : ""));
} catch (e) {
  console.log("diag error:", e.message);
}
