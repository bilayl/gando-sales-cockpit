"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, ExternalLink, Loader2, Phone, PhoneCall, RefreshCw, UserRound, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const ONOFF_EXTENSION_URL = "https://chromewebstore.google.com/detail/onoff-business-click2call/jbfkkljambdhjlkcfkcbpjfkkamkccfm";

type Contact = {
  id: string;
  properties: Record<string, string | null | undefined>;
  ownership?: "MINE" | "UNASSIGNED" | "OTHER";
  assignee?: string | null;
};

type TodayPayload = {
  member?: { email?: string; displayName?: string | null };
  results?: Contact[];
  mineCount?: number;
  availableCount?: number;
  callableCount?: number;
  totalActionable?: number;
  callWindow?: string;
  error?: string;
};

type OnoffStatus = {
  configured?: boolean;
  connected?: boolean | null;
  latestCallId?: string | null;
  latestReceivedAt?: string | null;
  latestProcessingStatus?: string | null;
  error?: string | null;
};

function fullName(contact?: Contact | null) {
  if (!contact) return "—";
  const p = contact.properties;
  return [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "Contact sans nom";
}

function numberFor(contact?: Contact | null) {
  return String(contact?.properties.mobilephone || contact?.properties.phone || "").trim();
}

export function TodayDialerView() {
  const [today, setToday] = useState<TodayPayload | null>(null);
  const [onoff, setOnoff] = useState<OnoffStatus | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const [todayResponse, onoffResponse] = await Promise.all([
        fetch("/api/today", { cache: "no-store" }),
        fetch("/api/onoff/status", { cache: "no-store" }),
      ]);
      const todayPayload = await todayResponse.json();
      if (!todayResponse.ok) throw new Error(todayPayload.error || "Impossible de charger les appels du jour");
      setToday(todayPayload);
      if (onoffResponse.ok) setOnoff(await onoffResponse.json());
      else setOnoff(null);
      const first = todayPayload.results?.[0];
      setSelectedId(current => current && todayPayload.results?.some((item: Contact) => item.id === current) ? current : first?.id || null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const results = today?.results || [];
  const selected = useMemo(() => results.find(contact => contact.id === selectedId) || results[0] || null, [results, selectedId]);
  const p = selected?.properties || {};
  const selectedNumber = numberFor(selected);
  const selectedCompanyId = String(p.db_company_id || "").trim();
  const sessionHref = selectedCompanyId
    ? `/prospection/session/${encodeURIComponent(selectedCompanyId)}`
    : selected ? `/contacts/${selected.id}` : "/prospection";
  const apiHealthy = Boolean(onoff?.configured && onoff?.connected !== false);

  return (
    <div className="min-h-screen bg-background px-7 py-6 text-foreground transition-colors">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="text-[13px] font-medium text-muted-foreground">Aujourd’hui</div>
            <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.035em]">Mes appels à faire</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">Priorisés pour {today?.member?.email || "votre compte"} · uniquement entre {today?.callWindow || "08:00–19:00"} dans le fuseau du prospect.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-9 rounded-lg border-border bg-card" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Actualiser
            </Button>
            <Button asChild className="h-9 rounded-lg"><Link href="/prospection"><UsersRound className="mr-2 h-4 w-4" />Prospection</Link></Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 py-5 md:grid-cols-4">
          {[
            [today?.mineCount || 0, "Attribués à moi"],
            [today?.availableCount || 0, "Disponibles"],
            [today?.callableCount || 0, "Joignables maintenant"],
            [today?.totalActionable || results.length, "À traiter aujourd’hui"],
          ].map(([value, label]) => (
            <div key={String(label)} className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="text-[22px] font-semibold tracking-[-0.03em]">{value}</div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>

        {message ? <div className="mb-4 rounded-lg border border-border bg-muted px-4 py-3 text-[13px]">{message}</div> : null}

        <div className="grid min-h-[520px] gap-4 xl:grid-cols-[1fr_330px]">
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2.5"><PhoneCall className="h-4 w-4" strokeWidth={1.7} /><span className="text-[15px] font-semibold">Session d’appel</span></div>
              <Badge variant="outline" className="rounded-md border-border bg-muted text-foreground">{results.length} dans la file</Badge>
            </div>

            {loading ? (
              <div className="grid h-[430px] place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : selected ? (
              <div className="grid md:grid-cols-[1fr_310px]">
                <div className="p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-muted text-foreground"><UserRound className="h-5 w-5" /></div>
                      <h2 className="text-[25px] font-semibold tracking-[-0.035em]">{fullName(selected)}</h2>
                      <div className="mt-1 text-[14px] text-muted-foreground">{p.jobtitle || "Fonction à qualifier"}{p.company ? ` · ${p.company}` : ""}</div>
                    </div>
                    <Badge className={selected.ownership === "MINE" ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300" : "bg-muted text-muted-foreground hover:bg-muted"}>{selected.ownership === "MINE" ? "À moi" : "Disponible"}</Badge>
                  </div>

                  <div className="mt-7 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border px-4 py-3"><div className="text-[11px] text-muted-foreground">Téléphone</div><div className="mt-1 text-[14px] font-medium">{selectedNumber || "Aucun numéro"}</div></div>
                    <div className="rounded-xl border border-border px-4 py-3"><div className="text-[11px] text-muted-foreground">Heure locale</div><div className="mt-1 flex items-center gap-1.5 text-[14px] font-medium"><Clock3 className="h-3.5 w-3.5" />{p.db_call_local_time || "—"} · {p.db_call_timezone || "Fuseau inconnu"}</div></div>
                    <div className="rounded-xl border border-border px-4 py-3"><div className="text-[11px] text-muted-foreground">Priorité</div><div className="mt-1 text-[14px] font-medium">{p.db_call_priority_label || `${p.db_call_score || 0}/100`}</div></div>
                    <div className="rounded-xl border border-border px-4 py-3"><div className="text-[11px] text-muted-foreground">Localisation</div><div className="mt-1 text-[14px] font-medium">{[p.city, p.state, p.country].filter(Boolean).join(" · ") || "À qualifier"}</div></div>
                  </div>

                  <div className="mt-7 flex flex-wrap gap-2">
                    <Button asChild className="h-11 rounded-xl px-5"><Link href={sessionHref}><Phone className="mr-2 h-4 w-4" />Appeler</Link></Button>
                    <Button variant="outline" className="h-11 rounded-xl border-border bg-card" asChild><Link href="/prospection">Voir la prospection</Link></Button>
                    <Button variant="outline" className="h-11 rounded-xl border-border bg-card" asChild><Link href={`/contacts/${selected.id}`}>Voir la fiche <ExternalLink className="ml-2 h-3.5 w-3.5" /></Link></Button>
                  </div>
                  <p className="mt-3 max-w-2xl text-[11px] leading-5 text-muted-foreground">Le bouton Appeler ouvre d’abord la fiche de session Gando avec le contexte du lead, les objections, l’historique et les actions de suivi. L’appel Onoff se lance ensuite depuis cette session.</p>
                </div>

                <div className="border-l border-border bg-muted/35 p-3">
                  <div className="px-2 pb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">À appeler</div>
                  <div className="max-h-[455px] space-y-1 overflow-y-auto pr-1">
                    {results.slice(0, 80).map((contact, index) => (
                      <button key={contact.id} onClick={() => setSelectedId(contact.id)} className={`w-full rounded-xl px-3 py-3 text-left transition ${selected.id === contact.id ? "bg-muted" : "hover:bg-muted/70"}`}>
                        <div className="flex items-start gap-2.5"><span className="mt-0.5 w-5 text-[10px] text-muted-foreground">{index + 1}</span><div className="min-w-0"><div className="truncate text-[13px] font-medium">{fullName(contact)}</div><div className="mt-0.5 truncate text-[11px] text-muted-foreground">{contact.properties.company || "Sans entreprise"} · {contact.properties.db_call_local_time || "—"}</div></div></div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid h-[430px] place-items-center px-6 text-center"><div><CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600 dark:text-emerald-300" /><div className="mt-3 text-[15px] font-semibold">Aucun appel joignable maintenant</div><div className="mt-1 text-[12px] text-muted-foreground">Les prospects hors 08:00–19:00 heure locale ne sont pas affichés.</div></div></div>
            )}
          </section>

          <aside className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between"><h3 className="text-[15px] font-semibold">Téléphonie Onoff</h3><span className={`h-2 w-2 rounded-full ${apiHealthy ? "bg-emerald-500" : "bg-amber-500"}`} /></div>
            <div className="mt-5 space-y-4 text-[12px]">
              <div><div className="text-muted-foreground">API directe Onoff</div><div className="mt-1 font-medium">{!onoff?.configured ? "Clé non configurée" : onoff?.connected === true ? "Connectée et vérifiée" : onoff?.connected === false ? "Connexion à vérifier" : "Configurée · en attente d’un call ID"}</div></div>
              <div><div className="text-muted-foreground">Synchronisation post-appel</div><div className="mt-1 font-medium">Webhook CDR / RECORDING → Gando</div></div>
              <div><div className="text-muted-foreground">Traitement du dernier appel</div><div className="mt-1 font-medium">{onoff?.latestProcessingStatus || "—"}</div></div>
              <div><div className="text-muted-foreground">Parcours d’appel</div><div className="mt-1 font-medium">Session Gando → Click2Call Onoff → résultat CRM</div><a href={ONOFF_EXTENSION_URL} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium underline underline-offset-4">Extension Onoff <ExternalLink className="h-3 w-3" /></a></div>
            </div>
            {onoff?.error ? <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] leading-5 text-amber-700 dark:text-amber-300">{onoff.error}</div> : null}
            <Button className="mt-5 w-full" asChild><Link href="/prospection"><Phone className="mr-2 h-4 w-4" />Ouvrir la prospection</Link></Button>
          </aside>
        </div>
      </div>
    </div>
  );
}
