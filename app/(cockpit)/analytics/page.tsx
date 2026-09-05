import { AnalyticsOnoffLive } from "@/components/analytics-onoff-live";
import { AnalyticsView } from "@/components/analytics-view";

export default function Page() {
  return (
    <>
      <div className="page-shell">
        <div className="page-content pb-0">
          <section>
            <div className="mb-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">CRM · Stats</div>
              <h2 className="mt-1 text-lg font-bold tracking-[-0.025em]">Appels Onoff du jour</h2>
              <p className="mt-1 text-sm text-muted-foreground">Statuts, volume d’appels et performance quotidienne des commerciaux.</p>
            </div>
            <AnalyticsOnoffLive />
          </section>
        </div>
      </div>
      <AnalyticsView />
    </>
  );
}
