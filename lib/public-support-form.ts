import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ingestSupportInbound, type SupportTicketType } from "@/lib/support-tickets";

const ALLOWED_ORIGINS = new Set([
  "https://gando.app",
  "https://www.gando.app",
]);

const SECRET_FIELD_PATTERN = /(password|passwd|secret|token|authorization|api[_-]?key|private[_-]?key)/i;
let cachedDiscordWebhook: { value: string; expiresAt: number } | null = null;

function originFor(request: NextRequest) {
  return request.headers.get("origin")?.trim() || "";
}

function corsHeaders(request: NextRequest) {
  const origin = originFor(request);
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://www.gando.app",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function isAllowedRequestOrigin(request: NextRequest) {
  const origin = originFor(request);
  // Server-to-server form providers often do not send an Origin header.
  return !origin || ALLOWED_ORIGINS.has(origin);
}

function appendFormValue(target: Record<string, unknown>, key: string, nextValue: unknown) {
  const current = target[key];
  if (current === undefined) {
    target[key] = nextValue;
    return;
  }
  target[key] = Array.isArray(current) ? [...current, nextValue] : [current, nextValue];
}

async function readBody(request: NextRequest): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await request.json().catch(() => ({})) as Record<string, unknown>;
  }
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const result: Record<string, unknown> = {};
    for (const [key, item] of form.entries()) {
      const parsed = typeof item === "string"
        ? item
        : { fileName: item.name, size: item.size, type: item.type || "application/octet-stream" };
      appendFormValue(result, key, parsed);
    }
    return result;
  }
  const text = await request.text();
  return text.trim() ? { message: text } : {};
}

function scalarText(input: unknown) {
  if (Array.isArray(input)) return scalarText(input[0]);
  if (input === undefined || input === null) return "";
  if (typeof input === "object") return "";
  return String(input).trim();
}

function value(body: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const candidate = scalarText(body[key]);
    if (candidate) return candidate;
  }
  return "";
}

function sanitizeValue(input: unknown, key = "", depth = 0): unknown {
  if (SECRET_FIELD_PATTERN.test(key)) return "[redacted]";
  if (input === null || input === undefined) return input ?? null;
  if (typeof input === "string") return input.slice(0, 20_000);
  if (typeof input === "number" || typeof input === "boolean") return input;
  if (Array.isArray(input)) return input.slice(0, 100).map(item => sanitizeValue(item, key, depth + 1));
  if (typeof input === "object") {
    if (depth >= 4) return "[object]";
    const result: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(input as Record<string, unknown>).slice(0, 150)) {
      result[childKey] = sanitizeValue(childValue, childKey, depth + 1);
    }
    return result;
  }
  return String(input).slice(0, 20_000);
}

function sanitizePayload(body: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(body).slice(0, 150)) {
    result[key] = sanitizeValue(rawValue, key);
  }
  return result;
}

function readableValue(input: unknown) {
  if (input === null || input === undefined || input === "") return "—";
  if (typeof input === "string") return input;
  if (typeof input === "number" || typeof input === "boolean") return String(input);
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}

function allPayloadLines(payload: Record<string, unknown>) {
  return Object.entries(payload).map(([key, rawValue]) => `${key}: ${readableValue(rawValue)}`);
}

function buildTicketMessage(originalMessage: string, payload: Record<string, unknown>) {
  const lines = [
    originalMessage || "Demande transmise depuis le formulaire Gando.app.",
    "",
    "--- Toutes les données reçues du formulaire ---",
    ...allPayloadLines(payload),
  ];
  return lines.join("\n").slice(0, 20_000);
}

async function discordWebhookUrl() {
  const env = process.env.DISCORD_SUPPORT_WEBHOOK_URL?.trim();
  if (env) return env;
  if (cachedDiscordWebhook && cachedDiscordWebhook.expiresAt > Date.now()) return cachedDiscordWebhook.value;
  const { data, error } = await getSupabaseAdmin().rpc("get_server_secret", { p_name: "discord_support_webhook_url" });
  if (error) throw error;
  const value = typeof data === "string" ? data.trim() : "";
  if (value) cachedDiscordWebhook = { value, expiresAt: Date.now() + 5 * 60_000 };
  return value;
}

function discordChunks(reference: string, type: SupportTicketType, payload: Record<string, unknown>) {
  const header = `📋 Données complètes · ${reference} · ${type === "commercial" ? "Commercial" : "Assistance"}`;
  const lines = allPayloadLines(payload);
  const chunks: string[] = [];
  let current = header;
  for (const line of lines) {
    const safeLine = line.slice(0, 1700);
    if (`${current}\n${safeLine}`.length > 1900) {
      chunks.push(current);
      current = `${header} (suite)\n${safeLine}`;
    } else {
      current += `\n${safeLine}`;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function notifyDiscordWithCompletePayload(reference: string, type: SupportTicketType, payload: Record<string, unknown>) {
  try {
    const webhook = await discordWebhookUrl();
    if (!webhook) return;
    for (const content of discordChunks(reference, type, payload)) {
      const response = await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "Gando Support",
          allowed_mentions: { parse: [] },
          content,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) {
        console.error(`Discord full support payload webhook HTTP ${response.status}`);
        break;
      }
    }
  } catch (error) {
    console.error("Discord full support payload notification failed", error instanceof Error ? error.message : error);
  }
}

function response(request: NextRequest, payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: corsHeaders(request) });
}

export function publicSupportFormOptions(request: NextRequest) {
  if (!isAllowedRequestOrigin(request)) return response(request, { error: "Origin not allowed" }, 403);
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function handlePublicSupportForm(request: NextRequest, type: SupportTicketType) {
  try {
    if (!isAllowedRequestOrigin(request)) {
      return response(request, { error: "Origin not allowed" }, 403);
    }

    const body = await readBody(request);
    const completePayload = sanitizePayload(body);
    const fullName = value(body, ["name", "fullName", "full_name", "nom_complet"]);
    const nameParts = fullName.split(/\s+/).filter(Boolean);

    const firstName = value(body, ["firstName", "firstname", "first_name", "prenom", "prénom"] ) || nameParts[0] || "";
    const lastName = value(body, ["lastName", "lastname", "last_name", "nom"] ) || nameParts.slice(1).join(" ");
    const email = value(body, ["email", "mail", "emailAddress", "email_address"]);
    const phone = value(body, ["phone", "telephone", "téléphone", "tel", "mobile"]);
    const companyName = value(body, ["companyName", "company_name", "company", "entreprise", "organization", "organisation"]);
    const companyDomain = value(body, ["companyDomain", "company_domain", "domain", "website", "site", "siteweb", "site_web"]);
    const subject = value(body, ["subject", "objet", "title", "sujet"]) || (type === "commercial" ? "Demande commerciale depuis gando.app" : "Demande d’assistance depuis gando.app");
    const originalMessage = value(body, ["message", "description", "details", "détails", "request", "demande", "body", "content"]);
    const message = buildTicketMessage(originalMessage, completePayload);
    const externalId = value(body, ["submissionId", "submission_id", "externalId", "external_id", "id"]);

    const result = await ingestSupportInbound({
      type,
      source: "web",
      firstName,
      lastName,
      email,
      phone,
      companyName,
      companyDomain,
      subject,
      message,
      externalId,
      metadata: {
        form: "gando.app/support-request",
        endpointType: type,
        origin: originFor(request) || null,
        receivedAt: new Date().toISOString(),
        receivedFields: Object.keys(completePayload),
        rawPayload: completePayload,
      },
    });

    const ticket = result.ticket as {
      id: string;
      reference: string;
      type: SupportTicketType;
      status: string;
    };

    await notifyDiscordWithCompletePayload(ticket.reference, type, completePayload);

    return response(request, {
      ok: true,
      ticket: {
        id: ticket.id,
        reference: ticket.reference,
        type: ticket.type,
        status: ticket.status,
      },
    }, 201);
  } catch (error) {
    const e = error as Error & { status?: number };
    return response(request, { error: e.message || "Impossible de créer la demande." }, e.status || 500);
  }
}
