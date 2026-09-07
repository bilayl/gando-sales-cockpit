"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Filter, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COMPANY_PIPELINE, deriveCompanyStage } from "@/components/company-prospection-board";
import {
  COMPANY_FILTER_LABELS,
  activeCompanyFilterCount,
  companyPropertyValues,
  type CompanyFilterKey,
  type CompanyFilters,
} from "@/lib/company-multi-filters";

type Company = { id: string; properties: Record<string, string | null | undefined> };
type Owner = { id: string; firstName?: string; lastName?: string; email?: string };
type Option = { value: string; label: string; count: number };

type Props = {
  companies: Company[];
  owners: Owner[];
  value: CompanyFilters;
  onChange: (filters: CompanyFilters) => void;
};

const FILTER_ORDER: CompanyFilterKey[] = [
  "zip",
  "city",
  "state",
  "country",
  "industry",
  "fleetSize",
  "owner",
  "stage",
  "prospectionStatus",
  "callStatus",
];

const STAGE_LABELS = Object.fromEntries(COMPANY_PIPELINE.map(item => [item.value, item.label]));

function ownerLabel(owner: Owner) {
  return [owner.firstName, owner.lastName].filter(Boolean).join(" ") || owner.email || owner.id;
}

export function CompanyMultiFilter({ companies, owners, value, onChange }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<CompanyFilterKey | null>(null);
  const [search, setSearch] = useState("");
  const activeCount = activeCompanyFilterCount(value);
  const ownerNames = useMemo(() => new Map(owners.map(owner => [owner.id, ownerLabel(owner)])), [owners]);

  useEffect(() => {
    function closeOnOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveKey(null);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, []);

  const optionsByKey = useMemo(() => {
    const result = {} as Record<CompanyFilterKey, Option[]>;
    for (const key of FILTER_ORDER) {
      const counts = new Map<string, number>();
      for (const company of companies) {
        const stage = deriveCompanyStage(company);
        const uniqueValues = [...new Set(companyPropertyValues(company.properties, key, stage).map(item => String(item || "").trim()).filter(Boolean))];
        for (const item of uniqueValues) counts.set(item, (counts.get(item) || 0) + 1);
      }
      for (const selected of value[key] || []) {
        if (!counts.has(selected)) counts.set(selected, 0);
      }
      result[key] = [...counts.entries()]
        .map(([optionValue, count]) => ({
          value: optionValue,
          label: key === "owner"
            ? ownerNames.get(optionValue) || optionValue
            : key === "stage"
              ? STAGE_LABELS[optionValue] || optionValue
              : optionValue,
          count,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "fr", { numeric: true, sensitivity: "base" }));
    }
    return result;
  }, [companies, ownerNames, value]);

  const currentOptions = activeKey ? optionsByKey[activeKey] : [];
  const selectedValues = activeKey ? value[activeKey] || [] : [];
  const visibleOptions = currentOptions.filter(option => option.label.toLocaleLowerCase("fr-FR").includes(search.trim().toLocaleLowerCase("fr-FR")));

  function displayLabel(key: CompanyFilterKey, optionValue: string) {
    if (key === "owner") return ownerNames.get(optionValue) || optionValue;
    if (key === "stage") return STAGE_LABELS[optionValue] || optionValue;
    return optionValue;
  }

  function setValues(key: CompanyFilterKey, values: string[]) {
    const next: CompanyFilters = { ...value };
    if (values.length) next[key] = values;
    else delete next[key];
    onChange(next);
  }

  function toggleValue(key: CompanyFilterKey, optionValue: string) {
    const current = value[key] || [];
    setValues(key, current.includes(optionValue)
      ? current.filter(item => item !== optionValue)
      : [...current, optionValue]);
  }

  function clearAll() {
    onChange({});
    setActiveKey(null);
    setSearch("");
  }

  function openKey(key: CompanyFilterKey) {
    setActiveKey(key);
    setSearch("");
  }

  return (
    <div ref={rootRef} className="relative flex flex-wrap items-center gap-1.5">
      <Button
        type="button"
        variant={activeCount ? "secondary" : "outline"}
        size="sm"
        className="h-9 gap-1.5"
        onClick={() => { setOpen(current => !current); setActiveKey(null); setSearch(""); }}
      >
        <Filter size={14} /> Filtres
        {activeCount ? <Badge variant="outline" className="ml-0.5 h-5 min-w-5 px-1.5 text-[10px]">{activeCount}</Badge> : null}
      </Button>

      {FILTER_ORDER.filter(key => value[key]?.length).map(key => {
        const selected = value[key] || [];
        const first = selected[0];
        return (
          <button
            type="button"
            key={key}
            onClick={() => { setOpen(true); openKey(key); }}
            className="inline-flex h-9 max-w-[240px] items-center gap-1.5 rounded-md border border-primary/20 bg-primary/[0.04] px-2.5 text-[11px] font-medium text-primary hover:bg-primary/[0.07]"
          >
            <span className="truncate"><strong>{COMPANY_FILTER_LABELS[key]}</strong> · {displayLabel(key, first)}{selected.length > 1 ? ` +${selected.length - 1}` : ""}</span>
            <X size={12} className="shrink-0" onClick={event => { event.stopPropagation(); setValues(key, []); }} />
          </button>
        );
      })}

      {activeCount > 1 ? <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-[11px] text-muted-foreground" onClick={clearAll}>Effacer tout</Button> : null}

      {open ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-[80] w-[390px] overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
          {activeKey ? (
            <>
              <div className="flex items-center gap-2 border-b border-border px-3 py-3">
                <button type="button" onClick={() => { setActiveKey(null); setSearch(""); }} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowLeft size={16} /></button>
                <div className="font-semibold">{COMPANY_FILTER_LABELS[activeKey]}</div>
                <button
                  type="button"
                  className="ml-auto text-xs font-medium text-primary hover:underline"
                  onClick={() => setValues(activeKey, selectedValues.length === currentOptions.length ? [] : currentOptions.map(option => option.value))}
                >
                  {selectedValues.length === currentOptions.length && currentOptions.length ? "Tout désélectionner" : "Tout sélectionner"}
                </button>
              </div>
              <div className="p-3 pb-2">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input autoFocus value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher…" className="h-10 pl-9" />
                </div>
              </div>
              <div className="max-h-[330px] overflow-y-auto px-2 pb-2 minari-scrollbar">
                {visibleOptions.map(option => {
                  const checked = selectedValues.includes(option.value);
                  return (
                    <button type="button" key={option.value} onClick={() => toggleValue(activeKey, option.value)} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-sm hover:bg-muted/70">
                      <span className={`flex size-5 shrink-0 items-center justify-center rounded border ${checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}>{checked ? <Check size={13} /> : null}</span>
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      <span className="text-[10px] tabular-nums text-muted-foreground">{option.count}</span>
                    </button>
                  );
                })}
                {!visibleOptions.length ? <div className="px-3 py-8 text-center text-xs text-muted-foreground">Aucune valeur disponible dans les données enregistrées.</div> : null}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div><div className="font-semibold">Ajouter des filtres Entreprises</div><div className="mt-0.5 text-[10px] text-muted-foreground">Plusieurs valeurs = OU. Plusieurs critères = ET.</div></div>
                {activeCount ? <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={clearAll}>Réinitialiser</button> : null}
              </div>
              <div className="max-h-[430px] overflow-y-auto p-2 minari-scrollbar">
                {FILTER_ORDER.map(key => {
                  const selected = value[key]?.length || 0;
                  const options = optionsByKey[key]?.length || 0;
                  return (
                    <button type="button" key={key} onClick={() => openKey(key)} className="flex w-full items-center rounded-lg px-3 py-2.5 text-left hover:bg-muted/70">
                      <div className="min-w-0 flex-1"><div className="text-sm font-medium">{COMPANY_FILTER_LABELS[key]}</div><div className="text-[10px] text-muted-foreground">{options} valeur{options > 1 ? "s" : ""} disponible{options > 1 ? "s" : ""}</div></div>
                      {selected ? <Badge variant="secondary" className="mr-2 text-[10px]">{selected}</Badge> : null}
                      <span className="text-muted-foreground">›</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
