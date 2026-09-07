"use client";

import { useEffect, useMemo, useState } from "react";
import { Briefcase, CalendarClock, ExternalLink, FileText, Globe, History, ListTodo, Loader2, Mail, MapPin, Phone, PhoneCall, UserRound, Users } from "lucide-react";
import { AiCallPrep } from "@/components/ai-call-prep";
import { PostCallEmailButton } from "@/components/post-call-email-button";
import { QualificationProperties } from "@/components/qualification-properties";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildCallObjectionCoach } from "@/lib/call-objection-coach";

type Company = { id: string; properties: Record<string, string | null | undefined> };

type Props = {
  companyId: string;
  fallbackCompany: Company;
  onOpenCompany: (companyId: string) => void;
};

function formatDateTime(value?: string | null) {
  if (!value) return "Pas d’échéance";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pas d’échéance";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function plainText(value?: string | null) {
  return value?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "";
}

function activityDate(item: any) {
  if (item.type === "meeting") return item.record?.derived?.startAt || item.record?.properties?.hs_timestamp;
  return item.record?.properties?.hs_timestamp || item.record?.properties?.hs_createdate;
}

function activityTitle(item: any) {
  const p = item.record?.properties || {};
  if (item.type === "meeting") return p.hs_meeting_title || "Rendez-vous";
  if (item.type === "call") return p.hs_call_title || "Appel";
  if (item.type === "task") return p.hs_task_subject || "Tâche";
  return "Note HubSpot";
}

function activityBody(item: any) {
  const p = item.record?.properties || {};
  if (item.type === "meeting") return p.hs_internal_meeting_notes || p.hs_meeting_location;
  if (item.type === "call") return p.hs_call_summary || p.hs_call_body;
  if (item.type === "task") return p.hs_task_body;
  return p.hs_note_body;
}

function ActivityIcon({ type }: { type: string }) {
  if (type === "meeting") return <CalendarClock size={13} />;
  if (type === "call") return <PhoneCall size={13} />;
  if (type === "task") return <ListTodo size={13} />;
  return <FileText size={13} />;
}

export function CompanyCallPrepPanel({ companyId, fallbackCompany, onOpenCompany }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setLoading(true);
    setError("");
    fetch(`/api/companies/${companyId}/centralized`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Impossible de charger la fiche entreprise");
        setData(body);
      })
      .catch(reason => {
        if ((reason as Error).name !== "AbortError") setError(reason instanceof Error ? reason.message : "Impossible de charger la fiche entreprise");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [companyId]);

  const p = data?.company?.properties || fallbackCompany.properties;
  const contacts = data?.contacts || [];
  const emailContact = contacts.find((contact: any) => contact?.properties?.email) || contacts[0] || null;
  const referenceContact = emailContact?.properties || contacts[0]?.properties || {};
  const nextMeeting = data?.nextMeeting || null;
  const coach = useMemo(() => buildCallObjectionCoach({
    properties: { ...p, ...referenceContact },
    notes: data?.notes || [],
    calls: data?.calls || [],
  }), [data, p, referenceContact]);
  const latestCall = coach.latestCall;
  const latestCallProperties = latestCall?.properties || {};
  const email = referenceContact.email || p.email || "";
  const contactName = [referenceContact.firstname, referenceContact.lastname].filter(Boolean).join(" ") || email || "Contact à qualifier";

  const timeline = useMemo(() => {
    if (!data) return [];
    const items = [
      ...(data.meetings || []).map((record: any) => ({ type: "meeting", record })),
      ...(data.notes || []).map((record: any) => ({ type: "note", record })),
      ...(data.calls || []).map((record: any) => ({ type: "call", record })),
      ...(data.tasks || []).map((record: any) => ({ type: "task", record })),
    ];
    return items.sort((a, b) => new Date(activityDate(b) || 0).getTime() - new Date(activityDate(a) || 0).getTime());
  }, [data]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Préparation IA de l’appel</div>
          <h2 className="mt-1 truncate text-lg font-bold tracking-tight">{p.name || p.domain || "Entreprise"}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {p.domain ? <span className="inline-flex items-center gap-1"><Globe size={12} />{p.domain}</span> : null}
            {[p.city, p.country].filter(Boolean).length ? <span className="inline-flex items-center gap-1"><MapPin size={12} />{[p.city, p.country].filter(Boolean).join(", ")}</span> : null}
            {email ? <span className="inline-flex min-w-0 items-center gap-1 text-primary"><Mail size={12} /><span className="truncate">{email}</span></span> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <PostCallEmailButton
            contactId={emailContact?.id ? String(emailContact.id) : undefined}
            callId={latestCall?.id ? String(latestCall.id) : undefined}
            email={email}
            firstName={referenceContact.firstname || undefined}
            companyName={p.name || ""}
            callTitle={latestCallProperties.hs_call_title || undefined}
            callBody={latestCallProperties.hs_call_body || latestCallProperties.hs_call_summary || undefined}
            transcription={coach.transcript}
            buttonLabel="Générer un email"
            buttonClassName="h-9 gap-1.5"
          />
          <Button variant="outline" size="sm" onClick={() => onOpenCompany(companyId)}><ExternalLink size={14} /> Fiche complète</Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5 minari-scrollbar">
        {loading ? (
          <div className="grid h-64 place-items-center"><Loader2 className="animate-spin text-primary" /></div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-lg border border-border bg-muted/30 p-3"><div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground"><Phone size={11} /> Téléphone</div><div className="mt-1 truncate text-sm font-semibold">{p.phone || referenceContact.phone || referenceContact.mobilephone || "—"}</div></div>
              <div className="rounded-lg border border-border bg-muted/30 p-3"><div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground"><Mail size={11} /> Email</div><div className="mt-1 truncate text-sm font-semibold">{email || "À renseigner"}</div></div>
              <div className="rounded-lg border border-border bg-muted/30 p-3"><div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground"><Briefcase size={11} /> Secteur</div><div className="mt-1 truncate text-sm font-semibold">{p.industry || "—"}</div></div>
              <div className="rounded-lg border border-border bg-muted/30 p-3"><div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground"><Users size={11} /> Contact préparé</div><div className="mt-1 truncate text-sm font-semibold">{contactName}</div></div>
              <div className="rounded-lg border border-border bg-muted/30 p-3"><div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground"><History size={11} /> Activités</div><div className="mt-1 text-sm font-semibold">{data?.activitySummary?.total ?? timeline.length}</div></div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(p.phone || referenceContact.phone || referenceContact.mobilephone) ? <Button asChild size="sm"><a href={`tel:${p.phone || referenceContact.phone || referenceContact.mobilephone}`}><Phone size={14} /> Appeler</a></Button> : null}
              {email ? <Button asChild size="sm" variant="outline"><a href={`mailto:${email}`}><Mail size={14} /> Email</a></Button> : null}
              {p.domain ? <Button asChild size="sm" variant="outline"><a href={`https://${p.domain}`} target="_blank" rel="noreferrer"><Globe size={14} /> Site web</a></Button> : null}
            </div>

            <AiCallPrep
              context={data}
              companyId={companyId}
              contactId={emailContact?.id ? String(emailContact.id) : undefined}
            />

            {nextMeeting ? (
              <section>
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Prochain rendez-vous</div>
                <div className="mt-2 rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
                  <div className="font-semibold">{nextMeeting.properties?.hs_meeting_title || "Rendez-vous"}</div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><CalendarClock size={12} />{formatDateTime(nextMeeting.derived?.startAt)}</span>
                    {nextMeeting.sourceContactName ? <span className="inline-flex items-center gap-1"><UserRound size={12} />{nextMeeting.sourceContactName}</span> : null}
                  </div>
                </div>
              </section>
            ) : null}

            <QualificationProperties kind="company" properties={p} fallbackProperties={referenceContact} />

            <section>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Contacts associés</div>
                <Badge variant="secondary">{contacts.length}</Badge>
              </div>
              <div className="mt-2 grid gap-2 xl:grid-cols-2">
                {contacts.map((contact: any) => {
                  const cp = contact.properties || {};
                  const name = [cp.firstname, cp.lastname].filter(Boolean).join(" ") || cp.email || "Contact";
                  const phone = cp.phone || cp.mobilephone;
                  return (
                    <div key={contact.id} className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{name}</div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">{cp.jobtitle || cp.statut_prospection || "Contact HubSpot"}</div>
                        </div>
                        {cp.statut_prospection ? <Badge variant="outline" className="shrink-0 text-[10px]">{cp.statut_prospection}</Badge> : null}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {phone ? <a href={`tel:${phone}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Phone size={11} />{phone}</a> : null}
                        {cp.email ? <a href={`mailto:${cp.email}`} className="inline-flex min-w-0 items-center gap-1 text-primary hover:underline"><Mail size={11} /><span className="truncate">{cp.email}</span></a> : null}
                      </div>
                    </div>
                  );
                })}
                {!contacts.length ? <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground xl:col-span-2">Aucun contact associé à cette entreprise dans HubSpot.</div> : null}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Historique centralisé HubSpot</div>
                <Badge variant="secondary">{timeline.length}</Badge>
              </div>
              <div className="mt-2 space-y-2">
                {timeline.slice(0, 12).map((item: any) => {
                  const date = activityDate(item);
                  const body = plainText(activityBody(item));
                  return (
                    <div key={`${item.type}-${item.record.id}`} className="flex gap-3 rounded-lg border border-border bg-card p-3">
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/[0.08] text-primary"><ActivityIcon type={item.type} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="truncate text-sm font-semibold">{activityTitle(item)}</div>
                          <div className="shrink-0 text-[10px] text-muted-foreground">{date ? formatDateTime(date) : "—"}</div>
                        </div>
                        {item.record?.sourceContactName ? <div className="mt-0.5 text-[10px] text-muted-foreground">Via {item.record.sourceContactName}</div> : null}
                        {body ? <div className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">{body}</div> : null}
                      </div>
                    </div>
                  );
                })}
                {!timeline.length ? <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Aucune activité HubSpot enregistrée pour ce compte.</div> : null}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
