"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, ExternalLink, Loader2, Phone, PhoneCall, RefreshCw, UserRound, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

type AlloStatus = {
  configured?: boolean;
  connected?: boolean;
  powerDialerReady?: boolean;
  directCallReady?: boolean;
  team?: { name?: string } | null;
  target?: { email?: string | null; name?: string | null; source?: string; availableUsers?: Array<{ email?: string; name?: string }> };
  queue?: { count?: number; name?: string | null } | null;
  queueError?: { message?: string; code?: string | null } | null;
  error?: { message?: string; code?: string | null };
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
  const [allo, setAllo] = useState<AlloStatus | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [queueing, setQueueing] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const [todayResponse, alloResponse] = await Promise.all([
        fetch("/api/today", { cache: "no-store" }),
        fetch("/api/allo/status", { cache: "no-store" }),
      ]);
      const [todayPayload, alloPayload] = await Promise.all([todayResponse.json(), alloResponse.json()]);
      if (!todayResponse.ok) throw new Error(todayPayload.error || "Impossible de charger les appels du jour");
      setToday(todayPayload);
      setAllo(alloPayload);
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

  async function addCurrentToAllo(openAfter = false) {
    if (!selected) return;
    const p = selected.properties;
    const number = numberFor(selected);
    if (!number) {
      setMessage("Ce prospect n’a pas de numéro de téléphone.");
      return;
    }
    setQueueing(true);
    setMessage("");
    try {
      const response = await fetch("/api/allo/dialing-queue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ numbers: [{
          number,
          name: p.firstname,
          last_name: p.lastname,
          company: p.company,
          job_title: p.jobtitle,
          emails: p.email ? [p.email] : [],
          website: p.website || p.domain,
        }] }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error?.message || payload?.message || "Impossible d’ajouter ce numéro à Allo");
      setMessage("Prospect envoyé dans votre Power Dialer Allo.");
      const statusResponse = await fetch("/api/allo/status", { cache: "no-store" });
      setAllo(await statusResponse.json());
      if (openAfter) window.open("https://web.withallo.com", "_blank", "noopener,noreferrer");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur Allo");
    } finally {
      setQueueing(false);
    }
  }

  const alloHealthy = Boolean(allo?.configured && allo?.connected && allo?.powerDialerReady);
  const p = selected?.properties || {};

  return (
    <div className="min-h-screen bg-white px-7 py-6 text-[#17231f]">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e8ece9] pb-5">
          <div>
            <div className="text-[13px] font-medium text-[#75817b]">Aujourd’hui</div>
            <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.035em]">Mes appels à faire</h1>
            <p className="mt-1 text-[13px] text-[#78837e]">Priorisés pour {today?.member?.email || "votre compte"} · uniquement entre {today?.callWindow || "08:00–19:00"} dans le fuseau du prospect.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-9 rounded-lg border-[#dfe5e1] bg-white" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Actualiser
            </Button>
            <Button asChild className="h-9 rounded-lg bg-[#1f3a31] text-white hover:bg-[#183129]"><Link href="/prospects"><UsersRound className="mr-2 h-4 w-4" />Tous les prospects</Link></Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 py-5 md:grid-cols-4">
          {[
            [today?.mineCount || 0, "Attribués à moi"],
            [today?.availableCount || 0, "Disponibles"],
            [today?.callableCount || 0, "Joignables maintenant"],
            [allo?.queue?.count || 0, "Dans Allo"],
          ].map(([value, label]) => (
            <div key={String(label)} className="rounded-xl border border-[#e6ebe7] bg-white px-4 py-3">
              <div className="text-[22px] font-semibold tracking-[-0.03em]">{value}</div>
              <div className="mt-0.5 text-[12px] text-[#79847f]">{label}</div>
            </div>
          ))}
        </div>

        {message ? <div className="mb-4 rounded-lg border border-[#dfe7e2] bg-[#f7faf8] px-4 py-3 text-[13px]">{message}</div> : null}

        <div className="grid min-h-[520px] gap-4 xl:grid-cols-[1fr_360px]">
          <section className="overflow-hidden rounded-2xl border border-[#e3e8e5] bg-white">
            <div className="flex items-center justify-between border-b border-[#e8ece9] px-5 py-4">
              <div className="flex items-center gap-2.5"><PhoneCall className="h-4 w-4" strokeWidth={1.7} /><span className="text-[15px] font-semibold">Dialer</span></div>
              <Badge variant="outline" className="rounded-md border-[#dfe6e1] bg-[#f7f9f8] text-[#53615a]">{results.length} dans la file</Badge>
            </div>

            {loading ? (
              <div className="grid h-[430px] place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[#64716b]" /></div>
            ) : selected ? (
              <div className="grid md:grid-cols-[1fr_310px]">
                <div className="p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-[#edf2ef] text-[#2f4a40]"><UserRound className="h-5 w-5" /></div>
                      <h2 className="text-[25px] font-semibold tracking-[-0.035em]">{fullName(selected)}</h2>
                      <div className="mt-1 text-[14px] text-[#6c7872]">{p.jobtitle || "Fonction à qualifier"}{p.company ? ` · ${p.company}` : ""}</div>
                    </div>
                    <Badge className={selected.ownership === "MINE" ? "bg-[#e7f5eb] text-[#33704b] hover:bg-[#e7f5eb]" : "bg-[#f1f3f2] text-[#67736d] hover:bg-[#f1f3f2]"}>{selected.ownership === "MINE" ? "À moi" : "Disponible"}</Badge>
                  </div>

                  <div className="mt-7 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[#e6ebe7] px-4 py-3"><div className="text-[11px] text-[#89938e]">Téléphone</div><div className="mt-1 text-[14px] font-medium">{numberFor(selected) || "Aucun numéro"}</div></div>
                    <div className="rounded-xl border border-[#e6ebe7] px-4 py-3"><div className="text-[11px] text-[#89938e]">Heure locale</div><div className="mt-1 flex items-center gap-1.5 text-[14px] font-medium"><Clock3 className="h-3.5 w-3.5" />{p.db_call_local_time || "—"} · {p.db_call_timezone || "Fuseau inconnu"}</div></div>
                    <div className="rounded-xl border border-[#e6ebe7] px-4 py-3"><div className="text-[11px] text-[#89938e]">Priorité</div><div className="mt-1 text-[14px] font-medium">{p.db_call_priority_label || `${p.db_call_score || 0}/100`}</div></div>
                    <div className="rounded-xl border border-[#e6ebe7] px-4 py-3"><div className="text-[11px] text-[#89938e]">Localisation</div><div className="mt-1 text-[14px] font-medium">{[p.city, p.state, p.country].filter(Boolean).join(" · ") || "À qualifier"}</div></div>
                  </div>

                  <div className="mt-7 flex flex-wrap gap-2">
                    <Button className="h-11 rounded-xl bg-[#1f3a31] px-5 text-white hover:bg-[#183129]" onClick={() => void addCurrentToAllo(true)} disabled={queueing || !alloHealthy}>
                      {queueing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Phone className="mr-2 h-4 w-4" />} Appeler avec Allo
                    </Button>
                    <Button variant="outline" className="h-11 rounded-xl border-[#dfe5e1] bg-white" asChild><Link href={`/contacts/${selected.id}`}>Voir la fiche <ExternalLink className="ml-2 h-3.5 w-3.5" /></Link></Button>
                  </div>
                  <p className="mt-3 max-w-2xl text-[11px] leading-5 text-[#818c86]">Le bouton synchronise le prospect avec votre file Power Dialer puis ouvre Allo. L’audio de l’appel reste lancé par le client Allo tant que votre clé API n’expose pas d’endpoint d’initiation d’appel.</p>
                </div>

                <div className="border-l border-[#e8ece9] bg-[#fbfcfb] p-3">
                  <div className="px-2 pb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a948f]">À appeler</div>
                  <div className="max-h-[455px] space-y-1 overflow-y-auto pr-1">
                    {results.slice(0, 80).map((contact, index) => (
                      <button key={contact.id} onClick={() => setSelectedId(contact.id)} className={`w-full rounded-xl px-3 py-3 text-left transition ${selected.id === contact.id ? "bg-[#edf2ef]" : "hover:bg-[#f3f6f4]"}`}>
                        <div className="flex items-start gap-2.5"><span className="mt-0.5 w-5 text-[10px] text-[#9aa39f]">{index + 1}</span><div className="min-w-0"><div className="truncate text-[13px] font-medium">{fullName(contact)}</div><div className="mt-0.5 truncate text-[11px] text-[#7b8680]">{contact.properties.company || "Sans entreprise"} · {contact.properties.db_call_local_time || "—"}</div></div></div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid h-[430px] place-items-center px-6 text-center"><div><CheckCircle2 className="mx-auto h-7 w-7 text-[#4f8d67]" /><div className="mt-3 text-[15px] font-semibold">Aucun appel joignable maintenant</div><div className="mt-1 text-[12px] text-[#7c8781]">Les prospects hors 08:00–19:00 heure locale ne sont pas affichés.</div></div></div>
            )}
          </section>

          <aside className="rounded-2xl border border-[#e3e8e5] bg-white p-5">
            <div className="flex items-center justify-between"><h3 className="text-[15px] font-semibold">Connexion Allo</h3><span className={`h-2 w-2 rounded-full ${alloHealthy ? "bg-[#4e9a69]" : "bg-[#c36b5d]"}`} /></div>
            <div className="mt-5 space-y-4 text-[12px]">
              <div><div className="text-[#87918c]">Workspace</div><div className="mt-1 font-medium">{allo?.team?.name || "—"}</div></div>
              <div><div className="text-[#87918c]">Membre Allo ciblé</div><div className="mt-1 font-medium">{allo?.target?.name || allo?.target?.email || "Propriétaire de la clé API"}</div>{allo?.target?.email ? <div className="mt-0.5 text-[#7d8882]">{allo.target.email}</div> : null}</div>
              <div><div className="text-[#87918c]">Power Dialer</div><div className="mt-1 font-medium">{allo?.powerDialerReady ? `Prêt · ${allo?.queue?.count || 0} numéro(s)` : "Scope DIALING_QUEUE_READ_WRITE manquant"}</div></div>
              <div><div className="text-[#87918c]">Appel vocal direct par API</div><div className="mt-1 font-medium">{allo?.directCallReady ? "Endpoint disponible sur cette clé" : "Aucun endpoint d’initiation exposé par la clé"}</div></div>
            </div>
            {!alloHealthy ? <div className="mt-5 rounded-xl border border-[#efd8d2] bg-[#fff9f7] p-3 text-[11px] leading-5 text-[#885044]">{allo?.error?.message || allo?.queueError?.message || "La clé Allo est présente mais le Power Dialer n’est pas utilisable avec ses scopes actuels."}</div> : null}
            <div className="mt-6 border-t border-[#e8ece9] pt-4 text-[11px] leading-5 text-[#7b8680]">Votre capture Allo montre un seul membre. Le Cockpit détecte désormais automatiquement ce membre lorsque l’email Cockpit ne correspond pas à l’email Allo, au lieu d’envoyer la file vers un utilisateur inexistant.</div>
          </aside>
        </div>
      </div>
    </div>
  );
}
