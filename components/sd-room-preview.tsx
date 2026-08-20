"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Eye, Loader2, LockKeyhole, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GandoMark } from "@/components/gando-mark";
import { SD_CODES, SD_STAGE_META, type SDDocumentRecord, type SDRoomRecord } from "@/lib/sd-room-types";
import { cn } from "@/lib/utils";

type PreviewResponse = { room: SDRoomRecord | null; documents: SDDocumentRecord[]; message?: string; error?: string };

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "CL";
}

function heroClass(theme: SDRoomRecord["brand_theme"]) {
  if (theme === "dark") return "from-[#14272e] via-[#273b49] to-[#10191d]";
  if (theme === "light") return "from-[#f4f0ff] via-[#e8e2ff] to-[#d8d0ff]";
  if (theme === "gradient") return "from-[#5238d4] via-[#7c65ef] to-[#ad9cf7]";
  return "from-[#7664ef] via-[#907ff4] to-[#a99bf6]";
}

export function SDRoomPreview({ dealId }: { dealId: string }) {
  const [data, setData] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { cache: "no-store" });
      const payload = await response.json() as PreviewResponse;
      if (!response.ok) throw new Error(payload.message || payload.error || "Impossible de charger l’aperçu.");
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger l’aperçu.");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { void load(); }, [load]);

  const room = data?.room;
  const publicDocuments = useMemo(() => (data?.documents || []).filter(document => document.status === "published" || document.status === "validated"), [data]);
  const shareUrl = room && typeof window !== "undefined" ? `${window.location.origin}/r/${room.share_token}` : "";

  if (loading) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error || !room) return <div className="mx-auto max-w-2xl p-6"><Card className="p-8 text-center"><p className="text-sm text-destructive">{error || "Créez d’abord la Room SD."}</p><Button variant="outline" className="mt-4" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" /> Réessayer</Button></Card></div>;

  const light = room.brand_theme === "light";
  return (
    <div className="page-shell min-h-screen p-5 lg:p-7">
      <div className="mx-auto max-w-[1380px] space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Prévisualisation</div><h1 className="mt-1 text-2xl font-black tracking-[-0.035em]">Page client de la Room</h1><p className="mt-1 text-sm text-muted-foreground">Aperçu sans créer de fausse consultation. Le bouton ouvre ensuite le lien public réel avec son écran Prénom · Nom · Email.</p></div>
          <Button asChild disabled={room.status !== "published"}><a href={shareUrl || "#"} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> Ouvrir la Room réelle</a></Button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-[#f7f9fa] shadow-sm">
          <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-3"><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" /><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" /><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" /><div className="mx-auto flex max-w-xl flex-1 items-center justify-center rounded-lg bg-muted/45 px-3 py-1.5 text-[11px] text-muted-foreground"><LockKeyhole className="mr-1.5 h-3 w-3" /> /r/{room.share_token.slice(0, 10)}…</div></div>

          <section className={cn("relative overflow-hidden bg-gradient-to-br px-6 py-12 text-center", heroClass(room.brand_theme))} style={room.brand_banner_image_url ? { backgroundImage: `linear-gradient(110deg, rgba(87,64,211,.84), rgba(157,139,245,.74)), url(${room.brand_banner_image_url})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}>
            <div className="mx-auto flex max-w-3xl flex-col items-center">
              <div className="flex items-center gap-8">
                {room.prospect_logo_url ? <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full border-2 border-white bg-white"><img src={room.prospect_logo_url} alt={`Logo ${room.company_name}`} className="h-full w-full object-contain p-2" /></div> : <div className="grid h-20 w-20 place-items-center rounded-full border-2 border-white bg-white text-lg font-black text-[#4d39b8]">{initials(room.company_name)}</div>}
                <span className={cn("text-4xl font-black", light ? "text-[#172a32]" : "text-white")}>×</span><GandoMark className="h-20 w-20" />
              </div>
              <div className={cn("mt-7 text-[10px] font-black uppercase tracking-[0.2em]", light ? "text-[#4d39b8]" : "text-white/75")}>Gando Deal Room</div>
              <h2 className={cn("mt-2 text-3xl font-black tracking-[-0.04em]", light ? "text-[#172a32]" : "text-white")}>{room.brand_title || room.title}</h2>
              <p className={cn("mt-3 max-w-2xl text-sm leading-6", light ? "text-[#637278]" : "text-white/80")}>{room.brand_subtitle || "Espace de collaboration stratégique"}</p>
            </div>
          </section>

          <div className="p-5 sm:p-7">
            <div className="grid gap-2 md:grid-cols-5">
              {SD_CODES.map(code => {
                const document = data.documents.find(item => item.code === code);
                const visible = document?.status === "published" || document?.status === "validated";
                return <div key={code} className={cn("rounded-xl border p-3", visible ? "border-[#e4e0f3] bg-white" : "border-[#ececef] bg-[#f2f3f5] opacity-55")}><div className="flex items-center justify-between"><span className="text-xs font-bold text-[#6f58e8]">{code}</span>{document?.status === "validated" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : null}</div><div className="mt-1 text-xs font-semibold text-[#172a32]">{SD_STAGE_META[code].title}</div><div className="mt-1 text-[10px] text-[#829096]">{document?.status === "validated" ? "Validé" : visible ? "Publié · à valider" : "En préparation"}</div></div>;
              })}
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
              <Card className="border-[#e4e0f3] bg-white p-6"><div className="flex items-center gap-2"><Eye className="h-4 w-4 text-[#6f58e8]" /><h3 className="font-bold text-[#172a32]">Contenu visible aujourd’hui</h3></div><div className="mt-4 space-y-3">{publicDocuments.map(document => <div key={document.code} className="rounded-xl border border-[#eceaf4] p-4"><div className="flex items-center justify-between gap-3"><div><div className="text-xs font-bold text-[#6f58e8]">{document.code}</div><div className="mt-1 font-semibold text-[#172a32]">{SD_STAGE_META[document.code].title}</div></div><span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold", document.status === "validated" ? "bg-emerald-50 text-emerald-700" : "bg-[#f0edff] text-[#5d4bc6]")}>{document.status === "validated" ? "Validé" : "À valider"}</span></div></div>)}{!publicDocuments.length ? <p className="text-sm text-muted-foreground">Aucune étape n’est encore publiée.</p> : null}</div></Card>
              <Card className="border-[#e4e0f3] bg-white p-6"><LockKeyhole className="h-5 w-5 text-[#6f58e8]" /><h3 className="mt-3 font-bold text-[#172a32]">Écran d’entrée</h3><p className="mt-2 text-sm leading-6 text-[#637278]">Le visiteur renseigne désormais <strong>Prénom</strong>, <strong>Nom</strong> et <strong>Email professionnel</strong>. Les validations sont ensuite attribuées et horodatées.</p></Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
