import { getVercelOidcToken } from "@vercel/oidc";

// Use the production alias, not the long auto-generated deployment URL.
// Vercel Standard Deployment Protection protects the generated deployment URL
// while leaving the production domain reachable. The backend still enforces
// its own x-gando-api-key / OIDC authentication at the application layer.
const DEFAULT_ENRICHMENT_BACKEND_URL = "https://gando-enrichment-backend.vercel.app";

export function enrichmentBackendUrl() {
  return (process.env.ENRICHMENT_BACKEND_URL || process.env.GANDO_ENRICHMENT_BACKEND_URL || DEFAULT_ENRICHMENT_BACKEND_URL).replace(/\/$/, "");
}

export async function enrichmentAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  const apiKey = process.env.ENRICHMENT_INTERNAL_API_KEY || process.env.GANDO_ENRICHMENT_API_KEY || process.env.INTERNAL_API_KEY || "";
  const protectionBypass =
    process.env.ENRICHMENT_VERCEL_BYPASS_SECRET ||
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET ||
    "";

  if (apiKey) headers["x-gando-api-key"] = apiKey;
  if (protectionBypass) headers["x-vercel-protection-bypass"] = protectionBypass;

  try {
    const oidc = await getVercelOidcToken();
    if (oidc) {
      headers["x-gando-vercel-oidc"] = oidc;
      headers["x-vercel-trusted-oidc-idp-token"] = oidc;
    }
  } catch (error) {
    if (!apiKey) {
      console.error("Unable to resolve Vercel OIDC token for enrichment:", error);
    }
  }

  return headers;
}

export async function hasEnrichmentAuth() {
  return Object.keys(await enrichmentAuthHeaders()).length > 0;
}
