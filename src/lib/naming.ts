/**
 * Filename parser — implements MAP naming convention
 * Format: {compCode}-{sbu}-{BRAND}-{FileType}-{Gender}-{Season}-{Country}-{seq}.xlsx
 * e.g. 0888-SP-ELLESSE-Recap Sample MAA Sport Licensed-Multi-SP2027-ID-1.xlsx
 *
 * Routing mirrors lambda `map-stibo-inbound-send-to-step` FILENAME_ROUTING_RULES.
 */

export interface ParsedFilename {
  compCode: string;
  sbu: string;
  brandSlug: string;
  flow: string;
  gender: string;
  season: string;
  country: string;
  seq: string;
  valid: boolean;
  endpoint: string;
  issues: string[];
}

const FILE_TYPE_KEYWORDS: Array<[RegExp, string]> = [
  [/recap\s*sample|licensed recap|sample development/i, "Recap Sample"],
  [/recap.*2nd|2nd.*ingestion/i, "Recap Sample 2nd Ingestion"],
  [/line\s*list|linelist|linesheet|line sheet|product bible|otb/i, "Line List"],
  [/price\s*list|retail price/i, "Price List"],
  [/backlog|ean\s*source|ean\s*code|order\s*sheet|order\s*form|order\s*confirmation|packing|packaging|shipment|oor|fob\s*order/i, "EAN Source"],
  [/tdd|dtb|ecommerce|ecom file/i, "Ecommerce File"],
];

const ENDPOINT_ROUTING: Array<[RegExp, string]> = [
  [/line\s*list|linelist|recap|price\s*list|linesheet|product bible|otb|order form|retail price/i, "ARTICLE_PLANNING"],
  [/backlog|ean\s*source|ean\s*code|order\s*sheet|order\s*form|order\s*confirmation|packing|packaging|shipment|oor|fob/i, "EAN_UPDATE"],
  [/tdd|dtb|ecommerce|ecom/i, "ARTICLE_MAINTENANCE"],
];

const SBU_MAP: Record<string, string> = {
  SP: "SPORTS (SP)",
  FQ: "FASHION & QUALITY (FQ)",
};

export function routeEndpoint(filename: string): string {
  const bare = filename.replace(/\.(xlsx|xlsm|xlsb|xls|csv)$/i, "");
  for (const [re, ep] of ENDPOINT_ROUTING) {
    if (re.test(bare)) return ep;
  }
  return "ARTICLE_PLANNING";
}

export function detectFileType(filename: string): string {
  const bare = filename.replace(/\.(xlsx|xlsm|xlsb|xls|csv)$/i, "");
  for (const [re, label] of FILE_TYPE_KEYWORDS) {
    if (re.test(bare)) return label;
  }
  return "Unknown";
}

export function parseFilename(filename: string): ParsedFilename {
  const issues: string[] = [];
  const bare = filename.replace(/\.(xlsx|xlsm|xlsb|xls|csv)$/i, "");
  const parts = bare.split("-").map((p) => p.trim());

  const result: ParsedFilename = {
    compCode: "", sbu: "", brandSlug: "", flow: "", gender: "",
    season: "", country: "", seq: "", valid: false,
    endpoint: routeEndpoint(filename), issues,
  };

  result.flow = detectFileType(filename);

  // Strict parse when 8+ dash-separated segments
  if (parts.length >= 8) {
    result.compCode = parts[0];
    result.sbu = parts[1];
    result.brandSlug = parts[2];
    result.gender = parts[4];
    result.country = parts[6];
    result.seq = parts[7];
    // season token like SP2027 / FW26
    const seasonIdx = parts.slice(5).findIndex((p) => /^[A-Za-z]{2}\d{2,4}$/.test(p));
    if (seasonIdx >= 0) result.season = parts[5 + seasonIdx];
  }

  if (!/^\d{4}$/.test(result.compCode)) issues.push("Company code should be 4 digits (e.g. 0888)");
  if (result.compCode && result.compCode !== "0888") issues.push("Unexpected company code — expected 0888 (PT. MAP Aktif Adiperkasa)");
  if (result.sbu && !SBU_MAP[result.sbu.toUpperCase()]) issues.push(`Unknown SBU "${result.sbu}" (expected SP or FQ)`);
  if (!result.brandSlug) issues.push("Brand segment not found in filename");
  if (result.flow === "Unknown") issues.push("File type not recognized — check naming convention");
  if (!/^[A-Z]{2}\d{2,4}$/.test(result.season)) issues.push("Season segment invalid (expected e.g. SP2027, FW26)");
  if (!/^[A-Z]{2}$/.test(result.country)) issues.push("Country segment invalid (expected 2-letter ISO code e.g. ID)");

  result.valid = issues.length === 0;
  return result;
}

export const SEASON_HINTS: Record<string, string> = {
  SP: "Spring (Jan–Jun delivery)",
  SS: "Spring/Summer",
  FW: "Fall/Winter (Jul–Dec delivery)",
  AW: "Autumn/Winter",
  FA: "Fall",
  H1: "First Half",
  H2: "Second Half",
};
