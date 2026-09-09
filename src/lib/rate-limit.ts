/**
 * Minimal in-memory sliding-window rate limiter for sensitive endpoints.
 * Single-instance deployments only (current topology: one app container).
 * Keyed by `<scope>:<identity>` — identity is email or client IP.
 *
 * Semantics: `rateLimited()` is a pure check; `record()` appends an event.
 * Only record on FAILED attempts so successful logins never consume quota.
 */
const buckets = new Map<string, number[]>();

const MAX_EVENTS = Number(process.env.RATE_LIMIT_MAX || 5);
const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);

function prune(now: number, ts: number[]): number[] {
  return ts.filter((t) => now - t < WINDOW_MS);
}

/** Pure check — true when identity already exceeded the allowed events. */
export function rateLimited(scope: string, identity: string): boolean {
  const key = `${scope}:${identity.toLowerCase()}`;
  const now = Date.now();
  const hits = prune(now, buckets.get(key) ?? []);
  buckets.set(key, hits);
  return hits.length >= MAX_EVENTS;
}

/** Append one event to the sliding window. */
export function record(scope: string, identity: string): void {
  const key = `${scope}:${identity.toLowerCase()}`;
  const now = Date.now();
  const hits = prune(now, buckets.get(key) ?? []);
  hits.push(now);
  buckets.set(key, hits);
  // opportunistic GC to keep the map small
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.length === 0 || v.every((t) => now - t >= WINDOW_MS)) buckets.delete(k);
    }
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : "") || "unknown";
}
