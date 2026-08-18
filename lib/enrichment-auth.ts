const DEFAULT_ENRICHMENT_BACKEND_URL = "https://gando-enrichment-backend-lenrigandoyt-9842s-projects.vercel.app";

export function enrichmentBackendUrl() {
  return (process.env.ENRICHMENT_BACKEND_URL || process.env.GANDO_ENRICHMENT_BACKEND_URL || DEFAULT_ENRICHMENT_BACKEND_URL).replace(/\/$/, "");
}

export function enrichmentAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const apiKey = process.env.ENRICHMENT_INTERNAL_API_KEY || process.env.GANDO_ENRICHMENT_API_KEY || process.env.INTERNAL_API_KEY || "";
  const oidc = process.env.VERCEL_OIDC_TOKEN || "";

  if (apiKey) headers["x-gando-api-key"] = apiKey;
  if (oidc) {
    headers["x-gando-vercel-oidc"] = oidc;
    // Also lets Vercel validate the calling deployment if the backend has Deployment Protection enabled.
    headers["x-vercel-trusted-oidc-idp-token"] = oidc;
  }
  return headers;
}

export function hasEnrichmentAuth() {
  return Object.keys(enrichmentAuthHeaders()).length > 0;
}
