import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { ingestSupportInbound, type SupportTicketType } from "@/lib/support-tickets";

const ALLOWED_ORIGINS = new Set([
  "https://gando.app",
  "https://www.gando.app",
]);

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

async function readBody(request: NextRequest): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await request.json().catch(() => ({})) as Record<string, unknown>;
  }
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    return Object.fromEntries(
      [...form.entries()].map(([key, value]) => [key, typeof value === "string" ? value : value.name]),
    );
  }
  const text = await request.text();
  return text.trim() ? { message: text } : {};
}

function value(body: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const candidate = body[key];
    if (candidate !== undefined && candidate !== null && String(candidate).trim()) {
      return String(candidate).trim();
    }
  }
  return "";
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
    const fullName = value(body, ["name", "fullName", "full_name", "nom_complet"]);
    const nameParts = fullName.split(/\s+/).filter(Boolean);

    const firstName = value(body, ["firstName", "firstname", "first_name", "prenom", "prénom"]) || nameParts[0] || "";
    const lastName = value(body, ["lastName", "lastname", "last_name", "nom"]) || nameParts.slice(1).join(" ");
    const email = value(body, ["email", "mail", "emailAddress", "email_address"]);
    const phone = value(body, ["phone", "telephone", "téléphone", "tel", "mobile"]);
    const companyName = value(body, ["companyName", "company_name", "company", "entreprise", "organization", "organisation"]);
    const companyDomain = value(body, ["companyDomain", "company_domain", "domain", "website", "site", "siteweb", "site_web"]);
    const subject = value(body, ["subject", "objet", "title", "sujet"]) || (type === "commercial" ? "Demande commerciale depuis gando.app" : "Demande d’assistance depuis gando.app");
    const message = value(body, ["message", "description", "details", "détails", "request", "demande", "body", "content"]);
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
      },
    });

    const ticket = result.ticket as {
      id: string;
      reference: string;
      type: SupportTicketType;
      status: string;
    };

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
