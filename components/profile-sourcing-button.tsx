"use client";

import { Loader2, Search, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = {
  entityType: "company" | "contact";
  entityId: string;
  onCompleted?: () => void | Promise<void>;
  className?: string;
  label?: string;
};

type RunRef = {
  runId: string;
  datasetId?: string;
  territory?: string;
};

type ProfileEnrichmentResponse = {
  ok?: boolean;
  found?: boolean;
  pending?: boolean;
  runs?: RunRef[];
  updatedCompanyFields?: string[];
  updatedContactFields?: string[];
  contactsCreated?: number;
  contactsReused?: number;
  contactsFailed?: number;
  prospect?: { contacts?: Array<unknown> };
  message?: string;
  error?: unknown;
};

type CompanyWebsiteResponse = {
  ok?: boolean;
  website?: string | null;
  domain?: string | null;
  source?: string;
  updatedFields?: string[];
  error?: unknown;
};

function readableError(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value instanceof Error && value.message) return value.message;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["message", "error", "detail", "details", "code"]) {
      const nested = record[key];
      if (typeof nested === "string" && nested.trim()) return nested.trim();
      if (nested && typeof nested === "object") {
        const message = readableError(nested, "");
        if (message) return message;
      }
    }
    try {
      const serialized = JSON.stringify(value);
      if (serialized && serialized !== "{}") return serialized;
    } catch {}
  }
  return fallback;
}

function delay(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

export function ProfileSourcingButton({ entityType, entityId, onCompleted, className, label = "Enrichir cette fiche" }: Props) {
  const [busy, setBusy] = useState(false);

  async function ensureCompanyWebsite() {
    if (entityType !== "company") return null;
    const response = await fetch("/api/enrichment/company-website", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ companyId: entityId }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({})) as CompanyWebsiteResponse;
    if (!response.ok) throw new Error(readableError(payload.error, "Impossible de récupérer le site web de l’entreprise."));
    return payload;
  }

  async function requestEnrichment(apifyRunRefs?: RunRef[]) {
    const response = await fetch("/api/enrichment/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entityType, entityId, apifyRunRefs, waitSeconds: apifyRunRefs?.length ? 0 : undefined }),
    });
    const payload = await response.json().catch(() => ({})) as ProfileEnrichmentResponse;
    if (!response.ok) throw new Error(readableError(payload.error, "L’enrichissement de la fiche a échoué."));
    return payload;
  }

  async function run() {
    if (busy) return;
    setBusy(true);
    try {
      const websiteBefore = await ensureCompanyWebsite();
      const websiteUpdatedBefore = Boolean(websiteBefore?.updatedFields?.length);
      if (websiteBefore?.website && websiteUpdatedBefore) {
        const siteLabel = websiteBefore.domain || websiteBefore.website;
        toast.info(`Site web récupéré : ${siteLabel}`);
      }

      let payload = await requestEnrichment();
      let runs = (payload.runs || []).filter(run => run.runId);

      if (payload.pending && runs.length) {
        toast.info("Apify recherche les coordonnées et décideurs associés à cette fiche…");
        for (let attempt = 0; attempt < 10 && payload.pending; attempt += 1) {
          await delay(attempt < 2 ? 3_000 : 5_000);
          payload = await requestEnrichment(runs);
          runs = (payload.runs || runs).filter(run => run.runId);
          if (payload.found && !payload.pending) break;
        }
      }

      if (!payload.found) {
        if (websiteUpdatedBefore) await onCompleted?.();
        toast.info(payload.pending
          ? "L’enrichissement Apify continue, mais aucun résultat fiable n’est encore disponible."
          : payload.message || "Aucune donnée suffisamment fiable n’a été trouvée.");
        return;
      }

      const websiteAfter = await ensureCompanyWebsite();
      const websiteUpdatedAfter = Boolean(websiteAfter?.updatedFields?.length);
      if (websiteAfter?.website && websiteUpdatedAfter) {
        const siteLabel = websiteAfter.domain || websiteAfter.website;
        toast.info(`Site web ajouté : ${siteLabel}`);
      }

      const companyFields = payload.updatedCompanyFields?.length || 0;
      const contactFields = payload.updatedContactFields?.length || 0;
      const created = Number(payload.contactsCreated || 0);
      const reused = Number(payload.contactsReused || 0);
      const failed = Number(payload.contactsFailed || 0);
      const pieces = [
        companyFields ? `${companyFields} champ(s) entreprise complété(s)` : "",
        contactFields ? `${contactFields} champ(s) contact complété(s)` : "",
        websiteUpdatedAfter ? "site web ajouté" : "",
        created ? `${created} contact(s) créé(s)` : "",
        reused ? `${reused} contact(s) associé(s)` : "",
      ].filter(Boolean);

      toast.success(pieces.length ? pieces.join(" · ") : "Fiche vérifiée et enrichie.");
      if (failed) toast.warning(`${failed} contact(s) n’ont pas pu être importés.`);
      await onCompleted?.();
    } catch (cause) {
      toast.error(readableError(cause, "Enrichissement impossible"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" className={className} onClick={() => void run()} disabled={busy}>
      {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
      {busy ? "Sourcing de la fiche…" : label}
      {!busy ? <Search size={13} className="opacity-60" /> : null}
    </Button>
  );
}
