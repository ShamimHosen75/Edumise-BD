export const PAGE_SIZE = 10;

/** ?page= value to a page number (1 for anything missing or invalid). */
export function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
}

/** Inclusive row range for a page (Supabase .range()). */
export function pageRange(
  page: number,
  size = PAGE_SIZE,
): { from: number; to: number } {
  const from = (page - 1) * size;
  return { from, to: from + size - 1 };
}

export function totalPages(count: number, size = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(0, count) / size));
}

/** Page links to show: first, last, and two either side of the current page; null = gap. */
export function pageNumbers(current: number, total: number): (number | null)[] {
  const pages = new Set([
    1,
    total,
    current - 2,
    current - 1,
    current,
    current + 1,
    current + 2,
  ]);
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  return sorted.flatMap((p, i) =>
    i > 0 && p - sorted[i - 1]! > 1 ? [null, p] : [p],
  );
}
