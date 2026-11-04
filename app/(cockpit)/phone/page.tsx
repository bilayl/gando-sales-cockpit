import { AircallHistoryView } from "@/components/aircall-history-view";
import { AircallCallButton } from "@/components/aircall-call-button";
import { getAircallStatus } from "@/lib/aircall";

export const dynamic = "force-dynamic";

export default async function PhonePage() {
  const status = await getAircallStatus();
  return (
    <div className="page-shell">
      <div className="page-content space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Téléphonie · Aircall</div>
            <h1 className="mt-1 text-2xl font-semibold">Appels</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Téléphone Aircall intégré dans le Cockpit, appels sortants par API et historique synchronisé.</p>
          </div>
          <span className="rounded-full border border-border px-3 py-1 text-xs">{status.connected ? "API Aircall connectée" : status.configured ? "API à vérifier" : "Aircall à configurer"}</span>
        </div>
        {status.error ? <div className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{status.error}</div> : null}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm">Pour ouvrir le téléphone intégré, utilise le bouton flottant en bas à droite. Depuis une fiche CRM, le numéro du contact est prérempli automatiquement.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3"><AircallCallButton phone="" label="Appeler un contact" className="hidden" /><a href="/settings/integrations" className="text-xs font-medium text-primary hover:underline">Paramètres Aircall</a><a href="https://workspace.aircall.io/" target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary hover:underline">Aircall Workspace</a></div>
        </div>
        <AircallHistoryView />
      </div>
    </div>
  );
}
