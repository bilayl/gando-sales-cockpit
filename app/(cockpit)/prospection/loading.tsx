import { ProspectionPageSkeleton } from "@/components/prospection-page-skeleton";

export default function ProspectionLoading() {
  return (
    <div className="h-[calc(100svh-3rem)] min-h-0 min-w-0 overflow-hidden">
      <ProspectionPageSkeleton />
    </div>
  );
}
