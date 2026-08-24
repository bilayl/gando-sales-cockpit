import { hubspotJson } from "@/lib/hubspot";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const HUBSPOT_API = "https://api.hubapi.com";

/**
 * Reads HubSpot through the normal auth stack first. Password-authenticated
 * cockpit users may not have an individual HubSpot OAuth cookie, so if the
 * standard stack reports UNAUTHORIZED we fall back to the server-side token
 * already maintained in Supabase.
 */
export async function hubspotJsonWithServiceFallback(path: string, init: RequestInit = {}) {
  try {
    return await hubspotJson(path, init);
  } catch (error) {
    const cause = error as Error & { status?: number; details?: unknown };
    if (cause.message !== "UNAUTHORIZED") throw error;

    const admin = getSupabaseAdmin();
    const { data, error: tokenError } = await admin.rpc("get_hubspot_access_token");
    if (tokenError) throw cause;

    const token = typeof data === "string" ? data.trim() : "";
    if (!token) throw cause;

    const response = await fetch(`${HUBSPOT_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const fallbackError = new Error(payload?.message || `HubSpot API ${response.status}`) as Error & { status?: number; details?: unknown };
      fallbackError.status = response.status;
      fallbackError.details = payload;
      throw fallbackError;
    }

    return payload;
  }
}
