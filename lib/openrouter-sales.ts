import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveOpenRouterApiKey } from "@/lib/openrouter-key";

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

export async function askOpenRouterSales(question: string, snapshot: Awaited<ReturnType<typeof buildSalesSnapshot>>) {
  const { apiKey } = await resolveOpenRouterApiKey();
  const configuredModel = process.env.OPENROUTER_MODEL?.trim() || "~openai/gpt-latest";
  if (!apiKey) return { configured: false as const, answer: "", model: configuredModel };

  const baseUrl = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
  const context = {
    date: snapshot.generatedAt,
    metrics: snapshot.metrics,
    prospects: snapshot.prospects.slice(0, 10),
    dueTasks: snapshot.dueTasks.slice(0, 8),
  };

  const provider: Record<string, unknown> = {
    allow_fallbacks: true,
    data_collection: "deny",
  };
  if (process.env.OPENROUTER_ZDR?.trim().toLowerCase() === "true") provider.zdr = true;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL?.trim() || "https://room.gando.pro",
      "X-Title": "Gando Sales Cockpit",
    },
    body: JSON.stringify({
      model: configuredModel,
      temperature: 0.2,
      max_completion_tokens: 1200,
      provider,
      messages: [
        {
          role: "system",
          content: [
            "Tu es le copilote commercial interne de Gando.",
            "Réponds en français, de façon courte, structurée et opérationnelle.",
            "Utilise uniquement les données CRM, tâches et transcriptions fournies comme faits.",
            "Distingue clairement les faits observés, tes interprétations et les informations manquantes.",
            "Ne fabrique jamais ce qu'un prospect aurait dit, un intérêt, une objection, une prochaine étape ou un chiffre.",
            "Quand c'est pertinent, classe les entreprises à prioriser et explique en une phrase pourquoi.",
            "Si la question porte sur ce qu'un prospect a dit, cite seulement une reformulation fidèle de la transcription disponible.",
          ].join(" "),
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
    throw new Error(payload?.error?.message || payload?.message || `OpenRouter HTTP ${response.status}`);
  }

  const content = payload?.choices?.[0]?.message?.content;
  const answer = typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((part: any) => part?.text || "").join("\n").trim()
      : "";

  return {
    configured: true as const,
    answer: answer || "Réponse OpenRouter vide.",
    model: String(payload?.model || configuredModel),
  };
}
