import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Scope = "today" | "recent";

type CallRow = {
  call_id: string | null;
  started_at: string | null;
  external_number: string | null;
  transcript_text: string | null;
  company_ids: string[] | null;
  contact_ids: string[] | null;
};

type CompanyRow = {
  hubspot_id: string;
  name: string | null;
  domain: string | null;
  prospecting_status: string | null;
  qualification_status: string | null;
  qualification_score: number | null;
  qualification_reason: string | null;
  qualification_next_action_at: string | null;
  qualification_overdue_tasks: number | null;
  qualification_last_call_status: string | null;
};

function parisDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function clip(value: string | null | undefined, max = 520) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function normalize(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export async function buildSalesSnapshot(question: string, scope: Scope = "today") {
  const supabase = getSupabaseAdmin();
  const today = parisDateKey(new Date());
  const { data: recentCalls, error: callsError } = await supabase
    .from("onoff_call_processing")
    .select("call_id,started_at,external_number,transcript_text,company_ids,contact_ids")
    .not("transcript_text", "is", null)
    .order("started_at", { ascending: false })
    .limit(scope === "today" ? 120 : 220);
  if (callsError) throw callsError;

  const allCalls = (recentCalls || []) as CallRow[];
  const scopedCalls = scope === "today"
    ? allCalls.filter(call => call.started_at && parisDateKey(call.started_at) === today)
    : allCalls;

  const companyIds = Array.from(new Set(scopedCalls.flatMap(call => call.company_ids || []).filter(Boolean)));
  let companies: CompanyRow[] = [];
  if (companyIds.length) {
    const { data, error } = await supabase
      .from("companies")
      .select("hubspot_id,name,domain,prospecting_status,qualification_status,qualification_score,qualification_reason,qualification_next_action_at,qualification_overdue_tasks,qualification_last_call_status")
      .in("hubspot_id", companyIds.slice(0, 200));
    if (error) throw error;
    companies = (data || []) as CompanyRow[];
  }

  const companyByHubSpot = new Map(companies.map(company => [String(company.hubspot_id), company]));
  const needle = normalize(question);
  const terms = needle.split(/\s+/).filter(term => term.length >= 3).slice(0, 8);

  const prospects = scopedCalls
    .map(call => {
      const companyId = call.company_ids?.[0];
      const company = companyId ? companyByHubSpot.get(String(companyId)) : undefined;
      const haystack = normalize(`${company?.name || ""} ${company?.domain || ""} ${call.transcript_text || ""}`);
      const relevance = terms.length ? terms.filter(term => haystack.includes(term)).length : 0;
      return {
        callId: call.call_id,
        at: call.started_at,
        companyId: companyId || null,
        company: company?.name || company?.domain || "Entreprise non résolue",
        domain: company?.domain || null,
        status: company?.qualification_status || company?.prospecting_status || null,
        score: company?.qualification_score || 0,
        reason: clip(company?.qualification_reason, 220) || null,
        nextActionAt: company?.qualification_next_action_at || null,
        overdueTasks: company?.qualification_overdue_tasks || 0,
        lastCallStatus: company?.qualification_last_call_status || null,
        said: clip(call.transcript_text, 620),
        relevance,
      };
    })
    .filter((item, index, array) => {
      if (item.companyId) return array.findIndex(other => other.companyId === item.companyId) === index;
      return true;
    })
    .sort((a, b) => {
      if (b.relevance !== a.relevance) return b.relevance - a.relevance;
      if (b.score !== a.score) return b.score - a.score;
      return String(b.at || "").localeCompare(String(a.at || ""));
    })
    .slice(0, 14);

  const { data: dueTasks } = await supabase
    .from("tasks")
    .select("title,status,due_at,assignee_cockpit_email,company_id")
    .neq("status", "COMPLETED")
    .order("due_at", { ascending: true })
    .limit(40);

  const distinctCompanyIds = new Set(scopedCalls.flatMap(call => call.company_ids || []).filter(Boolean));
  const hot = prospects.filter(item => item.score >= 70 || ["Contact établi", "À relancer", "Opportunité", "Démo prévue"].includes(item.status || ""));

  return {
    generatedAt: new Date().toISOString(),
    scope,
    metrics: {
      calls: scopedCalls.length,
      prospectsTouched: distinctCompanyIds.size,
      hotProspects: hot.length,
      overdueTasks: prospects.reduce((sum, item) => sum + Number(item.overdueTasks || 0), 0),
    },
    prospects,
    dueTasks: (dueTasks || []).slice(0, 16).map(task => ({
      title: task.title,
      status: task.status,
      dueAt: task.due_at,
      assignee: task.assignee_cockpit_email,
    })),
  };
}

export async function askInkeepSales(question: string, snapshot: Awaited<ReturnType<typeof buildSalesSnapshot>>) {
  const apiKey = process.env.INKEEP_API_KEY?.trim();
  if (!apiKey) return { configured: false as const, answer: "" };

  const baseUrl = (process.env.INKEEP_BASE_URL || "https://api.inkeep.com/v1").replace(/\/$/, "");
  const model = process.env.INKEEP_MODEL || "inkeep-context-expert";
  const context = {
    date: snapshot.generatedAt,
    metrics: snapshot.metrics,
    prospects: snapshot.prospects.slice(0, 10),
    dueTasks: snapshot.dueTasks.slice(0, 8),
  };

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 900,
      messages: [
        {
          role: "system",
          content: "Tu es le copilote commercial interne de Gando. Réponds en français, de façon courte et opérationnelle. Utilise prioritairement les données CRM/transcriptions fournies. Distingue clairement faits, interprétations et informations manquantes. Ne fabrique jamais ce qu'un prospect aurait dit. Donne les entreprises à prioriser et pourquoi quand c'est pertinent.",
        },
        {
          role: "user",
          content: `${question}\n\nCONTEXTE SALES COCKPIT:\n${JSON.stringify(context)}`,
        },
      ],
    }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || `Inkeep HTTP ${response.status}`);
  }

  const answer = payload?.choices?.[0]?.message?.content;
  return { configured: true as const, answer: typeof answer === "string" ? answer : "Réponse Inkeep vide." };
}
