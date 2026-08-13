import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR = "https://www.googleapis.com/calendar/v3";

const CALENDAR_SCOPE = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
].join(" ");
const TOKEN_COOKIE = "gando_google_token";
const STATE_COOKIE = "gando_google_state";

export type GoogleToken = {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} manquant`);
  return value;
}

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}

export async function createGoogleState() {
  const state = randomBytes(24).toString("hex");
  const jar = await cookies();
  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return state;
}

export async function consumeGoogleState(received: string | null) {
  const jar = await cookies();
  const expected = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);
  return Boolean(received && expected && received === expected);
}

export function buildGoogleAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: requireEnv("GOOGLE_REDIRECT_URI"),
    response_type: "code",
    scope: CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

async function tokenRequest(values: Record<string, string>): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
  const body = new URLSearchParams({
    ...values,
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
  });
  const response = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error_description || data?.error || "Échec OAuth Google");
  return data;
}

export async function exchangeGoogleCode(code: string) {
  const data = await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: requireEnv("GOOGLE_REDIRECT_URI"),
  });
  await storeGoogleToken({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  });
}

async function storeGoogleToken(token: GoogleToken) {
  const jar = await cookies();
  jar.set(TOKEN_COOKIE, JSON.stringify(token), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}

async function getStoredToken(): Promise<GoogleToken | null> {
  const jar = await cookies();
  const raw = jar.get(TOKEN_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GoogleToken;
  } catch {
    return null;
  }
}

async function refreshGoogleToken(token: GoogleToken): Promise<GoogleToken> {
  if (!token.refresh_token) throw new Error("GOOGLE_UNAUTHORIZED");
  const data = await tokenRequest({ grant_type: "refresh_token", refresh_token: token.refresh_token });
  const updated: GoogleToken = {
    ...token,
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  await storeGoogleToken(updated);
  return updated;
}

export async function googleFetch(path: string) {
  let token = await getStoredToken();
  if (!token) throw new Error("GOOGLE_UNAUTHORIZED");
  if (token.expires_at < Date.now() + 60_000) token = await refreshGoogleToken(token);
  let response = await fetch(`${GOOGLE_CALENDAR}${path}`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
    cache: "no-store",
  });
  if (response.status === 401 && token.refresh_token) {
    token = await refreshGoogleToken(token);
    response = await fetch(`${GOOGLE_CALENDAR}${path}`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: "no-store",
    });
  }
  return response;
}

export async function getGoogleCalendarEvents(opts: { calendarId: string; timeMin: string; timeMax: string }) {
  const params = new URLSearchParams({
    timeMin: opts.timeMin,
    timeMax: opts.timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const response = await googleFetch(`/calendars/${encodeURIComponent(opts.calendarId)}/events?${params.toString()}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Google Calendar ${response.status}`);
  return data as { items: Array<{ id: string; summary: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; location?: string }> };
}
