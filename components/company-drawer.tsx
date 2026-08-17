"use client";
import { ArrowUpRight, Building2, Briefcase, CalendarClock, Check, Clock, FileText, Globe, History, Loader2, Mail, MapPin, Phone, PhoneCall, UserRound, Users, X } from "lucide-react";
import { formatDate, initials } from "@/lib/utils";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ContactDrawer } from "@/components/contact-drawer";

type Props = { companyId: string | null; open: boolean; onOpenChange: (open: boolean) => void };

const PROSPECTION_BADGES: Record<string, string> = {
  "À prospecter": "border-white/10 bg-white/5 text-slate-300",
  "En prospection": "border-amber-400/30 bg-amber-400/10 text-amber-300",
  "Conversation": "border-sky-400/30 bg-sky-400/10 text-sky-300",
  "RDV booké": "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  "À recycler": "border-orange-400/30 bg-orange-400/10 text-orange-300",
  "Non qualifié": "border-rose-400/30 bg-rose-400/10 text-rose-300",
  "Perdu": "border-rose-400/30 bg-rose-400/10 text-rose-300",
};

function prospectionBadge(status?: string | null) {
  if (!status) return "border-white/10 bg-white/5 text-slate-400";
  return PROSPECTION_BADGES[status] || "border-white/10 bg-card text-slate-300";
}

function SectionTitle({ icon: Icon, title, count }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; count?: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <Icon size={14} className="text-primary" />
        {title}
        {count !== undefined ? <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{count}</span> : null}
      </h3>
    </div>
  );
}

function InfoRow({ label, value, icon: Icon }: { label: string; value?: string | null; icon: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/45 px-3 py-2.5">
      <Icon size={15} className="shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-0.5 truncate text-sm font-medium" title={value || ""}>{value || "—"}</div>
      </div>
    </div>
  );
}

const MEETING_LABELS: Record<string, string> = {
  SCHEDULED: "Planifié",
  COMPLETED: "Terminé",
  RESCHEDULED: "Replanifié",
  NO_SHOW: "No-show",
  CANCELED: "Annulé",
  UNREVIEWED: "À traiter",
};

function plainText(value?: string | null) {
  return value?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "";
}

export function CompanyDrawer({ companyId, open, onOpenChange }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [contactId, setContactId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !companyId) return;
    setLoading(true);
    setError("");
    setData(null);
    fetch("/api/owners").then(r => r.json()).then((o: any) => {
      setOwners(Object.fromEntries((o.results || []).map((x: any) => [x.id, [x.firstName, x.lastName].filter(Boolean).join(" ") || x.email || x.id])));
    }).catch(() => {});
    fetch(`/api/companies/${companyId}`).then(async r => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Impossible de charger la fiche");
      return d;
    }).then(setData).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, [open, companyId]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onOpenChange(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  const p = data?.company?.properties || {};
  const name = p.name || "Entreprise";
  const ownerName = owners[p.hubspot_owner_id] || "";
  const location = [p.city, p.state, p.country].filter(Boolean).join(", ");
  const contacts = data?.contacts || [];
  const meetings = data?.meetings || [];
  const nextMeeting = data?.nextMeeting || null;
  const timeline = [
    ...meetings.map((meeting: any) => ({
      id: `meeting-${meeting.id}`,
      type: "meeting",
      date: meeting.derived?.startAt || meeting.properties?.hs_createdate,
      title: meeting.properties?.hs_meeting_title || "Rendez-vous",
      status: meeting.derived?.status,
      body: meeting.properties?.hs_internal_meeting_notes,
    })),
    ...(data?.notes || []).map((note: any) => ({
      id: `note-${note.id}`,
      type: "note",
      date: note.properties?.hs_timestamp || note.properties?.hs_createdate,
      title: "Note HubSpot",
      body: note.properties?.hs_note_body,
    })),
  ].sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  const contactCount = p.num_associated_contacts ? Number(p.num_associated_contacts) : contacts.length;

  const modal = (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-slate-950/25 backdrop-blur-[1px]" onClick={() => onOpenChange(false)} />
      <div className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-[0_28px_80px_-34px_rgba(15,35,42,0.42)] supports-[height:100dvh]:max-h-[calc(100dvh-2rem)]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3.5">
            <Avatar className="h-11 w-11 shrink-0 rounded-lg border border-border bg-muted">
              <AvatarFallback className="rounded-lg bg-muted text-primary"><Building2 size={22} /></AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold leading-tight tracking-tight">{name}</h2>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground"><Globe size={13} className="shrink-0" /> {p.domain || "Aucun domaine"}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {ownerName ? <Badge variant="outline" className="gap-1 text-xs"><UserRound size={11} /> {ownerName}</Badge> : null}
                {contactCount !== undefined && contactCount > 0 ? <Badge variant="outline" className="gap-1 text-xs text-muted-foreground"><Users size={11} /> {contactCount} contact{contactCount > 1 ? "s" : ""}</Badge> : null}
                {p.hs_object_source_label ? <Badge variant="outline" className="gap-1 text-xs text-muted-foreground"><Globe size={11} /> {p.hs_object_source_label}</Badge> : null}
              </div>
            </div>
          </div>
          <button onClick={() => onOpenChange(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 minari-scrollbar">
          {loading ? <div className="grid h-64 place-items-center"><Loader2 className="animate-spin text-primary" /></div>
            : error ? <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
            : <div className="space-y-6">
              <div className="flex gap-2">
                <Button asChild className="flex-1"><a href={p.phone ? `tel:${p.phone}` : "#"}><Phone size={15} /> Appeler</a></Button>
                <Button variant="outline" asChild className="flex-1"><a href={p.domain ? `https://${p.domain}` : "#"} target="_blank" rel="noreferrer"><ArrowUpRight size={15} /> Site web</a></Button>
              </div>

              <section>
                <SectionTitle icon={CalendarClock} title="Prochain rendez-vous" />
                {nextMeeting ? (
                  <div className="mt-3 rounded-xl border border-primary/20 bg-primary/[0.05] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold">{nextMeeting.properties?.hs_meeting_title || "Rendez-vous"}</div>
                        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarClock size={14} className="text-primary" />
                          {formatDate(nextMeeting.derived?.startAt)}
                        </div>
                      </div>
                      <Badge variant="outline" className="border-primary/20 bg-card text-primary">Planifié</Badge>
                    </div>
                    {nextMeeting.properties?.hs_meeting_location ? <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><MapPin size={13} /> {nextMeeting.properties.hs_meeting_location}</div> : null}
                  </div>
                ) : <div className="mt-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Aucun prochain rendez-vous planifié pour cette société.</div>}
              </section>

              <section>
                <SectionTitle icon={Building2} title="Coordonnées" />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <InfoRow icon={Phone} label="Téléphone" value={p.phone} />
                  <InfoRow icon={Globe} label="Domaine" value={p.domain} />
                  <InfoRow icon={MapPin} label="Localisation" value={location} />
                  <InfoRow icon={Briefcase} label="Secteur" value={p.industry} />
                  <InfoRow icon={CalendarClock} label="Créée le" value={p.createdate ? formatDate(p.createdate) : undefined} />
                  <InfoRow icon={Clock} label="Dernière activité" value={p.hs_last_sales_activity_timestamp ? formatDate(p.hs_last_sales_activity_timestamp) : undefined} />
                </div>
                {p.description ? <div className="mt-3 whitespace-pre-wrap rounded-xl border border-border bg-muted/20 p-4 text-sm leading-6 text-card-foreground">{p.description}</div> : null}
              </section>

              <section>
                <SectionTitle icon={Users} title="Contacts associés" count={contacts.length} />
                <div className="mt-3 space-y-2">
                  {contacts.map((c: any) => {
                    const cp = c.properties || {};
                    const full = [cp.firstname, cp.lastname].filter(Boolean).join(" ") || cp.email || "Sans nom";
                    return (
                      <div key={c.id} className="rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/35">
                        <div className="flex items-center justify-between gap-2">
                          <button onClick={() => setContactId(c.id)} className="flex min-w-0 items-center gap-2.5 text-left">
                            <Avatar className="h-8 w-8 shrink-0 bg-accent"><AvatarFallback className="bg-accent text-[9px] font-bold text-primary">{initials(cp.firstname, cp.lastname)}</AvatarFallback></Avatar>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-foreground hover:text-primary hover:underline">{full}</span>
                              {cp.jobtitle ? <span className="block truncate text-xs text-muted-foreground">{cp.jobtitle}</span> : null}
                            </span>
                          </button>
                          <Badge variant="outline" className={`shrink-0 font-medium ${prospectionBadge(cp.statut_prospection)}`}>{cp.statut_prospection || "—"}</Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                          {cp.email ? <a href={`mailto:${cp.email}`} className="inline-flex items-center gap-1.5 hover:text-primary"><Mail size={11} className="text-primary" /> <span className="truncate">{cp.email}</span></a> : null}
                          {cp.phone || cp.mobilephone ? <a href={`tel:${cp.phone || cp.mobilephone}`} className="inline-flex items-center gap-1.5 font-mono hover:text-primary"><PhoneCall size={11} className="text-primary" /> {cp.phone || cp.mobilephone}</a> : null}
                          {cp.hs_last_sales_activity_timestamp ? <span className="inline-flex items-center gap-1.5 font-mono"><Clock size={11} className="text-primary" /> {formatDate(cp.hs_last_sales_activity_timestamp)}</span> : null}
                        </div>
                      </div>
                    );
                  })}
                  {!contacts.length ? <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Aucun contact associé à cette entreprise.</div> : null}
                </div>
              </section>

              <section>
                <SectionTitle icon={History} title="Historique et timeline" count={timeline.length} />
                <div className="mt-3 space-y-2">
                  {timeline.slice(0, 30).map((item: any) => (
                    <div key={item.id} className="flex gap-3 rounded-lg border border-border bg-card p-3">
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/[0.08] text-primary">
                        {item.type === "meeting" ? <CalendarClock size={14} /> : <FileText size={14} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="truncate text-sm font-semibold">{item.title}</div>
                          <div className="shrink-0 text-xs text-muted-foreground">{item.date ? formatDate(item.date) : "Date inconnue"}</div>
                        </div>
                        {item.status ? <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Check size={12} className="text-primary" /> {MEETING_LABELS[item.status] || item.status}</div> : null}
                        {plainText(item.body) ? <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">{plainText(item.body)}</p> : null}
                      </div>
                    </div>
                  ))}
                  {!timeline.length ? <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Aucune activité rendez-vous ou note associée.</div> : null}
                </div>
              </section>
            </div>}
        </div>
      </div>

      <ContactDrawer contactId={contactId} open={Boolean(contactId)} onOpenChange={o => !o && setContactId(null)} />
    </div>
  );

  return createPortal(modal, document.body);
}
