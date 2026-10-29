// A report as tables of plain values, shown on the page, in Excel and in a PDF
// (pure, unit tested). Money stays in poisha until it is formatted.

export type CellKind = "text" | "money" | "number";
export type Cell = string | number;

export type ReportTable = {
  caption: string;
  head: string[];
  kinds: CellKind[];
  rows: Cell[][];
  /** A totals row (money columns are summed by the report). */
  foot: Cell[] | null;
};

export type Report = {
  title: string;
  subtitle: string;
  tables: ReportTable[];
};

/** Formats a cell for reading: money with the given formatter, numbers as text. */
export function cellText(
  value: Cell,
  kind: CellKind,
  money: (poisha: number) => string,
  number: (n: number) => string,
): string {
  if (typeof value === "string") return value;
  return kind === "money" ? money(value) : number(value);
}

/**
 * The rows of one Excel sheet: title, subtitle, then each table with its caption,
 * head, rows and totals, a blank row between. Money becomes taka (a number).
 */
export function reportSheet(report: Report): Cell[][] {
  const out: Cell[][] = [[report.title], [report.subtitle]];
  const taka = (v: Cell, k: CellKind) =>
    k === "money" && typeof v === "number" ? v / 100 : v;
  for (const t of report.tables) {
    out.push([], [t.caption], t.head);
    for (const r of t.rows) out.push(r.map((v, i) => taka(v, t.kinds[i]!)));
    if (t.foot) out.push(t.foot.map((v, i) => taka(v, t.kinds[i]!)));
  }
  return out;
}

/** Sums the money columns of rows into a totals row with a label first. */
export function totalsRow(
  label: string,
  kinds: readonly CellKind[],
  rows: readonly Cell[][],
): Cell[] {
  return kinds.map((k, i) =>
    i === 0
      ? label
      : k === "money"
        ? rows.reduce((s, r) => s + (typeof r[i] === "number" ? r[i] : 0), 0)
        : "",
  );
}
