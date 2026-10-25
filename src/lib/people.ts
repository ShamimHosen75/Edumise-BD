// Grouping for the public people pages (pure, unit tested).

export type DirectoryRow = {
  id: number;
  designation_en: string;
  designation_bn: string;
  designation_rank: number;
  sort_order: number;
  full_name_en: string;
};

export type Group<T> = { key: string; rows: T[] };

/** Staff grouped by designation, highest rank first; inside a group by sort order, then name. */
export function groupByDesignation<T extends DirectoryRow>(
  rows: T[],
): (Group<T> & { first: T })[] {
  const sorted = [...rows].sort(
    (a, b) =>
      a.designation_rank - b.designation_rank ||
      a.sort_order - b.sort_order ||
      a.full_name_en.localeCompare(b.full_name_en),
  );
  const groups: (Group<T> & { first: T })[] = [];
  for (const row of sorted) {
    const last = groups.at(-1);
    if (last && last.first.designation_rank === row.designation_rank)
      last.rows.push(row);
    else
      groups.push({
        key: String(row.designation_rank),
        rows: [row],
        first: row,
      });
  }
  return groups;
}

export type TermRow = {
  id: number;
  term_start: string;
  term_end: string | null;
  sort_order: number;
};

/**
 * Governing body members grouped by term (start and end date), newest term first.
 * A term is current when it has no end or ends today or later.
 */
export function groupByTerm<T extends TermRow>(
  rows: T[],
  today: string,
): { current: Group<T>[]; former: Group<T>[] } {
  const terms = new Map<string, T[]>();
  for (const row of rows) {
    const key = `${row.term_start}/${row.term_end ?? ""}`;
    terms.set(key, [...(terms.get(key) ?? []), row]);
  }
  const groups = [...terms.entries()]
    .map(([key, members]) => ({
      key,
      rows: members.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
    }))
    .sort((a, b) => b.key.localeCompare(a.key));
  const isCurrent = (g: Group<T>) => {
    const end = g.rows[0]!.term_end;
    return end === null || end >= today;
  };
  return {
    current: groups.filter(isCurrent),
    former: groups.filter((g) => !isCurrent(g)),
  };
}

/** Today's date in Bangladesh ("2026-10-25"). */
export function dhakaToday(now = new Date()): string {
  return new Date(now.getTime() + 6 * 3_600_000).toISOString().slice(0, 10);
}
