"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Clock3,
  FileText,
  Globe2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewCRMNoteButton, AllCRMProperties } from "@/components/crm-record-tools";
import { ProfileSourcingButton } from "@/components/profile-sourcing-button";
import { formatDate } from "@/lib/utils";

type Tab = "overview" | "activity" | "emails" | "calls" | "team" | "notes" | "tasks";
type Props = { recordId: string };
type ActivityItem = {
  id: string;
  type: "note" | "call" | "meeting" | "task";
  title: string;
  detail?: string;
  date?: string | null;
};

const tabs: Array<{ key: Tab; label: string; icon: typeof Mail }> = [
  { key: "overview", label: "Vue d’ensemble", icon: Building2 },
  { key: "activity", label: "Activité", icon: Clock3 },
  { key: "emails", label: "Emails", icon: Mail },
  { key: "calls", label: "Appels", icon: Phone },
  { key: "team", label: "Équipe", icon: Users },
  { key: "notes", label: "Notes", icon: FileText },
  { key: "tasks", label: "Tâches", icon: CheckSquare },
];

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function plainText(value?: string | null) {
  if (!value) return "";
  return decodeHtml(value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function empty(value: unknown, fallback = "Aucune donnée") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function domainHref(domain?: string, website?: string) {
  const value = website || domain || "";
  if (!value) return "";
  return value.startsWith("http") ? value : `https://${value}`;
}

function FieldRow({ icon: Icon, label, children }: { icon: typeof Globe2; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[18px_112px_minmax(0,1fr)] items-start gap-2 py-2.5 text-[13px]">
      <Icon className="mt-0.5 h-4 w-4 text-[#707070]" strokeWidth={1.7} />
      <span className="text-[#5f5f5f]">{label}</span>
      <div className="min-w-0 text-[#202020]">{children}</div>
    </div>
  );
}

function Highlight({ label, value, icon: Icon }: { label: string; value: ReactNode; icon: typeof Users }) {
  return (
    <div className="min-h-[112px] rounded-[14px] border border-[#e6e6e6] bg-white px-4 py-3 shadow-[0_1px_1px_rgba(0,0,0,0.02)]">
      <div className="flex items-center justify-between gap-3 text-[13px] text-[#5c5c5c]">
        <span>{label}</span>
        <Icon className="h-4 w-4 text-[#8a8a8a]" strokeWidth={1.6} />
      </div>
      <div className="mt-7 truncate text-[16px] font-medium text-[#202020]">{value}</div>
    </div>
  );
}

function CountBadge({ value }: { value: number }) {
  return <span className="rounded bg-[#f1f1f1] px-1.5 py-0.5 text-[10px] font-medium text-[#666]">{value}</span>;
}

export function AttioCompanyRecordPage({ recordId }: Props) {
  const [data, setData] = useState<any>(null);
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [response, ownerResponse] = await Promise.all([
        fetch(`/api/companies/${recordId}/centralized`, { cache: "no-store" }),
        fetch("/api/owners", { cache: "no-store" }),
      ]);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossible de charger l’entreprise");
      setData(payload);
      if (ownerResponse.ok) {
        const ownerPayload = await ownerResponse.json();
        setOwners(Object.fromEntries((ownerPayload.results || []).map((owner: any) => [
          owner.id,
          [owner.firstName, owner.lastName].filter(Boolean).join(" ") || owner.email || owner.id,
        ])));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de charger l’entreprise");
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  useEffect(() => { void load(); }, [load]);

  const company = data?.company;
  const p = company?.properties || {};
  const contacts = data?.contacts || [];
  const notes = data?.notes || [];
  const calls = data?.calls || [];
  const meetings = data?.meetings || [];
  const tasks = data?.tasks || [];
  const counts = data?.activitySummary || {
    notes: notes.length,
    calls: calls.length,
    meetings: meetings.length,
    tasks: tasks.length,
    total: notes.length + calls.length + meetings.length + tasks.length,
  };

  const name = p.name || "Entreprise";
  const owner = p.hubspot_owner_id ? owners[p.hubspot_owner_id] || `Owner ${p.hubspot_owner_id}` : "Non assigné";
  const domain = p.domain || p.website || "";
  const website = domainHref(p.domain, p.website);
  const firstEmailContact = contacts.find((contact: any) => contact?.properties?.email);
  const firstPhoneContact = contacts.find((contact: any) => contact?.properties?.phone || contact?.properties?.mobilephone);
  const effectiveEmail = firstEmailContact?.properties?.email || "";
  const effectivePhone = p.phone || firstPhoneContact?.properties?.phone || firstPhoneContact?.properties?.mobilephone || "";

  const activity = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];
    for (const note of notes) {
      const np = note.properties || {};
      items.push({
        id: `note-${note.id}`,
        type: "note",
        title: note.sourceContactName ? `${note.sourceContactName} a ajouté une note` : "Note ajoutée",
        detail: plainText(np.hs_note_body),
        date: np.hs_timestamp || np.hs_createdate || note.createdAt,
      });
    }
    for (const call of calls) {
      const cp = call.properties || {};
      items.push({
        id: `call-${call.id}`,
        type: "call",
        title: cp.hs_call_title || `Appel${call.sourceContactName ? ` · ${call.sourceContactName}` : ""}`,
        detail: plainText(cp.hs_call_summary || cp.hs_call_body),
        date: cp.hs_timestamp,
      });
    }
    for (const meeting of meetings) {
      const mp = meeting.properties || {};
      items.push({
        id: `meeting-${meeting.id}`,
        type: "meeting",
        title: mp.hs_meeting_title || "Rendez-vous",
        detail: plainText(mp.hs_internal_meeting_notes),
        date: meeting.derived?.startAt || mp.hs_meeting_start_time || mp.hs_timestamp,
      });
    }
    for (const task of tasks) {
      const tp = task.properties || {};
      items.push({
        id: `task-${task.id}`,
        type: "task",
        title: tp.hs_task_subject || "Tâche",
        detail: plainText(tp.hs_task_body),
        date: tp.hs_timestamp,
      });
    }
    return items.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [notes, calls, meetings, tasks]);

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-white"><RefreshCw className="h-5 w-5 animate-spin text-[#777]" /></div>;
  }
  if (error) {
    return <div className="min-h-screen bg-white p-8 text-sm text-red-600">{error}</div>;
  }

  const tabCount = (key: Tab) => {
    if (key === "calls") return counts.calls || calls.length;
    if (key === "team") return contacts.length;
    if (key === "notes") return counts.notes || notes.length;
    if (key === "tasks") return counts.tasks || tasks.length;
    if (key === "activity") return counts.total || activity.length;
    if (key === "emails") return contacts.filter((c: any) => c?.properties?.email).length;
    return 0;
  };

  const renderActivity = (limit?: number) => {
    const rows = typeof limit === "number" ? activity.slice(0, limit) : activity;
    if (!rows.length) return <div className="rounded-xl border border-dashed border-[#e3e3e3] p-6 text-sm text-[#777]">Aucune activité enregistrée.</div>;
    return (
      <div className="overflow-hidden rounded-[13px] border border-[#e6e6e6] bg-white">
        {rows.map((item, index) => {
          const Icon = item.type === "call" ? Phone : item.type === "meeting" ? CalendarDays : item.type === "task" ? CheckSquare : FileText;
          return (
            <div key={item.id} className={`flex gap-3 px-4 py-3 ${index ? "border-t border-[#eeeeee]" : ""}`}>
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[#e6e6e6] bg-[#fafafa]">
                <Icon className="h-3.5 w-3.5 text-[#6f6f6f]" strokeWidth={1.6} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="text-[13px] font-medium text-[#252525]">{item.title}</div>
                  <div className="shrink-0 text-[11px] text-[#888]">{item.date ? formatDate(item.date) : "—"}</div>
                </div>
                {item.detail ? <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-[#737373]">{item.detail}</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white text-[#202020]">
      <div className="flex h-12 items-center justify-between border-b border-[#e9e9e9] px-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-[#666]"><Link href="/prospection"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div className="h-5 w-px bg-[#e8e8e8]" />
          <span className="text-[13px] text-[#5f5f5f]">Entreprises</span>
          <span className="text-[13px] text-[#9a9a9a]">/</span>
          <span className="max-w-[260px] truncate text-[13px] font-medium">{name}</span>
        </div>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg text-[12px] text-[#5f5f5f]" onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" /> Actualiser
        </Button>
      </div>

      <div className="grid min-h-[calc(100vh-48px)] grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="border-r border-[#e9e9e9] bg-white">
          <div className="border-b border-[#ededed] px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#e7e7e7] bg-[#fafafa] text-[17px] font-semibold text-[#555]">{name.slice(0, 1).toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-[18px] font-semibold tracking-[-0.02em]">{name}</h1>
                <div className="mt-0.5 truncate text-[12px] text-[#777]">{domain || "Entreprise HubSpot"}</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {effectiveEmail ? <a href={`mailto:${effectiveEmail}`} className="flex h-9 min-w-[160px] flex-1 items-center justify-center gap-2 rounded-lg border border-[#dedede] bg-white px-3 text-[13px] font-medium hover:bg-[#fafafa]"><Mail className="h-4 w-4" /> Composer un email</a> : <div className="flex h-9 min-w-[140px] flex-1 items-center justify-center gap-2 rounded-lg border border-[#dedede] bg-[#fafafa] px-3 text-[13px] text-[#888]"><Mail className="h-4 w-4" /> Pas d’email</div>}
              <NewCRMNoteButton kind="company" recordId={recordId} onCreated={async () => { setTab("notes"); await load(); }} />
              {effectivePhone ? <a href={`tel:${effectivePhone}`} className="grid h-9 w-9 place-items-center rounded-lg border border-[#dedede] text-[#555] hover:bg-[#fafafa]" title="Appeler"><Phone className="h-4 w-4" /></a> : null}
              <ProfileSourcingButton entityType="company" entityId={recordId} onCompleted={load} label="Enrichir" className="h-9" />
            </div>
          </div>

          <div className="border-b border-[#ededed] px-4 py-4">
            <div className="mb-2 flex items-center gap-1 text-[12px] font-medium text-[#5f5f5f]"><span>Détails de l’entreprise</span><ChevronDown className="h-3.5 w-3.5" /></div>
            <div className="divide-y divide-[#f1f1f1]">
              <FieldRow icon={Globe2} label="Domaine">{website ? <a href={website} target="_blank" rel="noreferrer" className="truncate text-[#4f67e8] hover:underline">{domain || p.website}</a> : <span className="text-[#8a8a8a]">Définir une valeur…</span>}</FieldRow>
              <FieldRow icon={Building2} label="Nom"><span className="font-medium">{name}</span></FieldRow>
              <FieldRow icon={FileText} label="Description"><span className="line-clamp-2 text-[#555]">{empty(p.description, "Définir une valeur…")}</span></FieldRow>
              <FieldRow icon={Users} label="Owner"><span>{owner}</span></FieldRow>
              <FieldRow icon={Phone} label="Téléphone"><span>{effectivePhone || "Définir une valeur…"}</span></FieldRow>
              <FieldRow icon={MapPin} label="Localisation"><span>{[p.city, p.state, p.country].filter(Boolean).join(", ") || "Définir une valeur…"}</span></FieldRow>
              <FieldRow icon={Sparkles} label="Secteur"><span>{p.industry || "Définir une valeur…"}</span></FieldRow>
              <FieldRow icon={Users} label="Flotte"><span>{p.taille_flotte || "Définir une valeur…"}</span></FieldRow>
              <FieldRow icon={CheckSquare} label="Prospection"><span>{p.statut_prospection || p.hs_lead_status || "Définir une valeur…"}</span></FieldRow>
            </div>
            <div className="mt-3"><AllCRMProperties kind="company" recordId={recordId} /></div>
          </div>

          <div className="px-4 py-4">
            <div className="mb-3 flex items-center justify-between text-[12px] font-medium text-[#5f5f5f]"><span>Contacts associés</span><span className="text-[#888]">{contacts.length}</span></div>
            {contacts.length ? (
              <div className="space-y-1.5">
                {contacts.slice(0, 6).map((contact: any) => {
                  const cp = contact.properties || {};
                  const contactName = [cp.firstname, cp.lastname].filter(Boolean).join(" ") || cp.email || "Contact";
                  return (
                    <Link key={contact.id} href={`/contacts/${contact.id}`} className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-[#f7f7f7]">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-[#f1f1f1] text-[11px] font-medium text-[#666]">{contactName.slice(0, 1).toUpperCase()}</span>
                      <div className="min-w-0"><div className="truncate text-[12px] font-medium">{contactName}</div><div className="truncate text-[11px] text-[#888]">{cp.jobtitle || cp.email || "Contact"}</div></div>
                    </Link>
                  );
                })}
              </div>
            ) : <div className="text-[12px] text-[#888]">Aucun contact associé.</div>}
          </div>
        </aside>

        <main className="min-w-0 bg-white">
          <div className="flex h-[58px] items-end gap-1 overflow-x-auto border-b border-[#e9e9e9] px-4">
            {tabs.map(({ key, label, icon: Icon }) => {
              const count = tabCount(key);
              return (
                <button key={key} onClick={() => setTab(key)} className={`flex h-[46px] shrink-0 items-center gap-2 border-b-2 px-3 text-[13px] transition-colors ${tab === key ? "border-[#222] text-[#222]" : "border-transparent text-[#666] hover:text-[#222]"}`}>
                  <Icon className="h-4 w-4" strokeWidth={1.6} />
                  <span>{label}</span>
                  {count ? <CountBadge value={count} /> : null}
                </button>
              );
            })}
          </div>

          <div className="mx-auto max-w-[1240px] px-7 py-7">
            {tab === "overview" ? (
              <div className="space-y-9">
                <section>
                  <h2 className="mb-3 text-[16px] font-medium">Points clés</h2>
                  <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                    <Highlight label="Propriétaire" value={owner} icon={Users} />
                    <Highlight label="Prochaine interaction calendrier" value={data?.nextMeeting?.derived?.startAt ? formatDate(data.nextMeeting.derived.startAt) : "Aucune interaction"} icon={CalendarDays} />
                    <Highlight label="Contacts" value={`${contacts.length} associé${contacts.length > 1 ? "s" : ""}`} icon={Users} />
                    <Highlight label="Statut commercial" value={p.statut_prospection || p.hs_lead_status || "Non qualifié"} icon={CheckSquare} />
                    <Highlight label="Taille de flotte" value={p.taille_flotte || "Non renseignée"} icon={Building2} />
                    <Highlight label="Secteur" value={p.industry || "Non renseigné"} icon={Sparkles} />
                  </div>
                </section>

                <section>
                  <div className="mb-3 flex items-center justify-between"><h2 className="text-[16px] font-medium">Activité</h2><button onClick={() => setTab("activity")} className="text-[12px] text-[#666] hover:text-[#222]">Tout voir</button></div>
                  {renderActivity(5)}
                </section>

                <section className="space-y-1">
                  {[{ key: "emails" as Tab, label: "Emails", count: tabCount("emails") }, { key: "notes" as Tab, label: "Notes", count: tabCount("notes") }, { key: "tasks" as Tab, label: "Tâches", count: tabCount("tasks") }].map(row => (
                    <button key={row.key} onClick={() => setTab(row.key)} className="flex w-full items-center justify-between border-b border-[#efefef] px-1 py-4 text-left hover:bg-[#fcfcfc]">
                      <span className="flex items-center gap-2 text-[14px] text-[#505050]">{row.label}<CountBadge value={row.count} /></span>
                      <span className="text-[19px] font-light text-[#8a8a8a]">+</span>
                    </button>
                  ))}
                </section>
              </div>
            ) : null}

            {tab === "activity" ? <section><div className="mb-4"><h2 className="text-[18px] font-medium">Activité</h2><p className="mt-1 text-[12px] text-[#777]">Historique consolidé HubSpot de l’entreprise et de ses contacts.</p></div>{renderActivity()}</section> : null}

            {tab === "emails" ? (
              <section>
                <div className="mb-4 flex items-center justify-between"><div><h2 className="text-[18px] font-medium">Emails</h2><p className="mt-1 text-[12px] text-[#777]">Contacts de l’entreprise disposant d’un email.</p></div>{effectiveEmail ? <a href={`mailto:${effectiveEmail}`} className="rounded-lg border border-[#dedede] px-3 py-2 text-[12px] font-medium hover:bg-[#fafafa]">Composer</a> : null}</div>
                <div className="overflow-hidden rounded-xl border border-[#e6e6e6]">{contacts.filter((c: any) => c?.properties?.email).map((contact: any, index: number) => { const cp = contact.properties || {}; const contactName = [cp.firstname, cp.lastname].filter(Boolean).join(" ") || cp.email; return <div key={contact.id} className={`flex items-center justify-between gap-4 px-4 py-3 ${index ? "border-t border-[#ededed]" : ""}`}><div><div className="text-[13px] font-medium">{contactName}</div><div className="mt-0.5 text-[12px] text-[#777]">{cp.jobtitle || "Contact"}</div></div><a href={`mailto:${cp.email}`} className="text-[12px] text-[#4f67e8] hover:underline">{cp.email}</a></div>; })}{!tabCount("emails") ? <div className="p-5 text-[13px] text-[#777]">Aucun email disponible.</div> : null}</div>
              </section>
            ) : null}

            {tab === "calls" ? (
              <section><div className="mb-4"><h2 className="text-[18px] font-medium">Appels</h2><p className="mt-1 text-[12px] text-[#777]">{calls.length} appel{calls.length > 1 ? "s" : ""} lié{calls.length > 1 ? "s" : ""} à cette entreprise.</p></div>{calls.length ? <div className="space-y-2">{calls.map((call: any) => { const cp = call.properties || {}; return <div key={call.id} className="rounded-xl border border-[#e6e6e6] px-4 py-3"><div className="flex items-start justify-between gap-4"><div><div className="text-[13px] font-medium">{cp.hs_call_title || "Appel"}</div><div className="mt-1 text-[12px] text-[#777]">{call.sourceContactName || cp.hs_call_status || "Entreprise"}</div></div><div className="text-[11px] text-[#888]">{cp.hs_timestamp ? formatDate(cp.hs_timestamp) : "—"}</div></div>{plainText(cp.hs_call_summary || cp.hs_call_body) ? <div className="mt-2 text-[12px] leading-5 text-[#666]">{plainText(cp.hs_call_summary || cp.hs_call_body)}</div> : null}</div>; })}</div> : <div className="text-[13px] text-[#777]">Aucun appel.</div>}</section>
            ) : null}

            {tab === "team" ? (
              <section><div className="mb-4"><h2 className="text-[18px] font-medium">Équipe</h2><p className="mt-1 text-[12px] text-[#777]">Contacts associés à {name}.</p></div><div className="grid gap-2 md:grid-cols-2">{contacts.map((contact: any) => { const cp = contact.properties || {}; const contactName = [cp.firstname, cp.lastname].filter(Boolean).join(" ") || cp.email || "Contact"; return <Link key={contact.id} href={`/contacts/${contact.id}`} className="rounded-xl border border-[#e6e6e6] p-4 hover:bg-[#fafafa]"><div className="text-[13px] font-medium">{contactName}</div><div className="mt-1 text-[12px] text-[#777]">{cp.jobtitle || "Contact"}</div><div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[#666]">{cp.email ? <span>{cp.email}</span> : null}{cp.phone || cp.mobilephone ? <span>{cp.phone || cp.mobilephone}</span> : null}</div></Link>; })}{!contacts.length ? <div className="text-[13px] text-[#777]">Aucun contact associé.</div> : null}</div></section>
            ) : null}

            {tab === "notes" ? (
              <section><div className="mb-4 flex items-center justify-between"><div><h2 className="text-[18px] font-medium">Notes</h2><p className="mt-1 text-[12px] text-[#777]">Notes de l’entreprise et de ses contacts associés.</p></div><NewCRMNoteButton kind="company" recordId={recordId} onCreated={load} /></div><div className="space-y-2">{notes.map((note: any) => { const np = note.properties || {}; return <div key={note.id} className="rounded-xl border border-[#e6e6e6] p-4"><div className="flex items-start justify-between gap-4"><div className="text-[12px] font-medium">{note.sourceContactName || "Entreprise"}</div><div className="text-[11px] text-[#888]">{np.hs_timestamp || np.hs_createdate ? formatDate(np.hs_timestamp || np.hs_createdate) : "—"}</div></div><div className="mt-2 text-[13px] leading-6 text-[#555]">{plainText(np.hs_note_body) || "Note vide."}</div></div>; })}{!notes.length ? <div className="text-[13px] text-[#777]">Aucune note.</div> : null}</div></section>
            ) : null}

            {tab === "tasks" ? (
              <section><div className="mb-4"><h2 className="text-[18px] font-medium">Tâches</h2><p className="mt-1 text-[12px] text-[#777]">Tâches HubSpot liées à cette entreprise.</p></div><div className="space-y-2">{tasks.map((task: any) => { const tp = task.properties || {}; return <div key={task.id} className="rounded-xl border border-[#e6e6e6] p-4"><div className="flex items-start justify-between gap-4"><div><div className="text-[13px] font-medium">{tp.hs_task_subject || "Tâche"}</div><div className="mt-1 text-[12px] text-[#777]">{tp.hs_task_status || "À traiter"}{tp.hs_task_priority ? ` · ${tp.hs_task_priority}` : ""}</div></div><div className="text-[11px] text-[#888]">{tp.hs_timestamp ? formatDate(tp.hs_timestamp) : "—"}</div></div>{plainText(tp.hs_task_body) ? <div className="mt-2 text-[12px] leading-5 text-[#666]">{plainText(tp.hs_task_body)}</div> : null}</div>; })}{!tasks.length ? <div className="text-[13px] text-[#777]">Aucune tâche.</div> : null}</div></section>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
