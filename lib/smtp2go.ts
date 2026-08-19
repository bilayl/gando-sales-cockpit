import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_API_BASE_URL = "https://api.smtp2go.com/v3";
const DEFAULT_FROM_EMAIL = "sales@gando.app";
const DEFAULT_FROM_NAME = "Gando";
const SECRET_NAME = "smtp2go_api_key";

let cachedApiKey: { value: string; expiresAt: number } | null = null;

function apiBaseUrl() {
  return (process.env.SMTP2GO_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL).replace(/\/$/, "");
}

export function smtp2goSender() {
  const email = process.env.SMTP2GO_FROM_EMAIL?.trim() || DEFAULT_FROM_EMAIL;
  const name = process.env.SMTP2GO_FROM_NAME?.trim() || DEFAULT_FROM_NAME;
  return { email, name, formatted: `${name} <${email}>` };
}

async function resolveApiKey() {
  const envKey = process.env.SMTP2GO_API_KEY?.trim();
  if (envKey) return envKey;

  if (cachedApiKey && cachedApiKey.expiresAt > Date.now()) return cachedApiKey.value;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("get_server_secret", { p_name: SECRET_NAME });
  if (error) throw new Error("Impossible de lire la configuration SMTP2GO côté serveur");

  const value = typeof data === "string" ? data.trim() : "";
  if (!value) throw new Error("SMTP2GO n'est pas configuré dans le Sales Cockpit");

  cachedApiKey = { value, expiresAt: Date.now() + 5 * 60_000 };
  return value;
}

export type SendSmtp2goEmailInput = {
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
  replyTo?: string;
};

export type SendSmtp2goEmailResult = {
  emailId: string | null;
  requestId: string | null;
  succeeded: number;
};

type Smtp2goResponse = {
  request_id?: string;
  data?: {
    email_id?: string;
    succeeded?: number;
    failed?: number;
    failures?: Array<{ error?: string; recipient?: string }>;
  };
};

export async function sendSmtp2goEmail(input: SendSmtp2goEmailInput): Promise<SendSmtp2goEmailResult> {
  const apiKey = await resolveApiKey();
  const sender = smtp2goSender();

  const payload: Record<string, unknown> = {
    sender: sender.formatted,
    to: [input.to],
    subject: input.subject,
    text_body: input.body,
    fastaccept: true,
  };

  if (input.htmlBody?.trim()) payload.html_body = input.htmlBody;
  if (input.replyTo?.trim()) payload.custom_headers = [{ header: "Reply-To", value: input.replyTo.trim() }];

  const response = await fetch(`${apiBaseUrl()}/email/send`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Smtp2go-Api-Key": apiKey,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const data = (await response.json().catch(() => ({}))) as Smtp2goResponse;
  const failure = data.data?.failures?.[0]?.error;
  const failed = Number(data.data?.failed || 0);

  if (!response.ok || failed > 0) {
    throw new Error(failure || `SMTP2GO a refusé l'envoi (HTTP ${response.status})`);
  }

  return {
    emailId: typeof data.data?.email_id === "string" ? data.data.email_id : null,
    requestId: typeof data.request_id === "string" ? data.request_id : null,
    succeeded: Number(data.data?.succeeded || 0),
  };
}
