"use client";

import { ArrowRight, Phone, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Recommendation = {
  id: string;
  title: string;
  subtitle?: string;
  phone?: string | null;
  priorityLabel: string;
  reason: string;
  suggestion: string;
};

type Props = {
  title?: string;
  items: Recommendation[];
  onOpen: (id: string) => void;
  emptyLabel?: string;
};

export function CallRecommendationStrip({
  title = "Suggestions d'appels",
  items,
  onOpen,
  emptyLabel = "Aucun appel prioritaire avec les filtres actuels.",
}: Props) {
  return (
    <div className="border-y border-border bg-primary/[0.025] px-4 py-3.5 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary"><Sparkles size={14} /></span>
            {title}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Ordonnées automatiquement selon le statut de prospection, le dernier résultat d'appel et les relances arrivées à échéance.</p>
        </div>
        <Badge variant="outline" className="border-primary/20 bg-card text-primary">{items.length} recommandation{items.length > 1 ? "s" : ""}</Badge>
      </div>

      {items.length ? (
        <div className="grid gap-2 xl:grid-cols-3">
          {items.slice(0, 3).map(item => (
            <div key={item.id} className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">{item.title}</div>
                  {item.subtitle ? <div className="mt-0.5 truncate text-xs text-muted-foreground">{item.subtitle}</div> : null}
                </div>
                <Badge variant="secondary" className="shrink-0 text-[10px]">{item.priorityLabel}</Badge>
              </div>
              <div className="mt-2 rounded-lg bg-muted/45 px-2.5 py-2">
                <div className="text-xs font-semibold text-primary">{item.suggestion}</div>
                <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{item.reason}</div>
              </div>
              <div className="mt-2.5 flex items-center justify-end gap-2">
                {item.phone ? (
                  <Button asChild size="sm" className="h-8 gap-1.5">
                    <a href={`tel:${item.phone}`}><Phone size={13} /> Appeler</a>
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => onOpen(item.id)}>
                  Ouvrir <ArrowRight size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground">{emptyLabel}</div>
      )}
    </div>
  );
}
