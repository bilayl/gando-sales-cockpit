import "server-only";

import { hubspotJson } from "@/lib/hubspot";
import { sendSmtp2goEmail } from "@/lib/smtp2go";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type SupportTicketType = "support" | "commercial";
export type SupportTicketStatus = "open" | "waiting_customer" | "resolved";
export type SupportTicketSource = "manual" | "web" | "email" | "api";

export type SupportTicketInput = {
  type?: SupportTicketType;
  source?: SupportTicketSource;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  companyDomain?: string;
  subject?: string;
  message?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
};

type TicketRow = {
  id: string;
  reference: string;
  type: SupportTicketType;
  status: SupportTicketStatus;
  source: SupportTicketSource;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  company_domain: string | null;
  subject: string;
  message_preview: string | null;
  hubspot_company_id: string | null;
  hubspot_contact_id: string | null;
  dispatch_status: "not_applicable" | "pending" | "synced" | "failed";
  dispatch_error: string | null;
  acknowledged_at: string | null;
  last_reply_at: string | null;
  created_by_email: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const secretCache = new Map<string, { value: string; expiresAt: number }>();

function clean(value: unknown, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanEmail(value: unknown) {
  return clean(value, 320).toLowerCase();
}

function cleanDomain(value: unknown) {
  return clean(value, 300)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .trim();
}

function htmlEscape(value: string) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
}

async function serverSecret(name: string) {
  const envName = name.toUpperCase();
  const env = process.env[envName]?.trim();
  if (env) return env;
  const cached = secretCache.get(name);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const { data, error } = await getSupabaseAdmin().rpc("get_server_secret", { p_name: name });
  if (error) throw error;
  const value = typeof data === "string" ? data.trim() : "";
  if (value) secretCache.set(name, { value, expiresAt: Date.now() + 5 * 60_000 });
  return value;
}

export async function supportInboundToken() {
  return process.env.SUPPORT_INBOUND_TOKEN?.trim() || serverSecret("support_inbound_token");
}

function supportReplyTo() {
  return process.env.SUPPORT_REPLY_TO_EMAIL?.trim() || "support@gando.app";
}

function supportFromEmail() {
  return process.env.SMTP2GO_SUPPORT_FROM_EMAIL?.trim() || undefined;
}

function personName(ticket: Pick<TicketRow, "first_name" | "last_name" | "email">) {
  return [ticket.first_name, ticket.last_name].filter(Boolean).join(" ").trim() || ticket.email || "Bonjour";
}

function ticketEmailSubject(ticket: Pick<TicketRow, "reference" | "subject">, reply = false) {
  return `${reply ? "Re: " : ""}[Gando ${ticket.reference}] ${ticket.subject}`;
}

async function notifyDiscord(ticket: TicketRow, event: string, message?: string) {
  try {
    const webhookUrl = process.env.DISCORD_SUPPORT_WEBHOOK_URL?.trim() || await serverSecret("discord_support_webhook_url");
    if (!webhookUrl) return;
    const typeLabel = ticket.type === "commercial" ? "Commercial" : "Support";
    const requester = personName(ticket);
    const fields = [
      { name: "Demandeur", value: `${requester}${ticket.email ? `\n${ticket.email}` : ""}`.slice(0, 1024), inline: true },
      { name: "Entreprise", value: (ticket.company_name || ticket.company_domain || "—").slice(0, 1024), inline: true },
      { name: "Statut", value: ticket.status, inline: true },
    ];
    if (ticket.hubspot_company_id || ticket.hubspot_contact_id) {
      fields.push({ name: "Prospection HubSpot", value: `Entreprise: ${ticket.hubspot_company_id || "—"}\nContact: ${ticket.hubspot_contact_id || "—"}`.slice(0, 1024), inline: false });
    }
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "Gando Support",
        allowed_mentions: { parse: [] },
        embeds: [{
          title: `${typeLabel} · ${ticket.reference} · ${event}`.slice(0, 256),
          description: (message || ticket.message_preview || ticket.subject).slice(0, 3500),
          fields,
          footer: { text: `Sales Cockpit · ${ticket.subject}`.slice(0, 2048) },
          timestamp: new Date().toISOString(),
        }],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) console.error(`Discord support webhook HTTP ${response.status}`);
  } catch (error) {
    console.error("Discord support notification failed", error instanceof Error ? error.message : error);
  }
}

async function sendAcknowledgement(ticket: TicketRow) {
  if (!ticket.email) return null;
  const name = personName(ticket);
  const body = `Bonjour ${name},\n\nNous avons bien reçu votre demande « ${ticket.subject} ».\n\nVotre ticket est ${ticket.reference}. Notre équipe reviendra vers vous sous 48 heures maximum.\n\nVous pouvez répondre directement à cet email en conservant la référence ${ticket.reference} dans l’objet : votre réponse pourra être rattachée au même ticket.\n\nÀ bientôt,\nL’équipe Gando`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937"><p>Bonjour <strong>${htmlEscape(name)}</strong>,</p><p>Nous avons bien reçu votre demande « <strong>${htmlEscape(ticket.subject)}</strong> ».</p><p>Votre ticket est <strong>${htmlEscape(ticket.reference)}</strong>. Notre équipe reviendra vers vous <strong>sous 48 heures maximum</strong>.</p><p>Vous pouvez répondre directement à cet email en conservant la référence <strong>${htmlEscape(ticket.reference)}</strong> dans l’objet : votre réponse pourra être rattachée au même ticket.</p><p>À bientôt,<br/>L’équipe Gando</p></div>`;
  return sendSmtp2goEmail({
    to: ticket.email,
    subject: ticketEmailSubject(ticket),
    body,
    htmlBody: html,
    replyTo: supportReplyTo(),
    fromEmail: supportFromEmail(),
    fromName: "Support Gando",
  });
}

async function searchHubSpotObject(objectType: "companies" | "contacts", propertyName: string, value: string, properties: string[]) {
  if (!value) return null;
  const data = await hubspotJson(`/crm/objects/2026-03/${objectType}/search`, {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName, operator: "EQ", value }] }],
      properties,
      limit: 1,
    }),
  });
  return data?.results?.[0] || null;
}

async function searchCompanyByName(name: string) {
  if (!name) return null;
  const data = await hubspotJson("/crm/objects/2026-03/companies/search", {
    method: "POST",
    body: JSON.stringify({ query: name, properties: ["name", "domain", "phone", "website", "city", "zip", "country", "hubspot_owner_id"], limit: 5 }),
  });
  const normalized = name.trim().toLowerCase();
  return (data?.results || []).find((item: any) => String(item?.properties?.name || "").trim().toLowerCase() === normalized) || data?.results?.[0] || null;
}

async function syncCompanyLocally(company: any) {
  if (!company?.id) return null;
  const p = company.properties || {};
  const { data, error } = await getSupabaseAdmin().from("companies").upsert({
    hubspot_id: String(company.id),
    name: p.name || p.domain || "Sans nom",
    domain: p.domain ?? null,
    phone: p.phone ?? null,
    website: p.website ?? null,
    city: p.city ?? null,
    postal_code: p.zip ?? null,
    country: p.country ?? null,
    owner_hubspot_id: p.hubspot_owner_id ?? null,
    raw_data: company,
    hubspot_updated_at: company.updatedAt || new Date().toISOString(),
  }, { onConflict: "hubspot_id" }).select("id").maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

async function syncContactLocally(contact: any, localCompanyId?: string | null) {
  if (!contact?.id) return;
  const p = contact.properties || {};
  const { error } = await getSupabaseAdmin().from("contacts").upsert({
    hubspot_id: String(contact.id),
    company_id: localCompanyId || null,
    first_name: p.firstname ?? null,
    last_name: p.lastname ?? null,
    email: p.email ?? null,
    phone: p.phone || p.mobilephone || null,
    job_title: p.jobtitle ?? null,
    owner_hubspot_id: p.hubspot_owner_id ?? null,
    raw_data: contact,
    hubspot_updated_at: contact.updatedAt || new Date().toISOString(),
  }, { onConflict: "hubspot_id" });
  if (error) throw error;
}

export async function dispatchCommercialTicket(ticket: TicketRow) {
  if (ticket.type !== "commercial") return ticket;
  const admin = getSupabaseAdmin();
  await admin.from("support_tickets").update({ dispatch_status: "pending", dispatch_error: null }).eq("id", ticket.id);
  try {
    const companyDomain = cleanDomain(ticket.company_domain || "");
    let company = companyDomain
      ? await searchHubSpotObject("companies", "domain", companyDomain, ["name", "domain", "phone", "website", "city", "zip", "country", "hubspot_owner_id"])
      : null;
    if (!company && ticket.company_name) company = await searchCompanyByName(ticket.company_name);

    if (!company && (ticket.company_name || companyDomain)) {
      const companyName = ticket.company_name || companyDomain;
      company = await hubspotJson("/crm/objects/2026-03/companies", {
        method: "POST",
        body: JSON.stringify({ properties: {
          name: companyName,
          ...(companyDomain ? { domain: companyDomain, website: `https://${companyDomain}` } : {}),
          ...(ticket.phone ? { phone: ticket.phone } : {}),
          description: `Créé depuis le ticket commercial Gando ${ticket.reference} : ${ticket.subject}`.slice(0, 3000),
        } }),
      });
    }

    let contact = ticket.email
      ? await searchHubSpotObject("contacts", "email", ticket.email, ["firstname", "lastname", "email", "phone", "mobilephone", "jobtitle", "company", "hubspot_owner_id"])
      : null;
    if (!contact && (ticket.email || ticket.first_name || ticket.last_name || ticket.phone)) {
      contact = await hubspotJson("/crm/objects/2026-03/contacts", {
        method: "POST",
        body: JSON.stringify({ properties: {
          ...(ticket.first_name ? { firstname: ticket.first_name } : {}),
          ...(ticket.last_name ? { lastname: ticket.last_name } : {}),
          ...(ticket.email ? { email: ticket.email } : {}),
          ...(ticket.phone ? { phone: ticket.phone } : {}),
          ...(ticket.company_name ? { company: ticket.company_name } : {}),
        } }),
      });
    }

    if (company?.id && contact?.id) {
      await hubspotJson(`/crm/objects/2026-03/contact/${encodeURIComponent(String(contact.id))}/associations/default/company/${encodeURIComponent(String(company.id))}`, { method: "PUT" });
    }

    const localCompanyId = company ? await syncCompanyLocally(company) : null;
    if (contact) await syncContactLocally(contact, localCompanyId);

    const update = {
      hubspot_company_id: company?.id ? String(company.id) : null,
      hubspot_contact_id: contact?.id ? String(contact.id) : null,
      dispatch_status: "synced" as const,
      dispatch_error: null,
    };
    const { data, error } = await admin.from("support_tickets").update(update).eq("id", ticket.id).select("*").single();
    if (error) throw error;
    return data as TicketRow;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin.from("support_tickets").update({ dispatch_status: "failed", dispatch_error: message.slice(0, 1500) }).eq("id", ticket.id);
    console.error("Commercial ticket dispatch failed", message);
    return { ...ticket, dispatch_status: "failed" as const, dispatch_error: message };
  }
}

export async function createSupportTicket(input: SupportTicketInput, createdByEmail?: string | null) {
  const admin = getSupabaseAdmin();
  const type: SupportTicketType = input.type === "commercial" ? "commercial" : "support";
  const source: SupportTicketSource = input.source === "web" || input.source === "email" || input.source === "api" ? input.source : "manual";
  const email = cleanEmail(input.email);
  const message = clean(input.message, 20_000);
  const subject = clean(input.subject, 500) || (type === "commercial" ? "Demande commerciale" : "Demande de support");
  if (!message) throw Object.assign(new Error("Le message du ticket est obligatoire."), { status: 400 });
  if (!email && !clean(input.phone, 100)) throw Object.assign(new Error("Un email ou un téléphone est nécessaire pour identifier le demandeur."), { status: 400 });

  const row = {
    type,
    status: "open" as const,
    source,
    first_name: clean(input.firstName, 150) || null,
    last_name: clean(input.lastName, 150) || null,
    email: email || null,
    phone: clean(input.phone, 100) || null,
    company_name: clean(input.companyName, 300) || null,
    company_domain: cleanDomain(input.companyDomain) || null,
    subject,
    message_preview: message.slice(0, 1000),
    dispatch_status: type === "commercial" ? "pending" : "not_applicable",
    created_by_email: createdByEmail || null,
    metadata: input.metadata || {},
  };
  const { data, error } = await admin.from("support_tickets").insert(row).select("*").single();
  if (error) throw error;
  let ticket = data as TicketRow;

  const { error: messageError } = await admin.from("support_ticket_messages").insert({
    ticket_id: ticket.id,
    direction: "inbound",
    channel: source === "manual" ? "internal" : source,
    sender_name: personName(ticket),
    sender_email: ticket.email,
    body: message,
    external_id: clean(input.externalId, 500) || null,
    created_by_email: createdByEmail || null,
    metadata: input.metadata || {},
  });
  if (messageError) {
    await admin.from("support_tickets").delete().eq("id", ticket.id);
    throw messageError;
  }

  if (ticket.email) {
    try {
      const sent = await sendAcknowledgement(ticket);
      await admin.from("support_tickets").update({
        acknowledged_at: new Date().toISOString(),
        metadata: { ...(ticket.metadata || {}), acknowledgementEmailId: sent?.emailId || null },
      }).eq("id", ticket.id);
    } catch (ackError) {
      const ackMessage = ackError instanceof Error ? ackError.message : String(ackError);
      await admin.from("support_tickets").update({ metadata: { ...(ticket.metadata || {}), acknowledgementError: ackMessage.slice(0, 1000) } }).eq("id", ticket.id);
      console.error("Support acknowledgement failed", ackMessage);
    }
  }

  if (type === "commercial") ticket = await dispatchCommercialTicket(ticket);
  const refreshed = await admin.from("support_tickets").select("*").eq("id", ticket.id).single();
  if (!refreshed.error && refreshed.data) ticket = refreshed.data as TicketRow;
  await notifyDiscord(ticket, "Nouveau ticket", message);
  return ticket;
}

export async function listSupportTickets(filters: { type?: SupportTicketType; status?: SupportTicketStatus; q?: string; limit?: number } = {}) {
  let query = getSupabaseAdmin().from("support_tickets").select("*").order("updated_at", { ascending: false }).limit(Math.min(Math.max(filters.limit || 100, 1), 200));
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.q?.trim()) {
    const q = filters.q.trim().replace(/[,%]/g, " ");
    query = query.or(`reference.ilike.%${q}%,subject.ilike.%${q}%,email.ilike.%${q}%,company_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as TicketRow[];
}

export async function getSupportTicket(id: string) {
  const admin = getSupabaseAdmin();
  const [{ data: ticket, error }, { data: messages, error: messageError }] = await Promise.all([
    admin.from("support_tickets").select("*").eq("id", id).single(),
    admin.from("support_ticket_messages").select("*").eq("ticket_id", id).order("created_at", { ascending: true }),
  ]);
  if (error) throw error;
  if (messageError) throw messageError;
  return { ticket: ticket as TicketRow, messages: messages || [] };
}

export async function updateSupportTicketStatus(id: string, status: SupportTicketStatus) {
  const { data, error } = await getSupabaseAdmin().from("support_tickets").update({ status }).eq("id", id).select("*").single();
  if (error) throw error;
  return data as TicketRow;
}

export async function replyToSupportTicket(id: string, bodyInput: string, createdByEmail?: string | null) {
  const body = clean(bodyInput, 20_000);
  if (!body) throw Object.assign(new Error("La réponse est vide."), { status: 400 });
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("support_tickets").select("*").eq("id", id).single();
  if (error) throw error;
  const ticket = data as TicketRow;
  if (!ticket.email) throw Object.assign(new Error("Ce ticket n'a pas d'adresse email de destinataire."), { status: 409 });

  const sent = await sendSmtp2goEmail({
    to: ticket.email,
    subject: ticketEmailSubject(ticket, true),
    body,
    htmlBody: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">${body.split(/\n+/).map(line => `<p>${htmlEscape(line)}</p>`).join("")}<hr/><p style="font-size:12px;color:#6b7280">Ticket ${htmlEscape(ticket.reference)} · Gando</p></div>`,
    replyTo: supportReplyTo(),
    fromEmail: supportFromEmail(),
    fromName: "Support Gando",
  });

  const now = new Date().toISOString();
  const { error: messageError } = await admin.from("support_ticket_messages").insert({
    ticket_id: ticket.id,
    direction: "outbound",
    channel: "email",
    sender_name: "Support Gando",
    sender_email: supportReplyTo(),
    body,
    external_id: sent.emailId || sent.requestId || null,
    created_by_email: createdByEmail || null,
    metadata: { smtp2goRequestId: sent.requestId },
  });
  if (messageError) throw messageError;
  const { data: updated, error: updateError } = await admin.from("support_tickets").update({ status: "waiting_customer", last_reply_at: now }).eq("id", id).select("*").single();
  if (updateError) throw updateError;
  await notifyDiscord(updated as TicketRow, "Réponse envoyée", body);
  return updated as TicketRow;
}

export function extractTicketReference(subject: string) {
  const match = String(subject || "").match(/\bSUP-[A-Z0-9]{8}\b/i);
  return match?.[0]?.toUpperCase() || "";
}

export async function ingestSupportInbound(input: SupportTicketInput & { reference?: string }) {
  const admin = getSupabaseAdmin();
  const externalId = clean(input.externalId, 500);
  if (externalId) {
    const { data: duplicate } = await admin.from("support_ticket_messages").select("ticket_id").eq("external_id", externalId).maybeSingle();
    if (duplicate?.ticket_id) return getSupportTicket(duplicate.ticket_id);
  }

  const reference = clean(input.reference, 50).toUpperCase() || extractTicketReference(clean(input.subject, 500));
  if (reference) {
    const { data: existing } = await admin.from("support_tickets").select("*").eq("reference", reference).maybeSingle();
    if (existing) {
      const body = clean(input.message, 20_000);
      if (!body) throw Object.assign(new Error("Le message entrant est vide."), { status: 400 });
      const { error: messageError } = await admin.from("support_ticket_messages").insert({
        ticket_id: existing.id,
        direction: "inbound",
        channel: input.source === "web" || input.source === "api" ? input.source : "email",
        sender_name: [clean(input.firstName, 150), clean(input.lastName, 150)].filter(Boolean).join(" ") || clean(input.email, 320),
        sender_email: cleanEmail(input.email) || existing.email,
        body,
        external_id: externalId || null,
        metadata: input.metadata || {},
      });
      if (messageError) throw messageError;
      const { data: updated, error: updateError } = await admin.from("support_tickets").update({ status: "open", message_preview: body.slice(0, 1000) }).eq("id", existing.id).select("*").single();
      if (updateError) throw updateError;
      await notifyDiscord(updated as TicketRow, "Nouvelle réponse client", body);
      return getSupportTicket(existing.id);
    }
  }

  const ticket = await createSupportTicket({ ...input, source: input.source || "email", externalId }, null);
  return getSupportTicket(ticket.id);
}
