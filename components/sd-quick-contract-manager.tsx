"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, FileText, Loader2, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createEmptySD05, type SD05Content } from "@/lib/sd-stage-content";
import type { SDDocumentRecord, SDRoomRecord } from "@/lib/sd-room-types";

type RoomResponse = { room: SDRoomRecord | null; documents: SDDocumentRecord[] };

function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function SDQuickContractManager({ dealId, onChanged }: { dealId: string; onChanged?: () => void }) {
  const [data, setData] = useState<RoomResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [signedAt, setSignedAt] = useState("");
  const [signedByEmail, setSignedByEmail] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Chargement impossible");
      setData(payload);
      setSignedAt(localDateTime(payload.room?.contract_signed_at || null));
      setSignedByEmail(payload.room?.contract_signed_by_email || "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { void load(); }, [load]);

  const document = data?.documents.find(item => item.code === "SD05");
  const value = { ...createEmptySD05(), ...((document?.content || {}) as Partial<SD05Content>) };
  const signed = value.contractStatus === "signed" || document?.status === "validated";

  async function upload(file: File) {
    setWorking(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/quick-contract`, { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Import impossible");
      toast.success("Contrat ajouté au deal");
      onChanged?.();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import impossible");
    } finally {
      setWorking(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function markSigned() {
    if (!value.contractUrl) return toast.error("Ajoute d’abord le contrat.");
    setWorking(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/quick-contract`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signedAt: signedAt || undefined, signedByEmail: signedByEmail.trim() || undefined }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Mise à jour impossible");
      toast.success("Contrat marqué comme signé");
      onChanged?.();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Mise à jour impossible");
    } finally {
      setWorking(false);
    }
  }

  async function remove() {
    if (!value.contractUrl || !window.confirm("Retirer ce contrat du deal ?")) return;
    setWorking(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/quick-contract`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Suppression impossible");
      toast.success("Contrat retiré");
      onChanged?.();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Suppression impossible");
    } finally {
      setWorking(false);
    }
  }

  if (loading && !data) return <div className="grid min-h-[45vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return <div className="page-shell min-h-screen p-5 lg:p-7"><div className="mx-auto max-w-[1000px] space-y-5">
    <Card className="p-5 lg:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-[11px] font-black uppercase tracking-[0.14em] text-primary">Deal rapide · Étape 2</div><h1 className="mt-1 text-2xl font-black tracking-[-0.03em]">Contrat</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Dépose directement le Word ou le PDF du contrat. Une fois signé, marque-le comme signé pour figer le timing du deal.</p></div>{signed ? <Badge variant="outline" className="border-emerald-500/25 bg-emerald-500/10 text-emerald-600"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Signé</Badge> : value.contractUrl ? <Badge variant="outline">Contrat ajouté</Badge> : <Badge variant="outline">À préparer</Badge>}</div>
    </Card>

    <input ref={inputRef} type="file" accept=".doc,.docx,.pdf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); }} />

    {!value.contractUrl ? <Card className="p-5 lg:p-7"><button type="button" onClick={() => inputRef.current?.click()} disabled={working} className="flex min-h-[260px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/20 px-6 text-center transition hover:border-primary/50 hover:bg-primary/[0.03] disabled:opacity-60">{working ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <UploadCloud className="h-9 w-9 text-primary" />}<div className="mt-4 text-base font-bold">Ajouter le contrat</div><div className="mt-1 text-sm text-muted-foreground">Word (.doc/.docx) ou PDF · 20 Mo max</div></button></Card> : <Card className="p-5 lg:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="truncate font-bold">{value.contractTitle || "Contrat"}</div><div className="mt-1 text-xs text-muted-foreground">Stocké directement dans ce deal</div></div><Button variant="outline" asChild><a href={value.contractUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Ouvrir</a></Button><Button variant="outline" onClick={() => inputRef.current?.click()} disabled={working}>Remplacer</Button><Button variant="ghost" onClick={() => void remove()} disabled={working}><Trash2 className="mr-2 h-4 w-4" />Retirer</Button></div></Card>}

    {value.contractUrl ? <Card className="p-5 lg:p-6"><div className="text-sm font-black">Signature</div><p className="mt-1 text-xs leading-5 text-muted-foreground">Si la signature a été faite hors Gando, renseigne la date réelle. Le deal sera alors considéré comme signé.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label><span className="text-xs font-bold">Date de signature</span><Input className="mt-2" type="datetime-local" value={signedAt} onChange={event => setSignedAt(event.target.value)} disabled={signed} /></label><label><span className="text-xs font-bold">Email du signataire <span className="font-normal text-muted-foreground">(optionnel)</span></span><Input className="mt-2" type="email" value={signedByEmail} onChange={event => setSignedByEmail(event.target.value)} placeholder="direction@client.fr" disabled={signed} /></label></div><div className="mt-5 flex justify-end"><Button onClick={() => void markSigned()} disabled={working || signed}>{working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}{signed ? "Contrat signé" : "Marquer comme signé"}</Button></div></Card> : null}
  </div></div>;
}