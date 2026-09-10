"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PhoneCall } from "lucide-react";
import { ProspectionSession } from "@/components/prospection-session";
import { Button } from "@/components/ui/button";

type Company = { id: string; properties: Record<string, string | null | undefined> };

export function DirectProspectionSession({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function prepareSession() {
      setLoading(true);
      setError("");
      try {
        const assignmentResponse = await fetch("/api/prospection/assignments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ companyIds: [companyId] }),
          signal: controller.signal,
        });
        const assignmentPayload = await assignmentResponse.json().catch(() => ({}));
        if (!assignmentResponse.ok) throw new Error(assignmentPayload.error || "Impossible d’attribuer ce lead.");
        const claimed = new Set((assignmentPayload.claimedCompanyIds || []).map(String));
        if (!claimed.has(companyId)) throw new Error("Ce lead est déjà attribué à un autre commercial.");

        const response = await fetch(`/api/companies/${encodeURIComponent(companyId)}/centralized`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.company) throw new Error(payload.error || "Impossible de charger la fiche de session.");
        setCompany(payload.company as Company);
      } catch (cause) {
        if ((cause as Error).name !== "AbortError") setError(cause instanceof Error ? cause.message : "Impossible d’ouvrir la session d’appel.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void prepareSession();
    return () => controller.abort();
  }, [companyId]);

  if (loading) {
    return <div className="grid min-h-[70vh] place-items-center"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Préparation de la session d’appel…</div></div>;
  }

  if (error || !company) {
    return (
      <div className="grid min-h-[70vh] place-items-center px-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-6 text-center">
          <PhoneCall className="mx-auto h-6 w-6 text-muted-foreground" />
          <h1 className="mt-3 text-lg font-semibold">Session indisponible</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{error || "Impossible de charger ce lead."}</p>
          <Button className="mt-5" onClick={() => router.push("/today")}>Retour à Aujourd’hui</Button>
        </div>
      </div>
    );
  }

  return (
    <ProspectionSession
      open
      onOpenChange={open => { if (!open) router.push("/today"); }}
      companies={[company]}
      onOpenCompany={id => router.push(`/companies/${id}`)}
    />
  );
}
