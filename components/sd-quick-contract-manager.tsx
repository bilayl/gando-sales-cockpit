"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, FileText, Loader2, Save, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createEmptySD05, type SD05Content } from "@/lib/sd-stage-content";
import type { SDDocumentRecord, SDRoomRecord } from "@/lib/sd-room-types";

type RoomResponse = { room: SDRoomRecord | null; documents: SDDocumentRecord[] };
type ManualStatus = "draft" | "ready_to_sign" | "signed";

const STATUS_OPTIONS: Array<{ value: ManualStatus; label: string }> = [
  { value: "draft", label: "Pas rédigé" },
  { value: "ready_to_sign", label: "En attente de signature" },
  { value: "signed", label: "Signé" },
];

function manualStatus(value?: SD05Content["contractStatus"]): ManualStatus {
  if (value === "signed") return "signed";
  if (value === "ready_to_sign" || value === "client_review") return "ready_to_sign";
  return "draft";
}

function statusLabel(value: ManualStatus) {
  return STATUS_OPTIONS.find(option => option.value === value)?.label || "Pas rédigé";
}

export function SDQuickContractManager({ dealId, onChanged }: { dealId: string; onChanged?: () => void }) {
  const [data, setData] = useState<RoomResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<ManualStatus>("draft");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Chargement impossible");
      setData(payload);
      const document = (payload.documents || []).find((item: SDDocumentRecord) => item.code === "SD05");
      const content = document?.content as Partial<SD05Content> | undefined;
      setSelectedStatus(manualStatus(content?.contractStatus));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { void load(); }, [load]);

  const document = data?.documents.find(item => item.code === "SD05");
  const contract = { ...createEmptySD05(), ...((document?.content || {}) as Partial<SD05Content>) };
  const generated = Boolean(!contract.contractUrl && contract.contractTitle && contract.contractSummary);
  const hasContract = Boolean(contract.contractUrl || generated);
  const currentStatus = manualStatus(contract.contractStatus);
  const contractHref = contract.contractUrl || (generated
    ? `/api/deals/${encodeURIComponent(dealId)}/sd-room/sd05-pdf`
    : "");
  const statusChanged = selectedStatus !== currentStatus;

  async function upload(file: File) {
    setWorking(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/quick-contract`, { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Import impossible");
      toast.success("Contrat enregistré. Sélectionne son statut manuellement.");
      onChanged?.();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import impossible");
    } finally {
      setWorking(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function saveStatus() {
    if (!statusChanged) return;
    if (selectedStatus !== "draft" && !hasContract) return toast.error("Ajoute d'abord un contrat.");
    if (selectedStatus === "signed" && !window.confirm("Confirmer que le contrat a été signé en dehors de Gando ? Aucun processus de signature ne sera déclenché.")) return;
    setWorking(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/quick-contract`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "set_status", contractStatus: selectedStatus }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Statut non enregistré");
      toast.success(`Statut mis à jour : ${statusLabel(selectedStatus)}`);
      onChanged?.();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Statut non enregistré");
    } finally {
      setWorking(false);
    }
  }

  async function remove() {
    if (!hasContract || !window.confirm("Retirer ce contrat de la Dealroom et remettre son statut sur « Pas rédigé » ?")) return;
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

  return <div className="page-shell min-h-screen p-5 lg:p-7">
    <div className="mx-auto max-w-[880px] space-y-5">
      <Card className="p-5 lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.14em] text-primary">Deal rapide · Étape 2</div>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.03em]">Contrat</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Enregistre le contrat dans la Dealroom et mets son statut à jour toi-même. Aucun outil de signature électronique ni envoi automatique.</p>
          </div>
          <Badge variant="outline" className={currentStatus === "signed" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600" : ""}>
            {currentStatus === "signed" ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : null}
            {statusLabel(currentStatus)}
          </Badge>
        </div>
      </Card>

      <input ref={inputRef} type="file" accept=".doc,.docx,.pdf" className="hidden" onChange={event => {
        const file = event.target.files?.[0]; if (file) void upload(file);
      }} />

      <Card className="p-5 lg:p-6">
        <div className="text-sm font-black">Document contractuel</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Dépose un PDF ou un fichier Word (20 Mo maximum). Le document est conservé avec ce deal, sans lancement de signature.</p>
        {hasContract ? <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-border p-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{contract.contractTitle || "Contrat enregistré"}</div>
            <p className="mt-1 text-xs text-muted-foreground">{generated ? "Document précédemment généré" : "Document enregistré dans la Dealroom"}</p>
          </div>
          <Button variant="outline" size="sm" asChild><a href={contractHref} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" />Voir</a></Button>
          <Button variant="outline" size="sm" disabled={working} onClick={() => inputRef.current?.click()}><UploadCloud className="mr-1.5 h-4 w-4" />Remplacer</Button>
          <Button variant="ghost" size="sm" disabled={working} onClick={() => void remove()}><Trash2 className="mr-1.5 h-4 w-4" />Retirer</Button>
        </div> : <button type="button" onClick={() => inputRef.current?.click()} disabled={working}
          className="mt-5 flex min-h-[155px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 p-6 text-center transition hover:border-primary/50 hover:bg-primary/[0.03] disabled:opacity-50">
          <UploadCloud className="h-7 w-7 text-primary" />
          <span className="mt-2 text-sm font-bold">Importer le contrat</span>
          <span className="mt-1 text-xs text-muted-foreground">PDF, DOC ou DOCX</span>
        </button>}
      </Card>

      <Card className="p-5 lg:p-6">
        <div className="text-sm font-black">Statut du contrat</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Statut renseigné uniquement par l’équipe Gando. « Signé » signifie que la signature a été obtenue en dehors de la plateforme.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-[225px] flex-1">
            <span className="text-xs font-bold">Choisir un statut</span>
            <select className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium" value={selectedStatus} disabled={working}
              onChange={event => setSelectedStatus(event.target.value as ManualStatus)}>
              {STATUS_OPTIONS.map(option => <option key={option.value} value={option.value} disabled={!hasContract && option.value !== "draft"}>{option.label}</option>)}
            </select>
          </label>
          <Button disabled={working || !statusChanged || (selectedStatus !== "draft" && !hasContract)} onClick={() => void saveStatus()}>
            {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Enregistrer le statut
          </Button>
        </div>
        {data?.room?.contract_signed_at && currentStatus === "signed" ? <p className="mt-3 text-xs text-muted-foreground">Marqué signé le {new Date(data.room.contract_signed_at).toLocaleDateString("fr-FR")} par l’équipe Gando.</p> : null}
        {statusChanged ? <p className="mt-3 text-xs text-amber-600">Statut modifié, mais pas encore enregistré.</p> : null}
      </Card>
    </div>
  </div>;
}
