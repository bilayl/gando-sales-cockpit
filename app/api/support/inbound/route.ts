import { NextRequest, NextResponse } from "next/server";
import { ingestSupportInbound, supportInboundToken, type SupportTicketType } from "@/lib/support-tickets";

export const dynamic = "force-dynamic";

function responseError(error: unknown) {
  const e = error as Error & { status?: number };
  return NextResponse.json({ error: e.message || "Erreur support" }, { status: e.status || 500 });
}

async function readBody(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return request.json().catch(() => ({}));
  if (contentType.includes("form")) {
    const form = await request.formData();
    return Object.fromEntries([...form.entries()].map(([key, value]) => [key, typeof value === "string" ? value : value.name]));
  }
  const text = await request.text();
  return { message: text };
}

function stringValue(body: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = body[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

export async function POST(request: NextRequest) {
  try {
    const expected = await supportInboundToken();
    const authorization = request.headers.get("authorization") || "";
    const bearer = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
    const supplied = request.headers.get("x-support-inbound-token")?.trim() || bearer;
    if (!expected || !supplied || supplied !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await readBody(request) as Record<string, unknown>;
    const fromName = stringValue(body, ["from_name", "fromName", "name"]);
    const nameParts = fromName.split(/\s+/).filter(Boolean);
    const recipient = stringValue(body, ["to", "recipient", "rcpt"]);
    const explicitType = stringValue(body, ["type", "category"]).toLowerCase();
    const type: SupportTicketType = explicitType === "commercial" || /commercial|sales/i.test(recipient) ? "commercial" : "support";

    const result = await ingestSupportInbound({
      type,
      source: stringValue(body, ["source"]) === "web" ? "web" : "email",
      reference: stringValue(body, ["reference", "ticket_reference"]),
      firstName: stringValue(body, ["first_name", "firstName"]) || nameParts[0] || "",
      lastName: stringValue(body, ["last_name", "lastName"]) || nameParts.slice(1).join(" "),
      email: stringValue(body, ["email", "from_address", "fromEmail", "sender_email", "from"]),
      phone: stringValue(body, ["phone", "telephone", "mobile"]),
      companyName: stringValue(body, ["company", "company_name", "companyName", "organization"]),
      companyDomain: stringValue(body, ["domain", "company_domain", "companyDomain", "website"]),
      subject: stringValue(body, ["subject", "email_subject", "title"]),
      message: stringValue(body, ["message", "body", "text", "text_body", "plain"]),
      externalId: stringValue(body, ["external_id", "message_id", "Message-Id", "id"]),
      metadata: { recipient, inboundProvider: stringValue(body, ["provider"]) || "generic" },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return responseError(error);
  }
}
