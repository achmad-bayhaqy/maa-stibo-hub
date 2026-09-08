/**
 * Server-only Stibo STEP credential resolution.
 *
 * Priority (secrets never leave the server / never reach the client bundle):
 *   1. Environment variables (works on EC2/ECS/Lambda with instance roles)
 *   2. AWS Secrets Manager (when STIBO_SECRET_ID is set) — secret JSON format:
 *      { "STIBO_CLIENT_ID": "...", "STIBO_CLIENT_SECRET": "...", ... }
 *
 * Recommended production setup: store one secret named `stibo/map-portal/iiep-credentials`
 * (or any name) in AWS Secrets Manager in us-east-1, tagged `stibo`, and reference it via
 * STIBO_SECRET_ID. The EC2/ECS task role only needs `secretsmanager:GetSecretValue`
 * on that secret ARN. Values here are cached in-process for 5 minutes.
 */

import "server-only";

export interface StiboConfig {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  grantType: string;
  endpoints: {
    ARTICLE_PLANNING: string;
    EAN_UPDATE: string;
    ARTICLE_MAINTENANCE: string;
  };
  source: "env" | "secrets-manager" | "none";
}

const REQUIRED_ENDPOINTS = ["ARTICLE_PLANNING", "EAN_UPDATE", "ARTICLE_MAINTENANCE"] as const;

let cache: { config: StiboConfig; exp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

function fromEnv(): StiboConfig | null {
  const tokenUrl = process.env.STIBO_TOKEN_URL || "";
  const clientId = process.env.STIBO_CLIENT_ID || "";
  const clientSecret = process.env.STIBO_CLIENT_SECRET || "";
  const endpoints = {
    ARTICLE_PLANNING: process.env.STIBO_INBOUND_URL_ARTICLE_PLANNING || "",
    EAN_UPDATE: process.env.STIBO_INBOUND_URL_EAN_UPDATE || "",
    ARTICLE_MAINTENANCE: process.env.STIBO_INBOUND_URL_ARTICLE_MAINTENANCE || "",
  };
  const complete = Boolean(tokenUrl && clientId && clientSecret && REQUIRED_ENDPOINTS.every((k) => endpoints[k]));
  if (!complete) return null;
  return {
    tokenUrl, clientId, clientSecret,
    grantType: process.env.STIBO_GRANT_TYPE || "client_credentials",
    endpoints, source: "env",
  };
}

async function fromSecretsManager(): Promise<StiboConfig | null> {
  const secretId = process.env.STIBO_SECRET_ID;
  if (!secretId) return null;
  // Dynamic import keeps the AWS SDK out of cold paths when env config is used.
  const { SecretsManagerClient, GetSecretValueCommand } = await import("@aws-sdk/client-secrets-manager");
  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1",
  });
  const res = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  if (!res.SecretString) return null;
  const raw = JSON.parse(res.SecretString) as Record<string, string>;
  const get = (...names: string[]) => {
    for (const n of names) {
      const v = raw[n];
      if (typeof v === "string" && v) return v;
    }
    return "";
  };
  const tokenUrl = get("STIBO_TOKEN_URL");
  const clientId = get("STIBO_CLIENT_ID");
  const clientSecret = get("STIBO_CLIENT_SECRET");
  const endpoints = {
    ARTICLE_PLANNING: get("STIBO_INBOUND_URL_ARTICLE_PLANNING", "STIBO_INBOUND_URL"),
    EAN_UPDATE: get("STIBO_INBOUND_URL_EAN_UPDATE"),
    ARTICLE_MAINTENANCE: get("STIBO_INBOUND_URL_ARTICLE_MAINTENANCE"),
  };
  const complete = Boolean(tokenUrl && clientId && clientSecret && REQUIRED_ENDPOINTS.every((k) => endpoints[k]));
  if (!complete) return null;
  return {
    tokenUrl, clientId, clientSecret,
    grantType: get("STIBO_GRANT_TYPE") || "client_credentials",
    endpoints, source: "secrets-manager",
  };
}

/** Resolve credentials (cached). Returns null when nothing is configured → MOCK mode. */
export async function getStiboConfig(): Promise<StiboConfig | null> {
  const now = Date.now();
  if (cache && cache.exp > now) return cache.config;

  let config = fromEnv();
  if (!config) {
    try {
      config = await fromSecretsManager();
    } catch (e) {
      console.error("[stibo-config] Secrets Manager lookup failed:", (e as Error).message);
      config = null;
    }
  }

  if (config) cache = { config, exp: now + CACHE_TTL_MS };
  return config;
}

/** Same as getStiboConfig but never throws and masks the secret for status display. */
export async function getStiboStatus(): Promise<{
  configured: boolean; source: StiboConfig["source"];
  clientIdMasked: string; tokenUrlHost: string;
  endpointsReady: string[];
}> {
  const cfg = await getStiboConfig();
  const mask = (s: string) => (s.length <= 4 ? "••••" : `${s.slice(0, 2)}${"•".repeat(Math.max(2, s.length - 4))}${s.slice(-2)}`);
  if (!cfg) {
    return {
      configured: false, source: "none", clientIdMasked: "",
      tokenUrlHost: "",
      endpointsReady: REQUIRED_ENDPOINTS.filter((k) => process.env[`STIBO_INBOUND_URL_${k}`]),
    };
  }
  return {
    configured: true, source: cfg.source,
    clientIdMasked: mask(cfg.clientId),
    tokenUrlHost: safeHost(cfg.tokenUrl),
    endpointsReady: REQUIRED_ENDPOINTS.filter((k) => cfg.endpoints[k]),
  };
}

function safeHost(url: string): string {
  try { return new URL(url).host; } catch { return ""; }
}
