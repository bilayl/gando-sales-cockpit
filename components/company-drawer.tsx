"use client";
import { ArrowUpRight, Building2, Briefcase, CalendarClock, Clock, Globe, Loader2, Mail, MapPin, Phone, PhoneCall, UserRound, Users, X } from "lucide-react";
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
      <h3 className="flex items-center gap-2.5 text-[13px] font-bold uppercase tracking-wider text-foreground">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-500/10 text-violet-300"><Icon size={14} /></span>
        {title}
        {count !== undefined ? <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{count}</span> : null}
      </h3>
    </div>
  );
}

function InfoRow({ label, value, icon: Icon }: { label: string; value?: string | null; icon: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
      <Icon size={15} className="shrink-0 text-violet-300" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-0.5 truncate text-sm font-medium" title={value || ""}>{value || "—"}</div>
      </div>
    </div>
  );
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
  const contactCount = p.num_associated_contacts ? Number(p.num_associated_contacts) : contacts.length;

  const modal = (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[22px] border border-border bg-popover shadow-[0_24px_64px_-16px_rgba(0,0,0,0.8),0_0_0_1px_rgba(115,93,243,0.08)] supports-[height:100dvh]:max-h-[calc(100dvh-2rem)]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-gradient-to-br from-violet-500/10 via-transparent to-transparent px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3.5">
            <Avatar className="h-14 w-14 shrink-0 rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-500/25 to-accent">
              <AvatarFallback className="rounded-2xl bg-transparent font-display text-xl font-bold text-violet-200"><Building2 size={26} /></AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="truncate font-display text-xl font-bold leading-tight">{name}</h2>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground"><Globe size={13} className="shrink-0" /> {p.domain || "Aucun domaine"}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {ownerName ? <Badge variant="outline" className="gap-1 border-violet-400/25 bg-violet-400/5 text-xs text-violet-200"><UserRound size={11} /> {ownerName}</Badge> : null}
                {contactCount !== undefined && contactCount > 0 ? <Badge variant="outline" className="gap-1 border-white/10 bg-white/5 text-xs text-slate-300"><Users size={11} /> {contactCount} contact{contactCount > 1 ? "s" : ""}</Badge> : null}
                {p.hs_object_source_label ? <Badge variant="outline" className="gap-1 border-white/10 bg-white/5 text-xs text-slate-300"><Globe size={11} /> {p.hs_object_source_label}</Badge> : null}
              </div>
            </div>
          </div>
          <button onClick={() => onOpenChange(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 minari-scrollbar">
          {loading ? <div className="grid h-64 place-items-center"><Loader2 className="animate-spin text-violet-300" /></div>
            : error ? <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
            : <div className="space-y-6">
              <div className="flex gap-2">
                <Button asChild className="flex-1"><a href={p.phone ? `tel:${p.phone}` : "#"}><Phone size={15} /> Appeler</a></Button>
                <Button variant="outline" asChild className="flex-1"><a href={p.domain ? `https://${p.domain}` : "#"} target="_blank" rel="noreferrer"><ArrowUpRight size={15} /> Site web</a></Button>
              </div>

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
                      <div key={c.id} className="rounded-xl border border-border bg-muted/20 p-3 transition-colors hover:border-violet-400/25">
                        <div className="flex items-center justify-between gap-2">
                          <button onClick={() => setContactId(c.id)} className="flex min-w-0 items-center gap-2.5 text-left">
                            <Avatar className="h-8 w-8 shrink-0 bg-accent"><AvatarFallback className="bg-accent text-[9px] font-bold text-violet-300">{initials(cp.firstname, cp.lastname)}</AvatarFallback></Avatar>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-foreground hover:text-violet-300 hover:underline">{full}</span>
                              {cp.jobtitle ? <span className="block truncate text-xs text-muted-foreground">{cp.jobtitle}</span> : null}
                            </span>
                          </button>
                          <Badge variant="outline" className={`shrink-0 font-medium ${prospectionBadge(cp.statut_prospection)}`}>{cp.statut_prospection || "—"}</Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                          {cp.email ? <a href={`mailto:${cp.email}`} className="inline-flex items-center gap-1.5 hover:text-violet-300"><Mail size={11} className="text-violet-300" /> <span className="truncate">{cp.email}</span></a> : null}
                          {cp.phone || cp.mobilephone ? <a href={`tel:${cp.phone || cp.mobilephone}`} className="inline-flex items-center gap-1.5 font-mono hover:text-violet-300"><PhoneCall size={11} className="text-violet-300" /> {cp.phone || cp.mobilephone}</a> : null}
                          {cp.hs_last_sales_activity_timestamp ? <span className="inline-flex items-center gap-1.5 font-mono"><Clock size={11} className="text-violet-300" /> {formatDate(cp.hs_last_sales_activity_timestamp)}</span> : null}
                        </div>
                      </div>
                    );
                  })}
                  {!contacts.length ? <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Aucun contact associé à cette entreprise.</div> : null}
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
