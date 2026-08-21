"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, ImageIcon, Loader2, RefreshCw, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SDRoomBrandBanner, SD_ROOM_BANNER_THEMES } from "@/components/sd-room-brand-banner";
import type { SDRoomBrandTheme, SDRoomRecord } from "@/lib/sd-room-types";
import { cn } from "@/lib/utils";

type BrandingResponse = { room: SDRoomRecord | null };

export function SDRoomBrandingEditorV2({ dealId }: { dealId: string }) {
  const [room, setRoom] = useState<SDRoomRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [theme, setTheme] = useState<SDRoomBrandTheme>("gando");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");

  const apply = useCallback((next: SDRoomRecord) => {
    setRoom(next);
    setCompanyName(next.company_name || "");
    setLogoUrl(next.prospect_logo_url || "");
    setBannerUrl(next.brand_banner_image_url || "");
    setTheme(next.brand_theme || "gando");
    setTitle(next.brand_title || next.title || "");
    setSubtitle(next.brand_subtitle || "Espace de collaboration");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { cache: "no-store" });
      const payload = await response.json() as BrandingResponse & { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.message || payload.error || "Impossible de charger le branding.");
      if (!payload.room) throw new Error("Créez d’abord la Room SD dans l’onglet Contenu SD.");
      apply(payload.room);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [apply, dealId]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!room) return;
    if (!companyName.trim()) { toast.error("Le nom de l’entreprise est obligatoire."); return; }
    setSaving(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "settings",
          accessMode: room.access_mode,
          allowedEmails: room.allowed_emails || [],
          companyName: companyName.trim(),
          prospectLogoUrl: logoUrl.trim(),
          brandBannerImageUrl: bannerUrl.trim(),
          brandTheme: theme,
          brandTitle: title.trim(),
          brandSubtitle: subtitle.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Enregistrement impossible.");
      apply(payload.room);
      toast.success("Branding client enregistré");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="grid min-h-[70vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error || !room) return <div className="mx-auto max-w-2xl p-6"><Card className="p-8 text-center"><p className="text-sm text-destructive">{error || "Room introuvable"}</p><Button variant="outline" className="mt-4" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" /> Réessayer</Button></Card></div>;

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/r/${room.share_token}` : "";

  return (
    <div className="page-shell min-h-screen p-5 lg:p-7">
      <div className="mx-auto max-w-[1280px] space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Site client</div><h1 className="mt-1 text-2xl font-black tracking-[-0.035em]">Branding de la Deal Room</h1><p className="mt-1 text-sm text-muted-foreground">Cette bannière est exactement celle affichée sur le lien public de la Deal Room.</p></div>
          <div className="flex gap-2"><Button variant="outline" disabled={room.status !== "published" || !shareUrl} onClick={async () => { await navigator.clipboard.writeText(shareUrl); toast.success("Lien client copié"); }}><Copy className="mr-2 h-4 w-4" /> Lien client</Button><Button onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Enregistrer</Button></div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(380px,.85fr)]">
          <Card className="overflow-hidden p-0">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4 lg:px-6"><Sparkles className="h-4 w-4 text-primary" /><h2 className="font-bold">Aperçu de la bannière client</h2></div>
            <SDRoomBrandBanner companyName={companyName} logoUrl={logoUrl} bannerUrl={bannerUrl} theme={theme} title={title} subtitle={subtitle} />
            <div className="space-y-4 p-5 lg:p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Nom de l’entreprise</Label><Input className="mt-2" value={companyName} onChange={event => setCompanyName(event.target.value)} placeholder="ACME" /></div>
                <div><Label>Logo entreprise · URL</Label><Input className="mt-2" value={logoUrl} onChange={event => setLogoUrl(event.target.value)} placeholder="https://…/logo.svg" /></div>
              </div>
              <div><Label>Image de bannière · URL <span className="font-normal text-muted-foreground">(optionnelle)</span></Label><div className="mt-2 flex items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/30">{bannerUrl ? <img src={bannerUrl} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}</div><Input value={bannerUrl} onChange={event => setBannerUrl(event.target.value)} placeholder="Laisser vide pour la bannière Gando" /></div></div>
            </div>
          </Card>

          <div className="space-y-5">
            <Card className="p-5">
              <h2 className="font-bold">Contenu de la hero</h2>
              <div className="mt-4 space-y-4"><div><Label>Titre affiché</Label><Input className="mt-2" value={title} onChange={event => setTitle(event.target.value)} placeholder={`${companyName || "Client"} × Gando`} /></div><div><Label>Sous-titre de la bannière</Label><textarea value={subtitle} onChange={event => setSubtitle(event.target.value)} rows={3} className="mt-2 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" placeholder="Espace de collaboration" /></div></div>
            </Card>

            <Card className="p-5">
              <h2 className="font-bold">Style de bannière</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {SD_ROOM_BANNER_THEMES.map(item => <button key={item.value} type="button" onClick={() => setTheme(item.value)} className={cn("rounded-xl border p-2 text-left transition", theme === item.value ? "border-primary bg-primary/[0.05] ring-2 ring-primary/10" : "border-border hover:border-primary/40")}><div className={cn("h-14 rounded-lg bg-gradient-to-br", item.preview)} /><div className="mt-2 flex items-center justify-between text-xs font-semibold"><span>{item.label}</span>{theme === item.value ? <Check className="h-3.5 w-3.5 text-primary" /> : null}</div></button>)}
              </div>
              <p className="mt-3 text-[11px] leading-5 text-muted-foreground">Le site public réutilise maintenant ce composant à l’identique : même thème, même image, même voile, mêmes logos, même titre et même sous-titre.</p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
