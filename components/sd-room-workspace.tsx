"use client";

import { useState } from "react";
import { Eye, FileSignature, FileText, ListChecks, Palette, Presentation, Settings2 } from "lucide-react";
import { SD02PlanBuilder } from "@/components/sd02-plan-builder";
import { SD03SolutionBuilder } from "@/components/sd03-solution-builder";
import { SD04OfferBuilder } from "@/components/sd04-offer-builder";
import { SD05ContractBuilder } from "@/components/sd05-contract-builder";
import { SDDocumentAnalyticsStrip } from "@/components/sd-document-analytics-strip";
import { SDRoomBrandingEditorV2 } from "@/components/sd-room-branding-editor-v2";
import { SDRoomEditor } from "@/components/sd-room-editor";
import { SDRoomPreview } from "@/components/sd-room-preview";
import type { SDCode } from "@/lib/sd-room-types";
import { cn } from "@/lib/utils";

type WorkspaceTab = "content" | "plan" | "solution" | "offer" | "contract" | "branding" | "preview";
const CODE_BY_TAB: Partial<Record<WorkspaceTab, SDCode>> = { content: "SD01", plan: "SD02", solution: "SD03", offer: "SD04", contract: "SD05" };

export function SDRoomWorkspace({ dealId }: { dealId: string }) {
  const [tab, setTab] = useState<WorkspaceTab>("content");
  const tabs: Array<{ value: WorkspaceTab; label: string; icon: typeof FileText }> = [
    { value: "content", label: "SD01 · Synthèse", icon: FileText },
    { value: "plan", label: "SD02 · Plan d’action", icon: ListChecks },
    { value: "solution", label: "SD03 · Solution", icon: Settings2 },
    { value: "offer", label: "SD04 · PDF commercial", icon: Presentation },
    { value: "contract", label: "SD05 · Contrat & signature", icon: FileSignature },
    { value: "branding", label: "Branding", icon: Palette },
    { value: "preview", label: "Prévisualisation", icon: Eye },
  ];
  const analyticsCode = CODE_BY_TAB[tab];
  return <div className="min-h-screen bg-background">
    <div className="sticky top-0 z-[60] border-b border-border bg-background/95 backdrop-blur"><div className="mx-auto flex max-w-[1500px] items-center gap-2 overflow-x-auto px-5 py-2 lg:px-7">{tabs.map(item => { const Icon = item.icon; return <button key={item.value} type="button" onClick={() => setTab(item.value)} className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors", tab === item.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="h-3.5 w-3.5" /> {item.label}</button>; })}<span className="ml-auto hidden shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:block">Room SD · Gando</span></div></div>
    {analyticsCode ? <SDDocumentAnalyticsStrip dealId={dealId} code={analyticsCode} /> : null}
    {tab === "content" ? <div className="sd01-workspace min-w-0"><SDRoomEditor dealId={dealId} /><style jsx global>{`.sd01-workspace nav[aria-label="Parcours SD"] { display: none !important; }`}</style></div> : tab === "plan" ? <SD02PlanBuilder dealId={dealId} /> : tab === "solution" ? <SD03SolutionBuilder dealId={dealId} /> : tab === "offer" ? <SD04OfferBuilder dealId={dealId} /> : tab === "contract" ? <SD05ContractBuilder dealId={dealId} /> : tab === "branding" ? <SDRoomBrandingEditorV2 dealId={dealId} /> : <SDRoomPreview dealId={dealId} />}
  </div>;
}
