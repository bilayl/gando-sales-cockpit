"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Phone, RefreshCw, Search, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchAllPagedResults } from "@/lib/fetch-all-paged-results";

type Contact = { id: string; properties: Record<string, string | null | undefined> };

function nameOf(contact: Contact) {
  const p = contact.properties;
  return [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "Sans nom";
}

function telHref(phone: string) {
  return `tel:${phone.replace(/[^+\d*#]/g, "")}`;
}

export function ProspectsView() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const payload = await fetchAllPagedResults<Contact>("/api/contacts");
      setContacts(payload.results);
      if (payload.truncated) setError("Le volume dépasse la limite de chargement : les 10 000 premiers prospects sont affichés.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de charger les prospects");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr-FR");
    if (!needle) return contacts;
    return contacts.filter(contact => {
      const p = contact.properties;
      return [p.firstname, p.lastname, p.email, p.phone, p.mobilephone, p.company, p.jobtitle, p.city, p.country]
        .filter(Boolean).join(" ").toLocaleLowerCase("fr-FR").includes(needle);
    });
  }, [contacts, query]);

  const withPhone = contacts.filter(contact => Boolean(contact.properties.mobilephone || contact.properties.phone)).length;

  return (
    <div className="min-h-screen bg-background px-7 py-6 text-foreground transition-colors">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="text-[13px] font-medium text-muted-foreground">Workspace</div>
            <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.035em]">Prospects</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">Vue générale de tous les leads présents dans le Cockpit, indépendamment de leur priorité d’appel.</p>
          </div>
          <Button variant="outline" className="h-9 rounded-lg border-border bg-card" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Actualiser
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 py-5 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card px-4 py-3"><div className="text-[22px] font-semibold tracking-[-0.03em]">{contacts.length}</div><div className="mt-0.5 text-[12px] text-muted-foreground">Prospects au total</div></div>
          <div className="rounded-xl border border-border bg-card px-4 py-3"><div className="text-[22px] font-semibold tracking-[-0.03em]">{withPhone}</div><div className="mt-0.5 text-[12px] text-muted-foreground">Avec téléphone</div></div>
          <div className="rounded-xl border border-border bg-card px-4 py-3"><div className="text-[22px] font-semibold tracking-[-0.03em]">{filtered.length}</div><div className="mt-0.5 text-[12px] text-muted-foreground">Résultats visibles</div></div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div className="flex items-center gap-2.5"><UsersRound className="h-4 w-4" strokeWidth={1.7} /><span className="text-[15px] font-semibold">Tous les prospects</span></div>
            <div className="relative w-full max-w-[360px]"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher par nom, société, email…" className="h-9 rounded-lg border-input bg-background pl-9" /></div>
          </div>
          {error ? <div className="border-b border-destructive/20 bg-destructive/10 px-5 py-3 text-[12px] text-destructive">{error}</div> : null}
          <div className="max-h-[calc(100vh-280px)] overflow-auto">
            <table className="w-full min-w-[1050px] border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-muted text-[11px] font-medium text-muted-foreground">
                <tr className="border-b border-border"><th className="px-5 py-3">Prospect</th><th className="px-4 py-3">Entreprise</th><th className="px-4 py-3">Fonction</th><th className="px-4 py-3">Téléphone</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Localisation</th><th className="px-4 py-3">Statut</th></tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={7} className="h-64 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr> : filtered.map(contact => {
                  const p = contact.properties;
                  const phone = p.mobilephone || p.phone;
                  return (
                    <tr key={contact.id} onClick={() => router.push(`/contacts/${contact.id}`)} className="cursor-pointer border-b border-border/60 text-[12px] transition hover:bg-muted/55">
                      <td className="px-5 py-3.5"><div className="font-medium text-[13px]">{nameOf(contact)}</div><div className="mt-0.5 text-[11px] text-muted-foreground">ID {contact.id}</div></td>
                      <td className="px-4 py-3.5">{p.company || "—"}</td>
                      <td className="px-4 py-3.5 text-muted-foreground">{p.jobtitle || "—"}</td>
                      <td className="px-4 py-3.5">
                        {phone ? (
                          <a
                            href={telHref(String(phone))}
                            onClick={event => event.stopPropagation()}
                            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 font-medium text-foreground transition hover:bg-muted"
                            title="Appeler avec Allo Click-to-Call"
                          >
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />{phone}
                          </a>
                        ) : "—"}
                      </td>
                      <td className="max-w-[240px] truncate px-4 py-3.5 text-muted-foreground">{p.email || "—"}</td>
                      <td className="px-4 py-3.5 text-muted-foreground">{[p.city, p.state, p.country].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="px-4 py-3.5"><Badge variant="outline" className="rounded-md border-border bg-muted text-foreground">{p.statut_prospection || p.statut_de_lappel || "À qualifier"}</Badge></td>
                    </tr>
                  );
                })}
                {!loading && filtered.length === 0 ? <tr><td colSpan={7} className="h-56 text-center text-[13px] text-muted-foreground">Aucun prospect ne correspond à cette recherche.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
