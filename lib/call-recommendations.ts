import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type CallRecommendationSummary = {
  ACTIONABLE: number;
  OPPORTUNITY: number;
  SNOOZED: number;
  EXCLUDED: number;
};

export type SalesCallDecision = "ACTIVE" | "SNOOZED" | "EXCLUDED";
export type SalesCallSessionItemStatus = "QUEUED" | "CALLED" | "SKIPPED" | "REMOVED";

type RecommendationRow = {
  contact_id: string;
  hubspot_contact_id: string;
  score: number;
  priority_label: string;
  bucket: keyof CallRecommendationSummary;
  reason: string;
  recommended_action: string;
  call_status?: string | null;
  prospecting_status?: string | null;
  prospecting_result?: string | null;
  next_follow_up_at?: string | null;
  last_contacted_at?: string | null;
  last_call_at?: string | null;
  overdue_tasks?: number | null;
  evaluated_at: string;
};

type OverrideRow = {
  contact_id: string;
  decision: "SNOOZED" | "EXCLUDED";
  snoozed_until?: string | null;
  reason?: string | null;
  updated_at?: string | null;
};

type ContactRow = {
  id: string;
  hubspot_id: string;
  company_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  owner_hubspot_id?: string | null;
  raw_data?: Record<string, unknown> | null;
};

type CompanyRow = { id: string; name?: string | null };

const EMPTY_SUMMARY: CallRecommendationSummary = {
  ACTIONABLE: 0,
  OPPORTUNITY: 0,
  SNOOZED: 0,
  EXCLUDED: 0,
};

export async function refreshCallRecommendations() {
  const { data, error } = await getSupabaseAdmin().rpc("refresh_call_recommendations");
  if (error) throw error;
  return Number(data || 0);
}

async function ensureFresh(force = false) {
  const supabase = getSupabaseAdmin();
  if (!force) {
    const { data } = await supabase
      .from("call_recommendations")
      .select("evaluated_at")
      .order("evaluated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const evaluatedAt = data?.evaluated_at ? new Date(String(data.evaluated_at)).getTime() : 0;
    if (evaluatedAt && Date.now() - evaluatedAt < 2 * 60 * 1000) return;
  }
  await refreshCallRecommendations();
}

function activeOverride(row?: OverrideRow) {
  if (!row) return undefined;
  if (row.decision === "EXCLUDED") return row;
  if (row.decision === "SNOOZED" && row.snoozed_until && new Date(row.snoozed_until).getTime() > Date.now()) return row;
  return undefined;
}

export async function getCallRecommendations(options?: {
  bucket?: keyof CallRecommendationSummary | "ALL";
  owner?: string;
  query?: string;
  limit?: number;
  forceRefresh?: boolean;
}) {
  await ensureFresh(Boolean(options?.forceRefresh));
  const supabase = getSupabaseAdmin();

  const [
    { data: recommendationData, error: recommendationError },
    { data: contactData, error: contactError },
    { data: overrideData, error: overrideError },
  ] = await Promise.all([
    supabase.from("call_recommendations").select("*").order("score", { ascending: false }),
    supabase.from("contacts").select("id,hubspot_id,company_id,first_name,last_name,email,phone,job_title,owner_hubspot_id,raw_data"),
    supabase.from("call_recommendation_overrides").select("contact_id,decision,snoozed_until,reason,updated_at"),
  ]);
  if (recommendationError) throw recommendationError;
  if (contactError) throw contactError;
  if (overrideError) throw overrideError;

  const recommendations = (recommendationData || []) as RecommendationRow[];
  const contacts = (contactData || []) as ContactRow[];
  const overrides = (overrideData || []) as OverrideRow[];
  const companyIds = [...new Set(contacts.map(contact => contact.company_id).filter((id): id is string => Boolean(id)))];
  let companies: CompanyRow[] = [];
  if (companyIds.length) {
    const { data, error } = await supabase.from("companies").select("id,name").in("id", companyIds);
    if (error) throw error;
    companies = (data || []) as CompanyRow[];
  }

  const contactsById = new Map(contacts.map(contact => [contact.id, contact]));
  const companiesById = new Map(companies.map(company => [company.id, company]));
  const overridesByContactId = new Map(overrides.map(row => [row.contact_id, row]));
  const summary = recommendations.reduce<CallRecommendationSummary>((acc, row) => {
    acc[row.bucket] = (acc[row.bucket] || 0) + 1;
    return acc;
  }, { ...EMPTY_SUMMARY });

  const bucket = options?.bucket || "ACTIONABLE";
  const owner = options?.owner?.trim();
  const needle = options?.query?.trim().toLowerCase();
  const limit = Math.min(Math.max(options?.limit || 1000, 1), 2000);

  const filtered = recommendations
    .filter(row => bucket === "ALL" || row.bucket === bucket)
    .map(row => {
      const contact = contactsById.get(row.contact_id);
      if (!contact) return null;
      const source = (contact.raw_data as any)?.properties || {};
      const company = contact.company_id ? companiesById.get(contact.company_id) : undefined;
      const manual = activeOverride(overridesByContactId.get(row.contact_id));
      const properties: Record<string, string | null | undefined> = {
        ...source,
        firstname: contact.first_name ?? source.firstname,
        lastname: contact.last_name ?? source.lastname,
        email: contact.email ?? source.email,
        phone: contact.phone ?? source.phone,
        mobilephone: source.mobilephone,
        jobtitle: contact.job_title ?? source.jobtitle,
        company: company?.name ?? source.company,
        hubspot_owner_id: contact.owner_hubspot_id ?? source.hubspot_owner_id,
        statut_de_lappel: row.call_status ?? source.statut_de_lappel,
        statut_prospection: row.prospecting_status ?? source.statut_prospection,
        resultat_prospection: row.prospecting_result ?? source.resultat_prospection,
        date_prochaine_relance: row.next_follow_up_at ?? source.date_prochaine_relance,
        db_call_score: String(row.score),
        db_call_priority_label: row.priority_label,
        db_call_bucket: row.bucket,
        db_call_reason: row.reason,
        db_call_action: row.recommended_action,
        db_call_evaluated_at: row.evaluated_at,
        db_call_overdue_tasks: String(row.overdue_tasks || 0),
        db_call_last_call_at: row.last_call_at || undefined,
        db_call_last_contacted_at: row.last_contacted_at || undefined,
        db_call_manual_decision: manual?.decision,
        db_call_manual_reason: manual?.reason || undefined,
        db_call_snoozed_until: manual?.snoozed_until || undefined,
        db_call_manual_updated_at: manual?.updated_at || undefined,
      };
      return { id: contact.hubspot_id, properties };
    })
    .filter((contact): contact is { id: string; properties: Record<string, string | null | undefined> } => Boolean(contact))
    .filter(contact => {
      const p = contact.properties;
      if (owner && p.hubspot_owner_id !== owner) return false;
      if (needle) {
        const haystack = [p.firstname, p.lastname, p.email, p.phone, p.mobilephone, p.company, p.jobtitle]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    })
    .slice(0, limit);

  const total = recommendations.filter(row => bucket === "ALL" || row.bucket === bucket).length;
  return {
    results: filtered,
    total,
    summary,
    evaluatedAt: recommendations[0]?.evaluated_at || null,
  };
}

export async function setCallRecommendationDecision(input: {
  hubspotContactId: string;
  decision: SalesCallDecision;
  snoozedUntil?: string | null;
  reason?: string | null;
  actor?: string | null;
}) {
  const supabase = getSupabaseAdmin();
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id,hubspot_id")
    .eq("hubspot_id", input.hubspotContactId)
    .maybeSingle();
  if (contactError) throw contactError;
  if (!contact?.id) throw new Error("Contact introuvable dans Supabase. Synchronisez HubSpot puis réessayez.");

  if (input.decision === "ACTIVE") {
    const { error } = await supabase.from("call_recommendation_overrides").delete().eq("contact_id", contact.id);
    if (error) throw error;
  } else {
    if (input.decision === "SNOOZED") {
      const until = input.snoozedUntil ? new Date(input.snoozedUntil) : null;
      if (!until || Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
        throw new Error("Choisissez une date de rappel future.");
      }
    }
    const now = new Date().toISOString();
    const { error } = await supabase.from("call_recommendation_overrides").upsert({
      contact_id: contact.id,
      decision: input.decision,
      snoozed_until: input.decision === "SNOOZED" ? input.snoozedUntil : null,
      reason: input.reason?.trim() || null,
      created_by: input.actor || null,
      updated_by: input.actor || null,
      updated_at: now,
    }, { onConflict: "contact_id" });
    if (error) throw error;

    const { error: sessionError } = await supabase
      .from("sales_call_session_items")
      .update({ status: "REMOVED", outcome: input.decision, updated_at: now })
      .eq("contact_id", contact.id)
      .eq("status", "QUEUED");
    if (sessionError) throw sessionError;
  }

  await refreshCallRecommendations();
  return { ok: true };
}

export async function createSalesCallSession(input?: {
  owner?: string;
  targetCount?: number;
  createdBy?: string | null;
}) {
  const targetCount = Math.min(Math.max(input?.targetCount || 80, 1), 500);
  const recommendations = await getCallRecommendations({
    bucket: "ACTIONABLE",
    owner: input?.owner,
    limit: targetCount,
    forceRefresh: true,
  });
  const hubspotIds = recommendations.results.map(contact => contact.id);
  if (!hubspotIds.length) throw new Error("Aucun contact disponible pour cette session.");

  const supabase = getSupabaseAdmin();
  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("id,hubspot_id")
    .in("hubspot_id", hubspotIds);
  if (contactsError) throw contactsError;
  const uuidByHubspotId = new Map((contacts || []).map(row => [String(row.hubspot_id), String(row.id)]));

  const now = new Date();
  const sessionName = `Session d’appels ${new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now)}`;
  const { data: session, error: sessionError } = await supabase.from("sales_call_sessions").insert({
    name: sessionName,
    owner_hubspot_id: input?.owner || null,
    target_count: targetCount,
    created_by: input?.createdBy || null,
  }).select("id,name,owner_hubspot_id,target_count,status,created_at").single();
  if (sessionError) throw sessionError;

  const items = hubspotIds
    .map((hubspotId, index) => ({
      session_id: session.id,
      contact_id: uuidByHubspotId.get(hubspotId),
      position: index + 1,
    }))
    .filter(item => Boolean(item.contact_id));
  if (items.length) {
    const { error } = await supabase.from("sales_call_session_items").insert(items);
    if (error) throw error;
  }

  return getSalesCallSession(String(session.id));
}

export async function getSalesCallSession(sessionId: string) {
  const supabase = getSupabaseAdmin();
  const [{ data: session, error: sessionError }, { data: items, error: itemsError }] = await Promise.all([
    supabase.from("sales_call_sessions").select("id,name,owner_hubspot_id,target_count,status,created_at,completed_at").eq("id", sessionId).maybeSingle(),
    supabase.from("sales_call_session_items").select("contact_id,position,status,outcome").eq("session_id", sessionId).order("position", { ascending: true }),
  ]);
  if (sessionError) throw sessionError;
  if (itemsError) throw itemsError;
  if (!session) throw new Error("Session d’appels introuvable.");

  const queuedItems = (items || []).filter(item => item.status === "QUEUED");
  const contactIds = queuedItems.map(item => String(item.contact_id));
  if (!contactIds.length) return { session, results: [], remaining: 0, totalItems: (items || []).length };

  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("id,hubspot_id")
    .in("id", contactIds);
  if (contactsError) throw contactsError;
  const hubspotByUuid = new Map((contacts || []).map(row => [String(row.id), String(row.hubspot_id)]));
  const allRecommendations = await getCallRecommendations({ bucket: "ALL", limit: 2000 });
  const recommendationByHubspotId = new Map(allRecommendations.results.map(contact => [contact.id, contact]));

  const results = queuedItems
    .map(item => recommendationByHubspotId.get(hubspotByUuid.get(String(item.contact_id)) || ""))
    .filter((contact): contact is { id: string; properties: Record<string, string | null | undefined> } => Boolean(contact));

  return { session, results, remaining: results.length, totalItems: (items || []).length };
}

export async function updateSalesCallSessionItem(input: {
  sessionId: string;
  hubspotContactId: string;
  status: SalesCallSessionItemStatus;
  outcome?: string | null;
}) {
  const supabase = getSupabaseAdmin();
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id")
    .eq("hubspot_id", input.hubspotContactId)
    .maybeSingle();
  if (contactError) throw contactError;
  if (!contact?.id) throw new Error("Contact introuvable.");

  const { error } = await supabase
    .from("sales_call_session_items")
    .update({ status: input.status, outcome: input.outcome || null, updated_at: new Date().toISOString() })
    .eq("session_id", input.sessionId)
    .eq("contact_id", contact.id);
  if (error) throw error;

  const { count, error: countError } = await supabase
    .from("sales_call_session_items")
    .select("id", { head: true, count: "exact" })
    .eq("session_id", input.sessionId)
    .eq("status", "QUEUED");
  if (countError) throw countError;
  if ((count || 0) === 0) {
    const { error: completeError } = await supabase
      .from("sales_call_sessions")
      .update({ status: "COMPLETED", completed_at: new Date().toISOString() })
      .eq("id", input.sessionId)
      .eq("status", "OPEN");
    if (completeError) throw completeError;
  }

  return getSalesCallSession(input.sessionId);
}
