from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise RuntimeError(f"Expected snippet not found in {path}: {old[:100]!r}")
    file.write_text(text.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str) -> None:
    file = Path(path)
    text = file.read_text()
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"Expected one regex match in {path}, found {count}: {pattern[:100]!r}")
    file.write_text(updated)


# Today: render critical data first, dedupe short-lived GETs, ignore stale loads,
# keep existing UI visible while refreshing, and always prefer the canonical contact phone.
today = "components/today-dialer-view.tsx"
replace_once(today, 'import { useEffect, useMemo, useState } from "react";', 'import { useEffect, useMemo, useRef, useState } from "react";')
replace_once(today, 'import { Button } from "@/components/ui/button";\n', 'import { Button } from "@/components/ui/button";\nimport { fetchJsonCached, invalidateJsonCache } from "@/lib/client-query-cache";\n')
replace_once(today, 'return String(contact?.properties.mobilephone || contact?.properties.phone || "").trim();', 'return String(contact?.properties.phone || contact?.properties.mobilephone || "").trim();')
replace_once(today, '  const [loading, setLoading] = useState(true);\n', '  const [loading, setLoading] = useState(true);\n  const [refreshing, setRefreshing] = useState(false);\n')
replace_once(today, '  const [sessionCompany, setSessionCompany] = useState<Company | null>(null);\n\n  async function load()', '  const [sessionCompany, setSessionCompany] = useState<Company | null>(null);\n  const loadSequenceRef = useRef(0);\n  const loadedOnceRef = useRef(false);\n\n  async function load()')

regex_once(
    today,
    r'  async function load\(\) \{.*?\n  \}\n\n  useEffect\(\(\) => \{ void load\(\); \}, \[\]\);',
    '''  async function load(force = false) {
    const sequence = ++loadSequenceRef.current;
    if (loadedOnceRef.current) setRefreshing(true);
    else setLoading(true);
    setMessage("");

    const range = dayRange();
    const agendaUrl = `/api/agenda?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`;
    const auxiliaryPromise = Promise.allSettled([
      fetchJsonCached<OnoffStatus>("/api/onoff/status", { ttlMs: 30_000, force }),
      fetchJsonCached<{ results?: Task[] }>("/api/tasks?period=today", { ttlMs: 10_000, force }),
      fetchJsonCached<{ results?: Task[] }>("/api/tasks?period=overdue", { ttlMs: 10_000, force }),
      fetchJsonCached<AgendaPayload>(agendaUrl, { ttlMs: 10_000, force }),
    ]);

    try {
      // The call queue is the critical payload: show it as soon as it is ready instead
      // of blocking the whole screen on tasks, agenda and telephony status.
      const todayPayload = await fetchJsonCached<TodayPayload>("/api/today", { ttlMs: 10_000, force });
      if (sequence !== loadSequenceRef.current) return;

      setToday(todayPayload);
      const first = todayPayload.results?.[0];
      setSelectedId(current => current && todayPayload.results?.some((item: Contact) => item.id === current) ? current : first?.id || null);
      loadedOnceRef.current = true;
      setLoading(false);

      const [onoffResult, todayTasksResult, overdueTasksResult, agendaResult] = await auxiliaryPromise;
      if (sequence !== loadSequenceRef.current) return;
      if (onoffResult.status === "fulfilled") setOnoff(onoffResult.value);
      if (todayTasksResult.status === "fulfilled") setTodayTasks(todayTasksResult.value.results || []);
      if (overdueTasksResult.status === "fulfilled") setOverdueTasks(overdueTasksResult.value.results || []);
      if (agendaResult.status === "fulfilled") setAgenda(agendaResult.value);
    } catch (error) {
      if (sequence === loadSequenceRef.current) {
        setMessage(error instanceof Error ? error.message : "Erreur de chargement");
      }
    } finally {
      if (sequence === loadSequenceRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }

  useEffect(() => {
    void load(false);
    return () => { loadSequenceRef.current += 1; };
  }, []);'''
)
replace_once(today, '      setOverdueTasks(current => current.filter(task => task.id !== taskId));\n', '      setOverdueTasks(current => current.filter(task => task.id !== taskId));\n      invalidateJsonCache("/api/tasks");\n      invalidateJsonCache("/api/agenda");\n')
replace_once(
    today,
    '''      const response = await fetch(`/api/contacts/${encodeURIComponent(contact.id)}/centralized`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Impossible de retrouver l’entreprise associée à ce lead.");''',
    '''      const payload = await fetchJsonCached<any>(`/api/contacts/${encodeURIComponent(contact.id)}/centralized`, { ttlMs: 5 * 60_000 });'''
)
replace_once(
    today,
    '''    const response = await fetch(`/api/prospection/company-id/${encodeURIComponent(candidate)}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Impossible de résoudre l’identifiant HubSpot de cette entreprise.");''',
    '''    const payload = await fetchJsonCached<any>(`/api/prospection/company-id/${encodeURIComponent(candidate)}`, { ttlMs: 5 * 60_000 });'''
)
replace_once(today, 'onClick={() => void load()} disabled={loading}', 'onClick={() => void load(true)} disabled={loading || refreshing}')
replace_once(today, '{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Actualiser', '{loading || refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Actualiser')


# Prospection: avoid the double initial fetch, do not refetch when only switching view,
# cache stable metadata, and prevent an older request from overwriting newer filters.
prospection = "components/prospection-view.tsx"
replace_once(prospection, 'import { useEffect, useMemo, useState } from "react";', 'import { useEffect, useMemo, useRef, useState } from "react";')
replace_once(prospection, 'import { formatDate, initials } from "@/lib/utils";\n', 'import { formatDate, initials } from "@/lib/utils";\nimport { fetchJsonCached } from "@/lib/client-query-cache";\n')
replace_once(prospection, '  const [customEnd, setCustomEnd] = useState("");\n', '  const [customEnd, setCustomEnd] = useState("");\n  const [metadataReady, setMetadataReady] = useState(false);\n  const loadRequestRef = useRef(0);\n')

regex_once(
    prospection,
    r'  useEffect\(\(\) => \{\n    Promise\.all\(\[fetch\("/api/segments"\).*?\n  \}, \[\]\);',
    '''  useEffect(() => {
    let active = true;
    Promise.all([
      fetchJsonCached<any>("/api/segments", { ttlMs: 60_000 }),
      fetchJsonCached<any>("/api/owners", { ttlMs: 60_000 }),
    ])
      .then(([l, o]) => {
        if (!active) return;
        const allLists = (l.lists || []) as List[];
        setLists(allLists);
        setOwners(o.results || []);
        const companyLists = allLists.filter(x => x.objectTypeId === "0-2");
        const contactLists = allLists.filter(x => x.objectTypeId === "0-1");
        if (companyLists.length) {
          setObjectType("0-2");
          setSegmentId(companyLists[0].listId);
        } else {
          setObjectType("0-1");
          const teori = contactLists.find(x => x.name.toLowerCase().includes("teori"));
          setSegmentId(teori ? teori.listId : contactLists[0]?.listId ?? "");
        }
      })
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : "Impossible de charger les filtres de prospection");
      })
      .finally(() => { if (active) setMetadataReady(true); });
    return () => { active = false; };
  }, []);'''
)

replace_once(prospection, '  async function loadContacts(reset = false, cursor?: string, silent = false) {\n    if (!silent) setLoading(true);', '  async function loadContacts(reset = false, cursor?: string, silent = false) {\n    const requestId = ++loadRequestRef.current;\n    if (!silent) setLoading(true);')
replace_once(prospection, '      setContacts(rows);\n      setTotal(d.total || rows.length);\n      setNextAfter(d.paging?.next?.after);\n    } catch (e) {\n      setError(e instanceof Error ? e.message : "Erreur");\n    } finally {\n      if (!silent) setLoading(false);\n    }\n  }', '      if (requestId !== loadRequestRef.current) return;\n      setContacts(rows);\n      setTotal(d.total || rows.length);\n      setNextAfter(d.paging?.next?.after);\n    } catch (e) {\n      if (requestId === loadRequestRef.current) setError(e instanceof Error ? e.message : "Erreur");\n    } finally {\n      if (requestId === loadRequestRef.current) setLoading(false);\n    }\n  }')
replace_once(prospection, '  async function loadCompanies(reset = false, cursor?: string, silent = false) {\n    if (!silent) setLoading(true);', '  async function loadCompanies(reset = false, cursor?: string, silent = false) {\n    const requestId = ++loadRequestRef.current;\n    if (!silent) setLoading(true);')
replace_once(prospection, '      setCompanies(rows);\n      setTotal(d.total || rows.length);\n      setNextAfter(d.paging?.next?.after);\n    } catch (e) {\n      setError(e instanceof Error ? e.message : "Erreur");\n    } finally {\n      if (!silent) setLoading(false);\n    }\n  }', '      if (requestId !== loadRequestRef.current) return;\n      setCompanies(rows);\n      setTotal(d.total || rows.length);\n      setNextAfter(d.paging?.next?.after);\n    } catch (e) {\n      if (requestId === loadRequestRef.current) setError(e instanceof Error ? e.message : "Erreur");\n    } finally {\n      if (requestId === loadRequestRef.current) setLoading(false);\n    }\n  }')
replace_once(
    prospection,
    '  useEffect(() => { load(true); }, [objectType, segmentId, owner, callStatus, prospection, periodRange, view]);\n  useEffect(() => { const t = setTimeout(() => load(true), 300); return () => clearTimeout(t); }, [q]);',
    '  useEffect(() => {\n    if (!metadataReady) return;\n    const timeout = window.setTimeout(() => { void load(true); }, q ? 300 : 0);\n    return () => window.clearTimeout(timeout);\n  }, [metadataReady, objectType, segmentId, owner, callStatus, prospection, periodRange, q]);'
)


# Recommendations: dedupe concurrent refreshes and stop downloading the entire contacts table
# for every request. The summary is now a tiny bucket-only query; detailed contacts are scoped
# to the requested recommendation bucket.
recommendations = "lib/call-recommendations.ts"
replace_once(
    recommendations,
    '''export async function refreshCallRecommendations() {
  const { data, error } = await getSupabaseAdmin().rpc("refresh_call_recommendations");
  if (error) throw error;
  return Number(data || 0);
}

async function ensureFresh(force = false) {''',
    '''let refreshInFlight: Promise<number> | null = null;

export async function refreshCallRecommendations() {
  const { data, error } = await getSupabaseAdmin().rpc("refresh_call_recommendations");
  if (error) throw error;
  return Number(data || 0);
}

function sharedRecommendationRefresh() {
  if (!refreshInFlight) {
    refreshInFlight = refreshCallRecommendations().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

async function ensureFresh(force = false) {'''
)
replace_once(recommendations, '  await refreshCallRecommendations();\n}\n\nfunction activeOverride', '  await sharedRecommendationRefresh();\n}\n\nfunction activeOverride')

regex_once(
    recommendations,
    r'export async function getCallRecommendations\(options\?: \{.*?\n\}\n\nexport async function setCallRecommendationDecision',
    '''export async function getCallRecommendations(options?: {
  bucket?: keyof CallRecommendationSummary | "ALL";
  owner?: string;
  query?: string;
  limit?: number;
  forceRefresh?: boolean;
}) {
  await ensureFresh(Boolean(options?.forceRefresh));
  const supabase = getSupabaseAdmin();
  const bucket = options?.bucket || "ACTIONABLE";
  const owner = options?.owner?.trim();
  const needle = options?.query?.trim().toLowerCase();
  const limit = Math.min(Math.max(options?.limit || 1000, 1), 2000);

  let recommendationQuery = supabase
    .from("call_recommendations")
    .select("contact_id,hubspot_contact_id,score,priority_label,bucket,reason,recommended_action,call_status,prospecting_status,prospecting_result,next_follow_up_at,last_contacted_at,last_call_at,overdue_tasks,evaluated_at")
    .order("score", { ascending: false });
  if (bucket !== "ALL") recommendationQuery = recommendationQuery.eq("bucket", bucket);

  const [recommendationResult, summaryResult, overrideResult] = await Promise.all([
    recommendationQuery,
    supabase.from("call_recommendations").select("bucket"),
    supabase.from("call_recommendation_overrides").select("contact_id,decision,snoozed_until,reason,updated_at"),
  ]);
  if (recommendationResult.error) throw recommendationResult.error;
  if (summaryResult.error) throw summaryResult.error;
  if (overrideResult.error) throw overrideResult.error;

  const recommendations = (recommendationResult.data || []) as RecommendationRow[];
  const overrides = (overrideResult.data || []) as OverrideRow[];
  const summary = (summaryResult.data || []).reduce<CallRecommendationSummary>((acc, row) => {
    const key = row.bucket as keyof CallRecommendationSummary;
    if (key in acc) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, { ...EMPTY_SUMMARY });

  const recommendationIds = [...new Set(recommendations.map(row => row.contact_id).filter(Boolean))];
  const chunks = <T,>(values: T[], size = 150) => Array.from(
    { length: Math.ceil(values.length / size) },
    (_, index) => values.slice(index * size, (index + 1) * size),
  );
  const contactResponses = await Promise.all(chunks(recommendationIds).map(ids => supabase
    .from("contacts")
    .select("id,hubspot_id,company_id,first_name,last_name,email,phone,job_title,owner_hubspot_id,raw_data")
    .in("id", ids)));
  for (const response of contactResponses) if (response.error) throw response.error;
  const contacts = contactResponses.flatMap(response => (response.data || [])) as ContactRow[];

  const companyIds = [...new Set(contacts.map(contact => contact.company_id).filter((id): id is string => Boolean(id)))];
  const companyResponses = await Promise.all(chunks(companyIds).map(ids => supabase
    .from("companies")
    .select("id,name")
    .in("id", ids)));
  for (const response of companyResponses) if (response.error) throw response.error;
  const companies = companyResponses.flatMap(response => (response.data || [])) as CompanyRow[];

  const contactsById = new Map(contacts.map(contact => [contact.id, contact]));
  const companiesById = new Map(companies.map(company => [company.id, company]));
  const overridesByContactId = new Map(overrides.map(row => [row.contact_id, row]));

  const filtered = recommendations
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
        db_company_id: contact.company_id || undefined,
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

  const total = bucket === "ALL"
    ? Object.values(summary).reduce((sum, value) => sum + value, 0)
    : summary[bucket];
  return {
    results: filtered,
    total,
    summary,
    evaluatedAt: recommendations[0]?.evaluated_at || null,
  };
}

export async function setCallRecommendationDecision'''
)

print("Performance refactor applied")
