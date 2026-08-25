import { createHash } from "node:crypto";
import { CompactEncrypt, compactDecrypt } from "jose";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "./supabase-admin";

const COCKPIT_SESSION_COOKIE = "gando_cockpit_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 90;

export type CockpitAuthProvider = "password" | "hubspot";

export type CockpitSession = {
  email?: string;
  displayName?: string;
  provider: CockpitAuthProvider;
  issuedAt: number;
};

function sessionKey() {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) throw new Error("SESSION_SECRET manquant");
  return createHash("sha256").update(secret).digest();
}

async function encryptSession(session: CockpitSession) {
  return new CompactEncrypt(new TextEncoder().encode(JSON.stringify(session)))
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(sessionKey());
}

async function decryptSession(value?: string): Promise<CockpitSession | null> {
  if (!value || !process.env.SESSION_SECRET) return null;

  try {
    const { plaintext } = await compactDecrypt(value, sessionKey());
    const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as CockpitSession;
    if (!parsed?.provider || !parsed?.issuedAt) return null;
    if (parsed.provider !== "password" && parsed.provider !== "hubspot") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getCockpitSession() {
  const value = (await cookies()).get(COCKPIT_SESSION_COOKIE)?.value;
  return decryptSession(value);
}

export async function isCockpitAuthenticated() {
  return Boolean(await getCockpitSession());
}

export async function createCockpitSession(input: {
  email?: string;
  displayName?: string;
  provider: CockpitAuthProvider;
}) {
  const session: CockpitSession = {
    email: input.email?.trim().toLowerCase() || undefined,
    displayName: input.displayName?.trim() || undefined,
    provider: input.provider,
    issuedAt: Date.now(),
  };

  (await cookies()).set(COCKPIT_SESSION_COOKIE, await encryptSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    priority: "high",
  });

  return session;
}

export async function clearCockpitSession() {
  (await cookies()).delete(COCKPIT_SESSION_COOKIE);
}

export async function verifyCockpitCredentials(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) return null;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("verify_cockpit_user", {
    p_email: normalizedEmail,
    p_password: password,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : null;
  if (!row || typeof row.email !== "string") return null;

  return {
    email: row.email as string,
    displayName: typeof row.display_name === "string" ? row.display_name : undefined,
  };
}
