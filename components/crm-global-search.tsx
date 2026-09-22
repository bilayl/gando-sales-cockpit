"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ContactRound,
  Loader2,
  Search,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";

type SearchFilter = "all" | "contacts" | "companies";

type SearchResult = {
  id: string;
  type: "contact" | "company";
  title: string;
  subtitle: string;
  meta: string;
  href: string;
};

const FILTER_LABELS: Record<SearchFilter, string> = {
  all: "Tous",
  contacts: "Contacts",
  companies: "Entreprises",
};

function ResultIcon({ type }: { type: SearchResult["type"] }) {
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted/70 text-muted-foreground">
      {type === "company" ? <Building2 className="h-4 w-4" /> : <ContactRound className="h-4 w-4" />}
    </div>
  );
}

export function CrmGlobalSearch({ placement = "header" }: { placement?: "header" | "sidebar" }) {
  const router = useRouter();
  const open = useUIStore(state => state.commandMenuOpen);
  const setOpen = useUIStore(state => state.setCommandMenuOpen);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SearchFilter>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(!open);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setResults([]);
      setError("");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({ q: trimmed, filter });
        const response = await fetch(`/api/crm/search?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Recherche indisponible");
        setResults(payload.results || []);
      } catch (reason) {
        if (controller.signal.aborted) return;
        setResults([]);
        setError(reason instanceof Error ? reason.message : "Recherche indisponible");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [filter, open, query]);

  const grouped = useMemo(() => {
    const companies = results.filter(result => result.type === "company");
    const contacts = results.filter(result => result.type === "contact");
    return { companies, contacts };
  }, [results]);

  function navigate(result: SearchResult) {
    setOpen(false);
    setQuery("");
    router.push(result.href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group flex min-w-0 items-center gap-2 rounded-lg text-left text-xs text-muted-foreground transition",
          placement === "sidebar"
            ? "h-9 w-full border border-sidebar-border/60 bg-sidebar-accent/35 px-2.5 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:px-0"
            : "h-8 border border-border/60 bg-background px-2.5 hover:border-border hover:bg-muted/30 sm:w-[260px] lg:w-[320px]",
        )}
        aria-label="Rechercher dans le CRM"
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className={cn(
          "min-w-0 flex-1 truncate",
          placement === "sidebar" && "group-data-[collapsible=icon]:hidden",
        )}>Rechercher</span>
        <kbd className={cn(
          "rounded-md border border-border/70 bg-muted/50 px-1.5 py-0.5 font-sans text-[9px] font-medium text-muted-foreground",
          placement === "sidebar" ? "group-data-[collapsible=icon]:hidden" : "hidden sm:inline",
        )}>
          ⌘K
        </kbd>
      </button>

      <Dialog
        open={open}
        onOpenChange={next => {
          setOpen(next);
          if (!next) {
            setQuery("");
            setResults([]);
            setError("");
          }
        }}
      >
        <DialogContent
          className="top-[14vh] block w-[calc(100%-2rem)] max-w-[820px] translate-y-0 gap-0 overflow-hidden rounded-[26px] border border-border/70 bg-popover p-0 shadow-[0_30px_90px_-28px_rgba(15,23,42,0.42)] [&>button]:hidden"
        >
          <DialogTitle className="sr-only">Recherche CRM</DialogTitle>
          <DialogDescription className="sr-only">
            Rechercher des contacts et entreprises dans le Cockpit CRM.
          </DialogDescription>

          <div className="flex min-h-[92px] items-center gap-4 px-7">
            <Search className="h-7 w-7 shrink-0 text-muted-foreground/80" strokeWidth={1.8} />
            <input
              ref={inputRef}
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Rechercher"
              className="min-w-0 flex-1 bg-transparent text-[26px] font-normal tracking-[-0.025em] text-foreground outline-none placeholder:text-muted-foreground/80 sm:text-[30px]"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Effacer la recherche"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="hidden h-9 shrink-0 items-center rounded-xl border border-border/70 px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted/50 sm:inline-flex"
            >
              ESC
            </button>
          </div>

          <div className="flex min-h-[58px] items-center border-t border-border/55 bg-muted/[0.16] px-7">
            <span className="mr-2 text-sm text-muted-foreground">Filtre :</span>
            <Select value={filter} onValueChange={value => setFilter(value as SearchFilter)}>
              <SelectTrigger className="h-8 w-auto gap-1 border-0 bg-transparent px-1.5 text-sm font-semibold shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start" className="min-w-[150px]">
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="contacts">Contacts</SelectItem>
                <SelectItem value="companies">Entreprises</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className={cn(
            "border-t border-border/45 bg-background",
            query.trim().length >= 2 ? "max-h-[430px] overflow-y-auto" : "hidden",
          )}>
            {loading ? (
              <div className="flex h-28 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Recherche…
              </div>
            ) : error ? (
              <div className="px-7 py-8 text-sm text-destructive">{error}</div>
            ) : !results.length ? (
              <div className="px-7 py-9 text-center">
                <div className="text-sm font-medium">Aucun résultat</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Aucun {FILTER_LABELS[filter].toLowerCase()} ne correspond à « {query.trim()} ».
                </div>
              </div>
            ) : (
              <div className="p-2.5">
                {grouped.companies.length ? (
                  <div className="mb-2">
                    <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Entreprises
                    </div>
                    {grouped.companies.map(result => (
                      <button
                        type="button"
                        key={`company-${result.id}`}
                        onClick={() => navigate(result)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-muted/55 focus:bg-muted/55 focus:outline-none"
                      >
                        <ResultIcon type={result.type} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{result.title}</div>
                          <div className="mt-0.5 flex min-w-0 gap-2 text-[11px] text-muted-foreground">
                            {result.subtitle ? <span className="truncate">{result.subtitle}</span> : null}
                            {result.meta ? <span className="truncate">· {result.meta}</span> : null}
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground/70">Entreprise</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {grouped.contacts.length ? (
                  <div>
                    <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Contacts
                    </div>
                    {grouped.contacts.map(result => (
                      <button
                        type="button"
                        key={`contact-${result.id}`}
                        onClick={() => navigate(result)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-muted/55 focus:bg-muted/55 focus:outline-none"
                      >
                        <ResultIcon type={result.type} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{result.title}</div>
                          <div className="mt-0.5 flex min-w-0 gap-2 text-[11px] text-muted-foreground">
                            {result.subtitle ? <span className="truncate">{result.subtitle}</span> : null}
                            {result.meta ? <span className="truncate">· {result.meta}</span> : null}
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground/70">Contact</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
