/**
 * AI vision-table extraction providers for the Map Portal.
 *
 * Two interchangeable backends, tried in a configurable order:
 *   • AWS Bedrock  (default)  — Nova Lite / Llama 4 Scout / Pixtral Large
 *     via the Converse API; authenticates with the EC2 instance role in
 *     production (no static keys) and ~/.aws or env vars locally.
 *   • Z-AI SDK (fallback)     — glm-4.5v, used when Bedrock is disabled
 *     (AI_PROVIDER=zai) or fails and Z-AI credentials exist.
 *
 * Both backends return raw model output that is parsed by the same
 * `safeParseTable` so JSON-shape rules stay identical across providers.
 */

const MAX_EXTRACTED_ROWS = 200;

export const SYSTEM_PROMPT = `You are a precise data-extraction engine for a retail master-data portal.
The user uploads a photo/screenshot of a product list, price list, line sheet or table.
Extract EVERY row of tabular data you can see into JSON.

Rules:
- Respond with VALID JSON only — no markdown fences, no commentary.
- Shape: {"headers": ["Col A", "Col B", ...], "rows": [["v1","v2",...], ...]}
- headers: the column titles; if the image has no header row, invent short ones (e.g. "Style Code", "Color", "Size", "Price").
- rows: all data rows, cell values as plain strings (numbers included), preserving order.
- Never merge or invent extra rows; skip decorative text, logos and page headers/footers.
- If the image contains no table at all, respond {"headers": [], "rows": []}.`;

export const USER_PROMPT = "Extract the table from this image as JSON.";

export interface ExtractedTable {
  headers: string[];
  rows: string[][];
}

export function safeParseTable(raw: string): ExtractedTable {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  const parsed = JSON.parse(text) as { headers?: unknown; rows?: unknown };
  const headers = Array.isArray(parsed.headers)
    ? parsed.headers.map((h) => String(h ?? "").trim()).filter(Boolean).slice(0, 40)
    : [];
  const rows = Array.isArray(parsed.rows)
    ? parsed.rows
        .slice(0, MAX_EXTRACTED_ROWS)
        .map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? "").trim()) : []))
        .filter((r) => r.some((c) => c !== ""))
    : [];
  return { headers, rows };
}

/* ────────────────────────── AWS Bedrock ────────────────────────── */

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";

const DEFAULT_CHAIN = [
  "us.amazon.nova-lite-v1:0",
  "us.meta.llama4-scout-17b-instruct-v1:0",
  "us.mistral.pixtral-large-2502-v1:0",
];

function modelChain(): string[] {
  const override = process.env.BEDROCK_MODEL?.trim();
  return override ? [override] : DEFAULT_CHAIN;
}

function imageFormat(mime: string): "png" | "jpeg" | "gif" | "webp" {
  if (/png/i.test(mime)) return "png";
  if (/webp/i.test(mime)) return "webp";
  if (/gif/i.test(mime)) return "gif";
  return "jpeg";
}

/** True when Bedrock should be the primary provider (default). */
export function bedrockEnabled(): boolean {
  return (process.env.AI_PROVIDER || "bedrock") === "bedrock";
}

export interface ProviderResult {
  raw: string;
  model: string;
  provider: "bedrock" | "zai";
}

/** Extract raw table JSON via Bedrock Converse with a model fallback chain. */
export async function bedrockExtract(
  imageBytes: Buffer,
  mime: string,
): Promise<ProviderResult> {
  const { BedrockRuntimeClient, ConverseCommand } = await import("@aws-sdk/client-bedrock-runtime");
  const client = new BedrockRuntimeClient({ region: REGION });

  const errors: string[] = [];
  for (const model of modelChain()) {
    try {
      const res = await client.send(
        new ConverseCommand({
          modelId: model,
          system: [{ text: SYSTEM_PROMPT }],
          messages: [
            {
              role: "user",
              content: [
                { image: { format: imageFormat(mime), source: { bytes: imageBytes } } },
                { text: USER_PROMPT },
              ],
            },
          ],
          inferenceConfig: { maxTokens: 4096, temperature: 0 },
        }),
      );
      const raw =
        res.output?.message?.content
          ?.map((c) => ("text" in c ? (c.text ?? "") : ""))
          .join("\n") ?? "";
      if (!raw.trim()) throw new Error("empty model output");
      return { raw, model, provider: "bedrock" };
    } catch (e) {
      errors.push(`${model}: ${(e as Error).message}`);
    }
  }
  throw new Error(`All Bedrock models failed — ${errors.join(" | ")}`);
}

/* ─────────────────────────── Z-AI SDK ─────────────────────────── */

export async function zaiExtract(imageBytes: Buffer, mime: string): Promise<ProviderResult> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const dataUrl = `data:${mime};base64,${
    Buffer.from(imageBytes).toString("base64")
  }`;
  const zai = await ZAI.create();
  const completion = (await zai.chat.completions.createVision({
    model: "glm-4.5v",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: USER_PROMPT },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    thinking: { type: "disabled" },
  })) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = completion.choices?.[0]?.message?.content ?? "";
  if (!raw.trim()) throw new Error("empty model output");
  return { raw, model: "glm-4.5v", provider: "zai" };
}
