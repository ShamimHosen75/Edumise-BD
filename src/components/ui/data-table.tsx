"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type FilterFn,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { csvFileName, toCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

import { DataTableSkeleton } from "./data-table-skeleton";

type Value = string | number | null;

export type DataTableColumn<T> = {
  id: string;
  header: string;
  /** Plain value used to search, sort, filter and export. */
  value: (row: T) => Value;
  /** Sort by this instead of the value (e.g. a name column sorted by rank). */
  sortValue?: (row: T) => Value;
  /** How the cell looks; defaults to the value. */
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
  /** Adds a drop-down filter that matches this column's value exactly. */
  filter?: { value: string; label: string }[];
  /** Leave out of the CSV file. */
  noCsv?: boolean;
  className?: string;
};

export type DataTableLabels = {
  search: string;
  all: string;
  empty: string;
  noMatches: string;
  exportCsv: string;
  previous: string;
  next: string;
  actions: string;
  /** "Page {page} of {pages}", already in the reader's digits. */
  pageOf: (page: number, pages: number) => string;
  /** "{count} rows". */
  count: (count: number) => string;
  sortBy: (column: string) => string;
};

type Props<T> = {
  /** Names the table for screen readers and the CSV file. */
  title: string;
  /** CSV file name (without .csv); defaults to the title. */
  csvName?: string;
  data: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  labels: DataTableLabels;
  rowActions?: (row: T) => React.ReactNode;
  /** Shown beside the search box (e.g. an "Add" button). */
  toolbar?: React.ReactNode;
  initialSort?: { id: string; desc?: boolean };
  pageSize?: number;
  loading?: boolean;
};

const matchesSearch: FilterFn<unknown> = (row, _columnId, search: string) => {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return row.getAllCells().some((cell) =>
    String(cell.getValue() ?? "")
      .toLowerCase()
      .includes(needle),
  );
};

/**
 * Table for dashboard lists: search across all columns, drop-down filters, sorting by
 * column header, pages, CSV export of the filtered rows, row actions, empty and loading
 * states. Works on the data it is given (lists of a school's size fit in the browser).
 */
export function DataTable<T>({
  title,
  csvName,
  data,
  columns,
  getRowId,
  labels,
  rowActions,
  toolbar,
  initialSort,
  pageSize = 10,
  loading = false,
}: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>(
    initialSort ? [{ id: initialSort.id, desc: !!initialSort.desc }] : [],
  );
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const defs = useMemo<ColumnDef<T, Value>[]>(
    () =>
      columns.map((c) => ({
        id: c.id,
        accessorFn: c.value,
        header: c.header,
        enableSorting: c.sortable !== false,
        filterFn: "equalsString",
        sortUndefined: "last",
        ...(c.sortValue
          ? {
              sortingFn: (a, b) => {
                const x = c.sortValue!(a.original);
                const y = c.sortValue!(b.original);
                if (x === y) return 0;
                if (x === null) return 1;
                if (y === null) return -1;
                return x < y ? -1 : 1;
              },
            }
          : {}),
        cell: (info) =>
          c.cell ? c.cell(info.row.original) : (info.getValue() ?? ""),
      })),
    [columns],
  );
  const columnFilters = useMemo(
    () =>
      Object.entries(filters)
        .filter(([, v]) => v !== "")
        .map(([id, value]) => ({ id, value })),
    [filters],
  );

  const table = useReactTable({
    data,
    columns: defs,
    getRowId: (row) => getRowId(row),
    state: { sorting, globalFilter: search, columnFilters },
    onSortingChange: setSorting,
    globalFilterFn: matchesSearch as FilterFn<T>,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    autoResetPageIndex: true,
  });

  const rows = table.getRowModel().rows;
  const filtered = table.getFilteredRowModel().rows;
  const pages = Math.max(1, table.getPageCount());
  const page = table.getState().pagination.pageIndex + 1;

  const exportCsv = () => {
    const exported = columns.filter((c) => !c.noCsv);
    const csv = toCsv(
      exported.map((c) => c.header),
      // Filtered and sorted, all pages.
      table
        .getPrePaginationRowModel()
        .rows.map((r) => exported.map((c) => c.value(r.original))),
    );
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = csvFileName(csvName ?? title);
    link.click();
    URL.revokeObjectURL(url);
  };

  const filterColumns = columns.filter((c) => c.filter);
  const idBase = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <Label htmlFor={`${idBase}-search`}>{labels.search}</Label>
          <Input
            id={`${idBase}-search`}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {filterColumns.map((c) => (
          <div key={c.id} className="flex flex-col gap-1.5">
            <Label htmlFor={`${idBase}-filter-${c.id}`}>{c.header}</Label>
            <select
              id={`${idBase}-filter-${c.id}`}
              value={filters[c.id] ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, [c.id]: e.target.value }))
              }
              className="bg-background h-10 rounded-md border px-3 text-sm"
            >
              <option value="">{labels.all}</option>
              {c.filter!.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={exportCsv}
          disabled={loading || filtered.length === 0}
        >
          <Download aria-hidden="true" />
          {labels.exportCsv}
        </Button>
        {toolbar}
      </div>

      <p role="status" className="text-muted-foreground text-sm">
        {loading ? "" : labels.count(filtered.length)}
      </p>

      {loading ? (
        <DataTableSkeleton columns={columns.length} />
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border p-6 text-center text-sm">
          {data.length === 0 ? labels.empty : labels.noMatches}
        </p>
      ) : (
        <div
          className="overflow-x-auto rounded-xl border"
          role="region"
          aria-label={title}
          tabIndex={0}
        >
          <table className="w-full min-w-[36rem] text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="bg-muted/50 text-left">
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => {
                    const sorted = header.column.getIsSorted();
                    const name = String(header.column.columnDef.header);
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        className="p-3 font-medium"
                        aria-sort={
                          sorted === "asc"
                            ? "ascending"
                            : sorted === "desc"
                              ? "descending"
                              : undefined
                        }
                      >
                        {header.column.getCanSort() ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="hover:text-primary inline-flex items-center gap-1"
                            aria-label={labels.sortBy(name)}
                          >
                            {name}
                            {sorted === "asc" ? (
                              <ArrowUp
                                className="size-3.5"
                                aria-hidden="true"
                              />
                            ) : sorted === "desc" ? (
                              <ArrowDown
                                className="size-3.5"
                                aria-hidden="true"
                              />
                            ) : (
                              <ArrowUpDown
                                className="text-muted-foreground size-3.5"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        ) : (
                          name
                        )}
                      </th>
                    );
                  })}
                  {rowActions ? (
                    <th scope="col" className="p-3 font-medium">
                      {labels.actions}
                    </th>
                  ) : null}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        "p-3",
                        columns.find((c) => c.id === cell.column.id)?.className,
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                  {rowActions ? (
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {rowActions(row.original)}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <nav
          aria-label={labels.pageOf(page, pages)}
          className="flex items-center gap-2"
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {labels.previous}
          </Button>
          <span className="text-sm">{labels.pageOf(page, pages)}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {labels.next}
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
