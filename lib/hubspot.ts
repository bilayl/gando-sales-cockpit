import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { CompactEncrypt, compactDecrypt } from "jose";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { getVercelOidcToken } from "@vercel/oidc";
import { getSupabaseAdmin } from "./supabase-admin";

const HUBSPOT_API = "https://api.hubapi.com";
const HUBSPOT_AUTHORIZE = "https://app.hubspot.com/oauth/authorize";
const SESSION_COOKIE = "gando_hubspot_session";
const STATE_COOKIE = "gando_hubspot_state";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const DEFAULT_SUPABASE_URL = "https://hboentjvcxpqlyzlrebx.supabase.co";
const HUBSPOT_TOKEN_FUNCTION = "gando-hubspot-token";

const HUBSPOT_SCOPES = [
  "oauth",
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.objects.companies.read",
  "crm.objects.companies.write",
  "crm.schemas.companies.write",
  "crm.objects.deals.read",
  "crm.objects.deals.write",
  "crm.objects.owners.read",
  "crm.lists.read",
  "crm.lists.write",
].join(" ");

type HubSpotSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  hubId?: number;
  userId?: number;
  email?: string;
  hubDomain?: string;
  scopes?: string[];
};

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  hub_id?: number;
  scopes?: string[];
};

type TokenMetadata = {
  active?: boolean;
  hub_id?: number;
  user_id?: number;
  user?: string;
  hub_domain?: string;
  scopes?: string[];
};

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} manquant`);
  return value;
}

function resolveHubSpotRedirectUri(override?: string) {
  const value = override?.trim() || process.env.HUBSPOT_REDIRECT_URI?.trim();
  if (!value) throw new Error("HUBSPOT_REDIRECT_URI manquant");
  return value;
}

export function isProductionEnvironment() {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === "production";
  return process.env.NODE_ENV === "production";
}

export function isAuthBypassEnabled() {
  return !isProductionEnvironment();
}

function sessionKey() {
  return createHash("sha256").update(requireEnv("SESSION_SECRET")).digest();
}

async function encryptSession(session: HubSpotSession) {
  return new CompactEncrypt(new TextEncoder().encode(JSON.stringify(session)))
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(sessionKey());
}

async function decryptSession(value?: string): Promise<HubSpotSession | null> {
  if (!value || !process.env.SESSION_SECRET) return null;
  try {
    const { plaintext } = await compactDecrypt(value, sessionKey());
    const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as HubSpotSession;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function readSession() {
  return decryptSession((await cookies()).get(SESSION_COOKIE)?.value);
}

let lastAutomationCredentialSyncAt = 0;
let serviceTokenCache: { token: string; expiresAt: number } | null = null;

async function resolveVercelOidcToken() {
  try {
    const requestHeaders = await headers();
    const headerToken = requestHeaders.get("x-vercel-oidc-token")?.trim() || "";
    if (headerToken) return headerToken;
  } catch {
    // No active Next.js request context: fall through to helper/env fallback.
  }

  try {
    const helperToken = (await getVercelOidcToken())?.trim() || "";
    if (helperToken) return helperToken;
  } catch {
    // Ignore and try the build/runtime environment token below.
  }

  return process.env.VERCEL_OIDC_TOKEN?.trim() || "";
}

async function hubSpotTokenFromOidc() {
  if (!isProductionEnvironment()) return "";
  try {
    const oidc = await resolveVercelOidcToken();
    if (!oidc) {
      console.error("HubSpot OIDC fallback unavailable: Vercel OIDC token missing from request context");
      return "";
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/${HUBSPOT_TOKEN_FUNCTION}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${oidc}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error(`HubSpot OIDC token exchange failed: HTTP ${response.status}`);
      return "";
    }
    const data = await response.json().catch(() => ({}));
    return typeof data?.token === "string" ? data.token.trim() : "";
  } catch (error) {
    console.error("Unable to resolve HubSpot service token through Vercel OIDC", error);
    return "";
  }
}

async function hubSpotServiceToken() {
  const envToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN?.trim();
  if (envToken) return envToken;

  if (serviceTokenCache && serviceTokenCache.expiresAt > Date.now()) {
    return serviceTokenCache.token;
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc("get_server_secret", { p_name: "hubspot_access_token" });
    if (error) throw error;
    const token = typeof data === "string" ? data.trim() : "";
    if (token) {
      serviceTokenCache = { token, expiresAt: Date.now() + 5 * 60_000 };
      return token;
    }
  } catch {
    // Vercel may not have Supabase service-role credentials. Fall through to OIDC federation.
  }

  const oidcToken = await hubSpotTokenFromOidc();
  if (oidcToken) {
    serviceTokenCache = { token: oidcToken, expiresAt: Date.now() + 5 * 60_000 };
    return oidcToken;
  }
  return "";
}

async function syncHubSpotAutomationCredentials(session: HubSpotSession) {
  if (!isProductionEnvironment()) return;
  if (!session.accessToken || !session.refreshToken || !session.expiresAt) return;
  if (Date.now() - lastAutomationCredentialSyncAt < 60_000) return;

  const clientId = process.env.HUBSPOT_CLIENT_ID?.trim();
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return;

  const admin = getSupabaseAdmin();
  const { error } = await admin.rpc("sync_hubspot_automation_credentials", {
    p_access_token: session.accessToken,
    p_refresh_token: session.refreshToken,
    p_expires_at_ms: Math.trunc(session.expiresAt),
    p_client_id: clientId,
    p_client_secret: clientSecret,
  });
  if (error) throw error;
  lastAutomationCredentialSyncAt = Date.now();
}

async function writeSession(session: HubSpotSession) {
  (await cookies()).set(SESSION_COOKIE, await encryptSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    priority: "high",
  });

  syncHubSpotAutomationCredentials(session).catch((error) => {
    console.error("Unable to sync HubSpot automation credentials", error);
  });
}

async function tokenRequest(values: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(`${HUBSPOT_API}/oauth/2026-03/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      ...values,
      client_id: requireEnv("HUBSPOT_CLIENT_ID"),
      client_secret: requireEnv("HUBSPOT_CLIENT_SECRET"),
    }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || data?.error_description || data?.error || "Échec OAuth HubSpot");
  return data as TokenResponse;
}

async function introspectAccessToken(token: string): Promise<TokenMetadata> {
  const response = await fetch(`${HUBSPOT_API}/oauth/2026-03/token/introspect`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv("HUBSPOT_CLIENT_ID"),
      client_secret: requireEnv("HUBSPOT_CLIENT_SECRET"),
      token,
      token_type_hint: "access_token",
    }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.active === false) {
    throw new Error(data?.message || data?.error_description || "Impossible d’identifier l’utilisateur HubSpot");
  }
  return data as TokenMetadata;
}

async function refreshSession(session: HubSpotSession) {
  const data = await tokenRequest({ grant_type: "refresh_token", refresh_token: session.refreshToken });
  const metadata = await introspectAccessToken(data.access_token).catch(() => null);
  const refreshed: HubSpotSession = {
    ...session,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || session.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
    hubId: metadata?.hub_id || data.hub_id || session.hubId,
    userId: metadata?.user_id || session.userId,
    email: metadata?.user || session.email,
    hubDomain: metadata?.hub_domain || session.hubDomain,
    scopes: metadata?.scopes || data.scopes || session.scopes,
  };
  await writeSession(refreshed);
  return refreshed;
}

export function privateAppToken() {
  if (isProductionEnvironment()) return "";
  return process.env.HUBSPOT_PRIVATE_APP_TOKEN?.trim() || "";
}

export function isHubSpotOAuthConfigured() {
  return Boolean(
    process.env.HUBSPOT_CLIENT_ID &&
    process.env.HUBSPOT_CLIENT_SECRET &&
    process.env.SESSION_SECRET,
  );
}

export function isHubSpotConfigured() {
  return Boolean(privateAppToken() || isHubSpotOAuthConfigured() || isProductionEnvironment());
}

export async function isHubSpotAuthenticated() {
  if (isAuthBypassEnabled()) return true;
  if (await readSession()) return true;
  return Boolean(await hubSpotServiceToken());
}

export async function getHubSpotIdentity() {
  const session = await readSession();
  if (session) {
    syncHubSpotAutomationCredentials(session).catch((error) => {
      console.error("Unable to sync HubSpot automation credentials", error);
    });
    return {
      mode: "oauth" as const,
      hubId: session.hubId,
      userId: session.userId,
      email: session.email,
      hubDomain: session.hubDomain,
    };
  }

  if (await hubSpotServiceToken()) {
    return {
      mode: "service_token" as const,
      hubId: Number(process.env.HUBSPOT_ACCOUNT_ID) || undefined,
      email: "HubSpot · compte Gando",
    };
  }

  if (isAuthBypassEnabled()) {
    return { mode: "test_bypass" as const, email: "Mode test · HubSpot" };
  }
  return null;
}

export async function createHubSpotState() {
  const state = randomBytes(32).toString("hex");
  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return state;
}

export async function consumeHubSpotState(received: string | null) {
  const jar = await cookies();
  const expected = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);
  if (!received || !expected || received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

export function buildHubSpotAuthUrl(state: string, redirectUri?: string) {
  const params = new URLSearchParams({
    client_id: requireEnv("HUBSPOT_CLIENT_ID"),
    redirect_uri: resolveHubSpotRedirectUri(redirectUri),
    scope: HUBSPOT_SCOPES,
    state,
  });
  return `${HUBSPOT_AUTHORIZE}?${params.toString()}`;
}

export async function exchangeHubSpotCode(code: string, redirectUri?: string) {
  const data = await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: resolveHubSpotRedirectUri(redirectUri),
  });
  const metadata = await introspectAccessToken(data.access_token);
  await writeSession({
    accessToken: data.access_token,
    refreshToken: data.refresh_token || "",
    expiresAt: Date.now() + data.expires_in * 1000,
    hubId: metadata.hub_id || data.hub_id,
    userId: metadata.user_id,
    email: metadata.user,
    hubDomain: metadata.hub_domain,
    scopes: metadata.scopes || data.scopes,
  });
}

export async function clearHubSpotSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

async function accessContext() {
  const privateToken = privateAppToken();
  if (privateToken) return { token: privateToken, session: null };

  let session = await readSession();
  if (session?.accessToken && session?.refreshToken) {
    if ((session.expiresAt ?? 0) <= Date.now() + 60_000) session = await refreshSession(session);
    syncHubSpotAutomationCredentials(session).catch((error) => {
      console.error("Unable to sync HubSpot automation credentials", error);
    });
    return { token: session.accessToken || "", session };
  }

  const serviceToken = await hubSpotServiceToken();
  if (serviceToken) return { token: serviceToken, session: null };

  if (isAuthBypassEnabled()) throw new Error("TEST_HUBSPOT_TOKEN_MISSING");
  throw new Error("UNAUTHORIZED");
}

export async function hubspotFetch(path: string, init: RequestInit = {}) {
  let auth = await accessContext();
  const execute = async (token: string) => {
    let response: Response;
    for (let attempt = 0; ; attempt++) {
      response = await fetch(`${HUBSPOT_API}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
        cache: "no-store",
      });
      if (response.status !== 429 || attempt >= 2) return response;

      const retryAfterSeconds = Number(response.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1_000
        : 1_000 * (attempt + 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  };

  let response = await execute(auth.token);
  if (response.status === 401 && auth.session) {
    auth = { token: "", session: await refreshSession(auth.session) };
    response = await execute(auth.session.accessToken);
  }
  return response;
}

export async function hubspotJson(path: string, init: RequestInit = {}) {
  const response = await hubspotFetch(path, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.message || `HubSpot API ${response.status}`) as Error & { status?: number; details?: unknown };
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

export function apiError(error: unknown) {
  const e = error as Error & { status?: number; details?: unknown };
  if (e.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "UNAUTHORIZED", message: "Reconnectez HubSpot pour continuer." }, { status: 401 });
  }
  if (e.message === "TEST_HUBSPOT_TOKEN_MISSING") {
    return NextResponse.json({ error: "TEST_HUBSPOT_TOKEN_MISSING", message: "Le bypass Preview est actif mais HUBSPOT_PRIVATE_APP_TOKEN manque dans les variables Preview Vercel." }, { status: 503 });
  }
  return NextResponse.json({ error: e.message || "Erreur HubSpot", details: e.details }, { status: e.status || 500 });
}
