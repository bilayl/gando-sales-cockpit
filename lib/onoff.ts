import { getSupabaseAdmin } from "@/lib/supabase-admin";

const ONOFF_API_BASE = "https://public-apigateway.onoffapp.net/api/v1";

type OnoffApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

export type OnoffDirectApiStatus = {
  configured: boolean;
  connected: boolean | null;
  source: "onoff_api";
  latestCallId: string | null;
  latestEventName: string | null;
  latestReceivedAt: string | null;
  latestProcessingStatus: string | null;
  webhookAuthenticated: boolean;
  checkedAt: string;
  error: string | null;
};

async function getOnoffApiKey() {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("get_onoff_api_key");
  if (error) throw new Error(`Impossible de lire la clé Onoff: ${error.message}`);
  return typeof data === "string" ? data.trim() : "";
}

export async function onoffRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiKey = await getOnoffApiKey();
  if (!apiKey) throw new Error("Clé API Onoff non configurée.");

  const response = await fetch(`${ONOFF_API_BASE}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "X-API-Key": apiKey,
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const body = payload as OnoffApiErrorBody | null;
    const message = body?.error?.message || `Onoff API HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

export async function getOnoffCallMetadata(callId: string) {
  if (!callId.trim()) throw new Error("Call ID Onoff manquant.");
  return onoffRequest<Record<string, unknown>>(`/calls/${encodeURIComponent(callId.trim())}/logs`);
}

export async function getOnoffDirectApiStatus(): Promise<OnoffDirectApiStatus> {
  const admin = getSupabaseAdmin();
  const [keyResult, latestResult] = await Promise.all([
    admin.rpc("get_onoff_api_key"),
    admin
      .from("onoff_call_processing")
      .select("call_id,event_name,created_at,processing_status,onoff_user")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const apiKey = typeof keyResult.data === "string" ? keyResult.data.trim() : "";
  const latest = latestResult.data as {
    call_id?: string | null;
    event_name?: string | null;
    created_at?: string | null;
    processing_status?: string | null;
    onoff_user?: { webhookAuthenticated?: boolean } | null;
  } | null;

  const base: OnoffDirectApiStatus = {
    configured: Boolean(apiKey),
    connected: null,
    source: "onoff_api",
    latestCallId: latest?.call_id || null,
    latestEventName: latest?.event_name || null,
    latestReceivedAt: latest?.created_at || null,
    latestProcessingStatus: latest?.processing_status || null,
    webhookAuthenticated: Boolean(latest?.onoff_user?.webhookAuthenticated),
    checkedAt: new Date().toISOString(),
    error: keyResult.error?.message || latestResult.error?.message || null,
  };

  if (!apiKey) return { ...base, connected: false, error: base.error || "Clé API Onoff non configurée." };
  if (!latest?.call_id) return base;

  try {
    await getOnoffCallMetadata(latest.call_id);
    return { ...base, connected: true, error: null };
  } catch (error) {
    return {
      ...base,
      connected: false,
      error: error instanceof Error ? error.message : "Impossible de joindre l’API Onoff.",
    };
  }
}
