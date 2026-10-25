import { DataTableSkeleton } from "@/components/ui/data-table-skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="bg-muted h-8 w-48 animate-pulse rounded" />
      <DataTableSkeleton />
    </div>
  );
}
