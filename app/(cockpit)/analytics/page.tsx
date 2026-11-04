import { AircallHistoryView } from "@/components/aircall-history-view";
import { AnalyticsView } from "@/components/analytics-view";

export default function Page() {
  return (
    <>
      <div className="page-shell"><div className="page-content pb-0"><AircallHistoryView compact limit={80} /></div></div>
      <AnalyticsView />
    </>
  );
}
