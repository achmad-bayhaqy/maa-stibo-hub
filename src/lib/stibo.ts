/**
 * Stibo STEP IIEP client — mirrors lambda `map-stibo-inbound-send-to-step` v2.3:
 * OIDC client_credentials token (cached) → POST binary XML to
 * `{IIEP_URL}?fileName=...&context=Context1&workspace=Main` with
 * Content-Type: application/octet-stream. Retries 3x exponential backoff.
 * MOCK mode simulates the whole flow for safe demos.
 */

export type Endpoint = "ARTICLE_PLANNING" | "EAN_UPDATE" | "ARTICLE_MAINTENANCE";

export interface SendResult {
  mode: "MOCK" | "LIVE";
  endpoint: Endpoint;
  url: string;
  fileName: string;
  bgId: string;
  httpStatus: number;
  responseSnippet: string;
  durationMs: number;
  ok: boolean;
  error?: string;
}

const ENDPOINT_ENV: Record<Endpoint, string> = {
  ARTICLE_PLANNING: "STIBO_INBOUND_URL_ARTICLE_PLANNING",
  EAN_UPDATE: "STIBO_INBOUND_URL_EAN_UPDATE",
  ARTICLE_MAINTENANCE: "STIBO_INBOUND_URL_ARTICLE_MAINTENANCE",
};

let tokenCache: { token: string; exp: number } | null = null;

export function isLiveConfigured(): boolean {
  return Boolean(
    process.env.STIBO_TOKEN_URL &&
    process.env.STIBO_CLIENT_ID &&
    process.env.STIBO_CLIENT_SECRET &&
    Object.values(ENDPOINT_ENV).every((k) => process.env[k])
  );
}

async function getOidcToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.exp > now + 30_000) return tokenCache.token;
  const res = await fetch(process.env.STIBO_TOKEN_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: process.env.STIBO_GRANT_TYPE || "client_credentials",
      client_id: process.env.STIBO_CLIENT_ID!,
      client_secret: process.env.STIBO_CLIENT_SECRET!,
    }),
  });
  if (!res.ok) throw new Error(`OIDC token request failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: data.access_token, exp: now + (data.expires_in - 30) * 1000 };
  return data.access_token;
}

async function postXml(url: string, token: string, xml: string, fileName: string, retries = 3): Promise<{ status: number; body: string }> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const target = `${url}?fileName=${encodeURIComponent(fileName)}&context=Context1&workspace=Main`;
      const res = await fetch(target, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
          "Content-Length": String(Buffer.byteLength(xml, "utf-8")),
        },
        body: Buffer.from(xml, "utf-8"),
      });
      const body = (await res.text()).slice(0, 500);
      if (res.status >= 500 && attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempt)));
        continue;
      }
      return { status: res.status, body };
    } catch (e) {
      lastErr = e as Error;
      if (attempt < retries - 1) await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempt)));
    }
  }
  throw lastErr ?? new Error("POST failed");
}

export async function sendToStibo(
  xml: string,
  fileName: string,
  endpoint: Endpoint,
  mode: "MOCK" | "LIVE"
): Promise<SendResult> {
  const t0 = Date.now();
  const envUrl = process.env[ENDPOINT_ENV[endpoint]] || "";
  const url = envUrl || `https://<stibo-iiep-${endpoint.toLowerCase()}>/upload-direct`;

  if (mode === "MOCK" || !isLiveConfigured()) {
    // simulated bgId receipt like the Lambda saves to processed/stepxml/bgid/
    const bgId = `MOCK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await new Promise((r) => setTimeout(r, 700));
    return {
      mode: "MOCK", endpoint, url, fileName, bgId, httpStatus: 200,
      responseSnippet: `[SIMULATED] IIEP accepted inbound XML (${(xml.length / 1024).toFixed(1)} KB). bgId receipt generated locally — no data sent to Stibo.`,
      durationMs: Date.now() - t0, ok: true,
    };
  }

  try {
    const token = await getOidcToken();
    const { status, body } = await postXml(envUrl, token, xml, fileName);
    const bgMatch = body.match(/bgId["=:]\s*"?([\w-]+)/i);
    return {
      mode: "LIVE", endpoint, url, fileName,
      bgId: bgMatch?.[1] || "",
      httpStatus: status, responseSnippet: body,
      durationMs: Date.now() - t0, ok: status >= 200 && status < 300,
    };
  } catch (e) {
    return {
      mode: "LIVE", endpoint, url, fileName, bgId: "", httpStatus: 0,
      responseSnippet: "", durationMs: Date.now() - t0, ok: false,
      error: (e as Error).message,
    };
  }
}
