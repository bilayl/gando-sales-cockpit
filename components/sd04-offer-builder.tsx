"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, FileText, Loader2, Save, Send, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createEmptySD04, type SD04Content } from "@/lib/sd-stage-content";
import type { SDDocumentRecord } from "@/lib/sd-room-types";

type RoomResponse = { documents: SDDocumentRecord[]; room: { id: string; title: string } | null };

function isPdfUrl(value: string) {
  return /^https?:\/\//i.test(value || "");
}

export function SD04OfferBuilder({ dealId }: { dealId: string }) {
  const [data, setData] = useState<RoomResponse | null>(null);
  const [value, setValue] = useState<SD04Content>(createEmptySD04());
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Chargement impossible");
      setData(payload);
      const document = payload.documents.find((item: SDDocumentRecord) => item.code === "SD04");
      setValue({ ...createEmptySD04(), ...((document?.content || {}) as Partial<SD04Content>) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { void load(); }, [load]);

  const sd02Validated = data?.documents.find(item => item.code === "SD02")?.status === "validated";
  const sd04 = data?.documents.find(item => item.code === "SD04");
  const pdfUrl = isPdfUrl(value.deckSubtitle) ? value.deckSubtitle : "";
  const pdfName = value.deckTitle || "Offre commerciale.pdf";

  const uploadPdf = async (file: File) => {
    if (!(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
      toast.error("Sélectionnez un fichier PDF.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Le PDF doit faire moins de 20 Mo.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/sd04-pdf`, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Import du PDF impossible");
      setValue({ ...createEmptySD04(), deckTitle: payload.name || file.name, deckSubtitle: payload.url || "" });
      toast.success("PDF importé. Enregistrez ou publiez maintenant le SD04.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import du PDF impossible");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const save = async (publish: boolean) => {
    if (!pdfUrl) {
      toast.error("Ajoutez d’abord le PDF du SD04.");
      return;
    }
    setWorking(true);
    try {
      const content: SD04Content = {
        ...createEmptySD04(),
        deckTitle: pdfName,
        deckSubtitle: pdfUrl,
      };
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/document`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "SD04", content, publish }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Enregistrement impossible");
      setData(current => current ? { ...current, documents: current.documents.map(document => document.code === "SD04" ? payload.document : document) } : current);
      setValue({ ...createEmptySD04(), ...(payload.document?.content || {}) });
      toast.success(publish ? "PDF SD04 publié dans la Room" : "PDF SD04 enregistré");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible");
    } finally {
      setWorking(false);
    }
  };

  if (loading && !data) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return <div className="page-shell min-h-screen p-5 lg:p-7"><div className="mx-auto max-w-[1050px] space-y-5">
    <Card className="overflow-hidden p-0">
      <div className="flex flex-col gap-4 border-b border-border bg-primary/[0.04] p-5 lg:flex-row lg:items-center">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><FileText className="h-5 w-5" /></div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-primary">SD04 · PDF commercial</div>
            <h1 className="mt-1 text-2xl font-bold tracking-[-0.03em]">Ajouter directement l’offre en PDF</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Le SD04 n’est plus à reconstruire dans la Deal Room : importez simplement le PDF commercial qui doit être partagé au client.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          {sd04?.status === "validated" ? <Badge variant="outline" className="border-emerald-500/30 text-emerald-600"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Validé client</Badge> : null}
          <Button variant="outline" onClick={() => void save(false)} disabled={working || uploading || !pdfUrl}><Save className="mr-2 h-4 w-4" /> Enregistrer</Button>
          <Button onClick={() => void save(true)} disabled={working || uploading || !pdfUrl || !sd02Validated}><Send className="mr-2 h-4 w-4" /> Publier</Button>
        </div>
      </div>
      {!sd02Validated ? <div className="border-b border-amber-500/20 bg-amber-500/[0.06] px-5 py-3 text-xs text-amber-700">SD02 doit être validé avant de publier SD04.</div> : null}
    </Card>

    <Card className="p-5 sm:p-7">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={event => { const file = event.target.files?.[0]; if (file) void uploadPdf(file); }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex min-h-[250px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/20 px-6 text-center transition hover:border-primary/50 hover:bg-primary/[0.03] disabled:opacity-60"
      >
        {uploading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <UploadCloud className="h-9 w-9 text-primary" />}
        <div className="mt-4 text-base font-semibold">{uploading ? "Import du PDF…" : pdfUrl ? "Remplacer le PDF" : "Importer le PDF du SD04"}</div>
        <div className="mt-1 text-sm text-muted-foreground">PDF uniquement · 20 Mo maximum</div>
      </button>
    </Card>

    {pdfUrl ? <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1"><div className="truncate font-semibold">{pdfName}</div><div className="mt-1 text-xs text-muted-foreground">PDF prêt à être partagé dans la Deal Room.</div></div>
      <Button variant="outline" asChild><a href={pdfUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> Ouvrir le PDF</a></Button>
    </Card> : null}
  </div></div>;
}
