/** Placeholder rows while a table loads (also used by loading.tsx pages). */
export function DataTableSkeleton({
  columns = 4,
  rows = 5,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-2 rounded-xl border p-3"
    >
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: columns }, (_, c) => (
            <div
              key={c}
              className="bg-muted h-6 flex-1 animate-pulse rounded"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
