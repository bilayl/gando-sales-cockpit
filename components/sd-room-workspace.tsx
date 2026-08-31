"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Eye, FileSignature, FileText, ListChecks, Palette, Presentation, Settings2 } from "lucide-react";
import { FortuneoTestResign } from "@/components/fortuneo-test-resign";
import { SD02PlanBuilder } from "@/components/sd02-plan-builder";
import { SD03SolutionBuilder } from "@/components/sd03-solution-builder";
import { SD04OfferBuilder } from "@/components/sd04-offer-builder";
import { SD05ContractBuilder } from "@/components/sd05-contract-builder";
import { SDDocumentAnalyticsStrip } from "@/components/sd-document-analytics-strip";
import { SDQuickContractManager } from "@/components/sd-quick-contract-manager";
import { SDQuickDealTimeline } from "@/components/sd-quick-deal-timeline";
import { SDQuickProposalBuilder } from "@/components/sd-quick-proposal-builder";
import { SDRoomBrandingEditorV2 } from "@/components/sd-room-branding-editor-v2";
import { SDRoomEditor } from "@/components/sd-room-editor";
import { SDRoomPreview } from "@/components/sd-room-preview";
import type { SDCode, SDRoomMode } from "@/lib/sd-room-types";
import { cn } from "@/lib/utils";

type WorkspaceTab = "content" | "plan" | "solution" | "offer" | "contract" | "branding" | "preview";
const CODE_BY_TAB: Partial<Record<WorkspaceTab, SDCode>> = { content: "SD01", plan: "SD02", solution: "SD03", offer: "SD04", contract: "SD05" };
const WORKSPACE_TABS: WorkspaceTab[] = ["content", "plan", "solution", "offer", "contract", "branding", "preview"];

const enterpriseTabs: Array<{ value: WorkspaceTab; label: string; icon: typeof FileText }> = [
  { value: "content", label: "SD01 · Synthèse", icon: FileText },
  { value: "plan", label: "SD02 · Plan d’action", icon: ListChecks },
  { value: "solution", label: "SD03 · Solution", icon: Settings2 },
  { value: "offer", label: "SD04 · Propal", icon: Presentation },
  { value: "contract", label: "SD05 · Contrat & signature", icon: FileSignature },
  { value: "branding", label: "Branding", icon: Palette },
  { value: "preview", label: "Prévisualisation", icon: Eye },
];

const quickTabs: Array<{ value: WorkspaceTab; label: string; icon: typeof FileText }> = [
  { value: "offer", label: "Propal", icon: Presentation },
  { value: "contract", label: "Contrat", icon: FileSignature },
];

export function SDRoomWorkspace({ dealId }: { dealId: string }) {
  const [tab, setTab] = useState<WorkspaceTab>("content");
  const [roomMode, setRoomMode] = useState<SDRoomMode | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadRoomMode() {
      try {
        const response = await fetch("/api/sd-rooms", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || payload.error || "Chargement impossible");
        const room = (payload.results || []).find((item: { hubspot_deal_id?: string; room_mode?: SDRoomMode }) => item.hubspot_deal_id === dealId);
        const mode: SDRoomMode = room?.room_mode === "enterprise" ? "enterprise" : "standard";
        if (cancelled) return;
        setRoomMode(mode);
        const requested = new URLSearchParams(window.location.search).get("tab") as WorkspaceTab | null;
        if (mode === "standard") setTab(requested === "contract" ? "contract" : "offer");
        else if (requested && WORKSPACE_TABS.includes(requested)) setTab(requested);
      } catch {
        if (!cancelled) setRoomMode("enterprise");
      }
    }
    void loadRoomMode();
    return () => { cancelled = true; };
  }, [dealId]);

  const tabs = useMemo(() => roomMode === "standard" ? quickTabs : enterpriseTabs, [roomMode]);
  const analyticsCode = CODE_BY_TAB[tab];
  const quickDeal = roomMode === "standard";
  const changed = () => setRefreshKey(value => value + 1);

  return <div className="min-h-screen bg-background">
    <div className="sticky top-0 z-[60] border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] items-center gap-2 overflow-x-auto px-5 py-2 lg:px-7">
        <Link href="/deal-room" className="mr-2 flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Retour
        </Link>
        <span className="mr-2 h-6 w-px shrink-0 bg-border" />
        {tabs.map(item => {
          const Icon = item.icon;
          return <button key={item.value} type="button" onClick={() => setTab(item.value)} className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors", tab === item.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="h-3.5 w-3.5" /> {item.label}</button>;
        })}
        <span className="ml-auto hidden shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:block">{quickDeal ? "Deal rapide" : "Deal entreprise"} · Gando</span>
      </div>
    </div>

    {quickDeal ? <SDQuickDealTimeline dealId={dealId} refreshKey={refreshKey} /> : analyticsCode ? <SDDocumentAnalyticsStrip dealId={dealId} code={analyticsCode} /> : null}
    {!quickDeal && tab === "contract" ? <FortuneoTestResign dealId={dealId} /> : null}

    {quickDeal ? (
      tab === "contract" ? <SDQuickContractManager dealId={dealId} onChanged={changed} /> : <SDQuickProposalBuilder dealId={dealId} onChanged={changed} />
    ) : tab === "content" ? (
      <div className="sd01-workspace w-full min-w-0"><SDRoomEditor dealId={dealId} /><style jsx global>{`.sd01-workspace nav[aria-label="Parcours SD"] { display: none !important; } .sd01-workspace a[href^="/deal-room/"] { display: none !important; }`}</style></div>
    ) : tab === "plan" ? <SD02PlanBuilder dealId={dealId} /> : tab === "solution" ? <SD03SolutionBuilder dealId={dealId} /> : tab === "offer" ? <SD04OfferBuilder dealId={dealId} /> : tab === "contract" ? <SD05ContractBuilder dealId={dealId} /> : tab === "branding" ? <SDRoomBrandingEditorV2 dealId={dealId} /> : <SDRoomPreview dealId={dealId} />}
  </div>;
}