"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Phone } from "lucide-react";
import { toast } from "sonner";
import { CompanyDrawer as CompanyDrawerBase } from "@/components/company-drawer-base";
import { ProfileSourcingOverlay } from "@/components/profile-sourcing-overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  companyId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function CompanyPhoneEditor({
  companyId,
  open,
  onSaved,
}: {
  companyId: string | null;
  open: boolean;
  onSaved: () => void;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [loadingPhone, setLoadingPhone] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditorOpen(false);
    setPhone("");
    if (!open || !companyId) return;

    const controller = new AbortController();
    setLoadingPhone(true);
    fetch(`/api/companies/${encodeURIComponent(companyId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Impossible de charger le téléphone");
        setPhone(String(payload?.company?.properties?.phone || ""));
      })
      .catch(cause => {
        if ((cause as Error).name !== "AbortError") console.error("Company phone preload:", cause);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingPhone(false);
      });

    return () => controller.abort();
  }, [companyId, open]);

  if (!open || !companyId || typeof document === "undefined") return null;

  async function savePhone() {
    const value = phone.trim();
    if (!value || !companyId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/companies/${encodeURIComponent(companyId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ properties: { phone: value } }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Impossible d’enregistrer le téléphone");
      toast.success("Numéro de téléphone entreprise mis à jour dans HubSpot.");
      setEditorOpen(false);
      onSaved();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Impossible d’enregistrer le téléphone");
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <>
      <div className="fixed bottom-5 left-5 z-[130] sm:bottom-8 sm:left-8">
        <Button className="gap-2 shadow-xl" onClick={() => setEditorOpen(true)} disabled={loadingPhone}>
          {loadingPhone ? <Loader2 size={15} className="animate-spin" /> : <Phone size={15} />}
          {phone ? "Modifier le téléphone" : "Ajouter le téléphone"}
        </Button>
      </div>

      {editorOpen ? (
        <div className="fixed inset-0 z-[140] grid place-items-center p-4">
          <button
            type="button"
            aria-label="Fermer"
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]"
            onClick={() => !saving && setEditorOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-xl border border-border bg-popover p-5 shadow-2xl">
            <div className="flex items-center gap-2">
              <Phone size={18} className="text-primary" />
              <h3 className="font-semibold">Téléphone de l’entreprise</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Modifie le numéro ci-dessous. Il sera enregistré sur la fiche entreprise HubSpot et dans le Sales Cockpit.
            </p>
            <Input
              autoFocus
              className="mt-4"
              type="tel"
              value={phone}
              onChange={event => setPhone(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter" && phone.trim() && !saving) void savePhone();
              }}
              placeholder="Ex. +33 6 12 34 56 78"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" disabled={saving} onClick={() => setEditorOpen(false)}>
                Annuler
              </Button>
              <Button disabled={!phone.trim() || saving} onClick={() => void savePhone()}>
                {saving ? <Loader2 size={15} className="mr-2 animate-spin" /> : null}
                Enregistrer la modification
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  );
}

export function CompanyDrawer(props: Props) {
  const { companyId, open } = props;
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <CompanyDrawerBase key={`${companyId || "none"}-${refreshKey}`} {...props} />
      <CompanyPhoneEditor
        companyId={companyId}
        open={open}
        onSaved={() => setRefreshKey(value => value + 1)}
      />
      <ProfileSourcingOverlay
        open={open}
        entityType="company"
        entityId={companyId}
        onCompleted={() => setRefreshKey(value => value + 1)}
      />
    </>
  );
}
