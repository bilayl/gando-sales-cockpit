import { WithAlloHistoryView } from "@/components/withallo-history-view";
import { getWithAlloStatus } from "@/lib/withallo";

export const dynamic = "force-dynamic";

export default async function PhonePage() {
  const status = await getWithAlloStatus();
  return (
    <div className="page-shell">
      <div className="page-content space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Téléphonie · Allo</div>
            <h1 className="mt-1 text-2xl font-semibold">Appels</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Passez et recevez vos appels avec Allo ; retrouvez ici les enregistrements audio, transcriptions et résumés de vos conversations.</p>
          </div>
          <span className="rounded-full border border-border px-3 py-1 text-xs">{status.connected ? "API Allo connectée" : status.configured ? "API Allo à vérifier" : "Allo à configurer"}</span>
        </div>
        {status.error ? <div className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{status.error}</div> : null}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm">Depuis une fiche CRM, cliquez sur « Appeler avec Allo » : le vrai téléphone Allo s’ouvre dans le Cockpit et préremplit le numéro. Chaque commercial se connecte avec son compte Allo dans le composeur. Les appels enregistrés dans Allo sont ensuite écoutables et téléchargeables directement dans cet historique. L’intégration embarquée doit être autorisée pour room.gando.pro par l’équipe Allo.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3"><a href="/settings/integrations" className="text-xs font-medium text-primary hover:underline">Paramètres Allo</a><a href="https://web.withallo.com/" target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary hover:underline">Ouvrir Allo</a><a href="https://help.withallo.com/en/integrations/dialer/embedded-dialer" target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary hover:underline">Activer le téléphone embarqué</a></div>
        </div>
        <WithAlloHistoryView />
      </div>
    </div>
  );
}
