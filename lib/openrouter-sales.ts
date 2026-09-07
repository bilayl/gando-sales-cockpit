import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveOpenRouterApiKey } from "@/lib/openrouter-key";
import {
  executeSalesAgentTool,
  OPENROUTER_SALES_TOOLS,
  SALES_AGENT_TOOL_NAMES,
  type SalesAgentToolName,
} from "@/lib/sales-agent-tools";

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

function isSalesAgentToolName(value: unknown): value is SalesAgentToolName {
  return SALES_AGENT_TOOL_NAMES.includes(String(value) as SalesAgentToolName);
}

function writeToolAllowed(question: string, tool: SalesAgentToolName) {
  const normalizedQuestion = normalize(question);
  if (tool === "schedule_call_reminder") {
    return /(programme|planifie|rappel|rappelle|reporte|relance)/.test(normalizedQuestion);
  }
  if (tool === "record_call_outcome") {
    return /(nrp|occupe|a rappeler|interesse|rdv|pas interesse|hors cible|numero invalide|appel|repondu)/.test(normalizedQuestion);
  }
  return true;
}

export async function askOpenRouterSales(
  question: string,
  snapshot: Awaited<ReturnType<typeof buildSalesSnapshot>>,
  actor?: string | null,
) {
  const { apiKey } = await resolveOpenRouterApiKey();
  const configuredModel = process.env.OPENROUTER_MODEL?.trim() || "~openai/gpt-latest";
  const freeFallbackModel = "openrouter/free";
  if (!apiKey) return { configured: false as const, answer: "", model: configuredModel, actions: [] };

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

  const messages: any[] = [
    {
      role: "system",
      content: [
        "Tu es le copilote commercial interne de Gando.",
        "Réponds en français, de façon courte, structurée et opérationnelle.",
        "Utilise les tools disponibles lorsque leur donnée est nécessaire au lieu d'inventer une information.",
        "Pour savoir qui appeler maintenant, appelle get_today_sales_queue et respecte timing.callNow et le fuseau local.",
        "Utilise uniquement les données CRM, tâches, transcriptions et résultats de tools comme faits.",
        "Distingue clairement les faits observés, tes interprétations et les informations manquantes.",
        "Ne fabrique jamais ce qu'un prospect aurait dit, un intérêt, une objection, une prochaine étape ou un chiffre.",
        "N'appelle schedule_call_reminder que sur demande explicite de l'utilisateur.",
        "N'appelle record_call_outcome que si l'utilisateur fournit explicitement le résultat réel d'un appel.",
        "Quand c'est pertinent, classe les entreprises à prioriser et explique en une phrase pourquoi.",
      ].join(" "),
    },
    {
      role: "user",
      content: `${question}\n\nCONTEXTE SALES COCKPIT:\n${JSON.stringify(context)}`,
    },
  ];

  async function requestModel(model: string) {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL?.trim() || "https://room.gando.pro",
        "X-Title": "Gando Sales Cockpit",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_completion_tokens: 1200,
        provider,
        messages,
        tools: OPENROUTER_SALES_TOOLS,
        tool_choice: "auto",
      }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  }

  let usedModel = configuredModel;
  let fallbackUsed = false;
  const actions: Array<{ tool: string; ok: boolean; result?: unknown; error?: string }> = [];

  for (let round = 0; round < 5; round += 1) {
    let { response, payload } = await requestModel(usedModel);

    if (!response.ok && usedModel !== freeFallbackModel) {
      const errorMessage = String(payload?.error?.message || payload?.message || "").toLowerCase();
      const insufficientCredits = response.status === 402 || errorMessage.includes("insufficient credits") || errorMessage.includes("purchase credits");
      if (insufficientCredits) {
        usedModel = freeFallbackModel;
        fallbackUsed = true;
        ({ response, payload } = await requestModel(usedModel));
      }
    }

    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || `OpenRouter HTTP ${response.status}`);
    }

    const assistantMessage = payload?.choices?.[0]?.message || {};
    const toolCalls = Array.isArray(assistantMessage.tool_calls) ? assistantMessage.tool_calls : [];
    if (!toolCalls.length) {
      const content = assistantMessage.content;
      const answer = typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((part: any) => part?.text || "").join("\n").trim()
          : "";
      return {
        configured: true as const,
        answer: answer || "Réponse OpenRouter vide.",
        model: String(payload?.model || usedModel),
        fallbackUsed,
        actions,
      };
    }

    messages.push({
      role: "assistant",
      content: assistantMessage.content || null,
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      const name = call?.function?.name;
      let result: unknown;
      let ok = false;
      let errorMessage = "";
      try {
        if (!isSalesAgentToolName(name)) throw new Error(`Tool non autorisé: ${String(name || "")}`);
        if (!writeToolAllowed(question, name)) throw new Error("Action d'écriture refusée : demande utilisateur explicite requise.");
        const args = JSON.parse(String(call?.function?.arguments || "{}"));
        result = await executeSalesAgentTool(name, args, actor);
        ok = true;
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : "Erreur tool inconnue";
        result = { error: errorMessage };
      }
      actions.push({ tool: String(name || "unknown"), ok, result: ok ? result : undefined, error: ok ? undefined : errorMessage });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  throw new Error("L'assistant a dépassé le nombre maximal d'actions autorisées pour une requête.");
}
