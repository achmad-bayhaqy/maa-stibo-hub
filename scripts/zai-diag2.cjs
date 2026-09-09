const fs = require("fs");
const cfg = JSON.parse(fs.readFileSync("/app/.z-ai-config", "utf8"));
// Try the public Z.AI open-platform endpoint with the same key (1x1 png vision call)
const body = JSON.stringify({
  model: "glm-4.5v",
  messages: [{ role: "user", content: [{ type: "text", text: "ping" }] }],
  thinking: { type: "disabled" },
});
const tries = [
  ["https://api.z.ai/api/paas/v4", "/chat/completions"],
];
(async () => {
  for (const [base, path] of tries) {
    try {
      const r = await fetch(base + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
        body,
        signal: AbortSignal.timeout(20000),
      });
      const txt = (await r.text()).slice(0, 200);
      console.log(`${base} -> HTTP ${r.status}: ${txt.replace(cfg.apiKey, "***")}`);
    } catch (e) {
      console.log(`${base} -> FAILED: ${e.message}${e.cause ? " / " + String(e.cause).slice(0, 100) : ""}`);
    }
  }
})();
