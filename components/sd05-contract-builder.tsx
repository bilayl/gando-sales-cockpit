"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, FileSignature, Loader2, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createEmptySD05, type SD05Content } from "@/lib/sd-stage-content";
import type { SDDocumentRecord } from "@/lib/sd-room-types";

type RoomResponse = { documents: SDDocumentRecord[]; room: { id: string; title: string } | null };
type SimpleContractStatus = "draft" | "ready_to_sign" | "signed";

function Area({ value, onChange, rows = 5, placeholder }: { value: string; onChange: (value: string) => void; rows?: number; placeholder?: string }) {
  return <textarea value={value} onChange={event => onChange(event.target.value)} rows={rows} placeholder={placeholder} className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />;
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="space-y-2"><div><Label>{label}</Label>{hint ? <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{hint}</p> : null}</div>{children}</div>;
}
function SelectField({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <select value={value} onChange={event => onChange(event.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15">{children}</select>;
}

function simplifyStatus(status?: SD05Content["contractStatus"]): SimpleContractStatus {
  if (status === "signed") return "signed";
  if (status === "ready_to_sign") return "ready_to_sign";
  return "draft";
}

export function SD05ContractBuilder({ dealId }: { dealId: string }) {
  const [data, setData] = useState<RoomResponse | null>(null);
  const [value, setValue] = useState<SD05Content>(createEmptySD05());
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Chargement impossible");
      setData(payload);
      const document = payload.documents.find((item: SDDocumentRecord) => item.code === "SD05");
      const raw = (document?.content || {}) as Partial<SD05Content>;
      setValue({ ...createEmptySD05(), ...raw, contractStatus: simplifyStatus(raw.contractStatus) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { void load(); }, [load]);

  const set = <K extends keyof SD05Content>(key: K, next: SD05Content[K]) => setValue(current => ({ ...current, [key]: next }));
  const requiredReady = ["SD01", "SD02"].every(code => data?.documents.find(item => item.code === code)?.status === "validated");
  const sd05 = data?.documents.find(item => item.code === "SD05");

  const save = async (publish: boolean) => {
    if (!value.contractTitle.trim()) {
      toast.error("Ajoutez un titre de contrat.");
      return;
    }
    setWorking(true);
    try {
      const content: SD05Content = {
        ...createEmptySD05(),
        contractTitle: value.contractTitle.trim(),
        contractUrl: value.contractUrl.trim(),
        contractStatus: simplifyStatus(value.contractStatus),
        contractSummary: value.contractSummary.trim(),
        signatureDeadline: value.signatureDeadline,
        signatories: value.signatories.filter(item => item.name.trim() || item.email.trim()),
      };
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/document`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "SD05", content, publish }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Enregistrement impossible");
      setData(current => current ? { ...current, documents: current.documents.map(document => document.code === "SD05" ? payload.document : document) } : current);
      const raw = (payload.document?.content || {}) as Partial<SD05Content>;
      setValue({ ...createEmptySD05(), ...raw, contractStatus: simplifyStatus(raw.contractStatus) });
      toast.success(publish ? "Contrat publié dans la Room" : "Contrat enregistré");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible");
    } finally {
      setWorking(false);
    }
  };

  const addSigner = () => setValue(current => ({ ...current, signatories: [...current.signatories, { name: "", role: "", organization: "", email: "", signatureStatus: "pending" }] }));
  const updateSigner = (index: number, key: "name" | "role" | "email" | "signatureStatus", next: string) => setValue(current => ({ ...current, signatories: current.signatories.map((item, currentIndex) => currentIndex === index ? { ...item, [key]: next } : item) }));
  const removeSigner = (index: number) => setValue(current => ({ ...current, signatories: current.signatories.filter((_, currentIndex) => currentIndex !== index) }));

  if (loading && !data) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return <div className="page-shell min-h-screen p-5 lg:p-7"><div className="mx-auto max-w-[1050px] space-y-5">
    <Card className="overflow-hidden p-0">
      <div className="flex flex-col gap-4 border-b border-border bg-primary/[0.04] p-5 lg:flex-row lg:items-center">
        <div className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><FileSignature className="h-5 w-5" /></div><div><div className="text-xs font-bold uppercase tracking-[0.14em] text-primary">SD05 · Contrat & signature</div><h1 className="mt-1 text-2xl font-bold tracking-[-0.03em]">Le contrat, puis la signature</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">SD05 reste volontairement simple : un contrat de référence, son lien de signature et les signataires.</p></div></div>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">{sd05?.status === "validated" || value.contractStatus === "signed" ? <Badge variant="outline" className="border-emerald-500/30 text-emerald-600"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Signé / validé</Badge> : null}<Button variant="outline" onClick={() => void save(false)} disabled={working}><Save className="mr-2 h-4 w-4" /> Enregistrer</Button><Button onClick={() => void save(true)} disabled={working || !requiredReady}><Send className="mr-2 h-4 w-4" /> Publier</Button></div>
      </div>
      {!requiredReady ? <div className="border-b border-amber-500/20 bg-amber-500/[0.06] px-5 py-3 text-xs text-amber-700">SD01 et SD02 doivent être validés avant de publier le contrat.</div> : null}
    </Card>

    <Card className="space-y-5 p-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_220px]"><Field label="Titre du contrat"><Input value={value.contractTitle} onChange={event => set("contractTitle", event.target.value)} placeholder="Convention de services Gando × Client" /></Field><Field label="Statut"><SelectField value={simplifyStatus(value.contractStatus)} onChange={next => set("contractStatus", next as SD05Content["contractStatus"])}><option value="draft">Brouillon</option><option value="ready_to_sign">Prêt à signer</option><option value="signed">Signé</option></SelectField></Field></div>
      <Field label="Lien du contrat / lien de signature" hint="Yousign, DocuSign, Dropbox Sign, PDF ou autre lien sécurisé."><Input value={value.contractUrl} onChange={event => set("contractUrl", event.target.value)} placeholder="https://…" /></Field>
      <Field label="Résumé du contrat" hint="Quelques lignes maximum pour rappeler l’objet du contrat."><Area value={value.contractSummary} onChange={next => set("contractSummary", next)} rows={4} placeholder="Objet du contrat, périmètre et engagement principal." /></Field>
      <Field label="Date limite de signature"><Input type="date" value={value.signatureDeadline} onChange={event => set("signatureDeadline", event.target.value)} /></Field>
    </Card>

    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Signataires</h2><p className="mt-1 text-xs text-muted-foreground">Ajoutez uniquement les personnes qui doivent signer le contrat.</p></div><Button type="button" variant="outline" size="sm" onClick={addSigner}>Ajouter un signataire</Button></div>
      {value.signatories.length ? <div className="space-y-3">{value.signatories.map((signer, index) => <div key={index} className="grid gap-3 rounded-xl border border-border bg-muted/20 p-4 lg:grid-cols-[1fr_1fr_1fr_150px_auto]"><Input value={signer.name} onChange={event => updateSigner(index, "name", event.target.value)} placeholder="Nom" /><Input type="email" value={signer.email} onChange={event => updateSigner(index, "email", event.target.value)} placeholder="Email" /><Input value={signer.role} onChange={event => updateSigner(index, "role", event.target.value)} placeholder="Rôle" /><SelectField value={signer.signatureStatus || "pending"} onChange={next => updateSigner(index, "signatureStatus", next)}><option value="pending">À signer</option><option value="sent">Envoyé</option><option value="signed">Signé</option></SelectField><Button type="button" variant="ghost" onClick={() => removeSigner(index)}>Supprimer</Button></div>)}</div> : <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Aucun signataire pour le moment.</div>}
    </Card>
  </div></div>;
}
