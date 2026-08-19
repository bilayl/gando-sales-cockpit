import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type CallRecommendationSummary = {
  ACTIONABLE: number;
  OPPORTUNITY: number;
  SNOOZED: number;
  EXCLUDED: number;
};

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

export async function getCallRecommendations(options?: {
  bucket?: keyof CallRecommendationSummary | "ALL";
  owner?: string;
  query?: string;
  limit?: number;
  forceRefresh?: boolean;
}) {
  await ensureFresh(Boolean(options?.forceRefresh));
  const supabase = getSupabaseAdmin();

  const [{ data: recommendationData, error: recommendationError }, { data: contactData, error: contactError }] = await Promise.all([
    supabase.from("call_recommendations").select("*").order("score", { ascending: false }),
    supabase.from("contacts").select("id,hubspot_id,company_id,first_name,last_name,email,phone,job_title,owner_hubspot_id,raw_data"),
  ]);
  if (recommendationError) throw recommendationError;
  if (contactError) throw contactError;

  const recommendations = (recommendationData || []) as RecommendationRow[];
  const contacts = (contactData || []) as ContactRow[];
  const companyIds = [...new Set(contacts.map(contact => contact.company_id).filter((id): id is string => Boolean(id)))];
  let companies: CompanyRow[] = [];
  if (companyIds.length) {
    const { data, error } = await supabase.from("companies").select("id,name").in("id", companyIds);
    if (error) throw error;
    companies = (data || []) as CompanyRow[];
  }

  const contactsById = new Map(contacts.map(contact => [contact.id, contact]));
  const companiesById = new Map(companies.map(company => [company.id, company]));
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
