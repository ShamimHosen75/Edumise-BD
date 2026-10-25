// Weekly class routine: grid helpers and clash checks (pure, unit tested).

/** One class in the week of a section. day: 0 = Sunday ... 6 = Saturday. */
export type RoutineCell = {
  day: number;
  periodId: number;
  subjectId: number;
  staffId: number | null;
  roomId: number | null;
};

/** A class already in the routine of another section (same session). */
export type Booking = RoutineCell & { sectionId: number; section: string };

export type Clash = {
  day: number;
  periodId: number;
  kind: "teacher" | "room";
  /** The other section that already has this teacher or room then. */
  section: string;
};

export const slotKey = (day: number, periodId: number) => `${day}:${periodId}`;

/** Week days in school order, Saturday first (Bangladesh week), only working days. */
export function weekDays(workingDays: readonly number[]): number[] {
  return [6, 0, 1, 2, 3, 4, 5].filter((d) => workingDays.includes(d));
}

/**
 * Clashes between this section's cells and the other sections' classes: the same teacher
 * or the same room in two places at the same day and period.
 */
export function findClashes(
  cells: readonly RoutineCell[],
  others: readonly Booking[],
  sectionId: number,
): Clash[] {
  const bySlot = new Map<string, Booking[]>();
  for (const b of others) {
    if (b.sectionId === sectionId) continue;
    const key = slotKey(b.day, b.periodId);
    bySlot.set(key, [...(bySlot.get(key) ?? []), b]);
  }
  const clashes: Clash[] = [];
  for (const c of cells) {
    for (const b of bySlot.get(slotKey(c.day, c.periodId)) ?? []) {
      const at = { day: c.day, periodId: c.periodId, section: b.section };
      if (c.staffId !== null && c.staffId === b.staffId)
        clashes.push({ ...at, kind: "teacher" });
      if (c.roomId !== null && c.roomId === b.roomId)
        clashes.push({ ...at, kind: "room" });
    }
  }
  return clashes;
}

/** Cells that cannot be saved: a day the school is closed, a break, or the same slot twice. */
export function invalidCells(
  cells: readonly RoutineCell[],
  ctx: { workingDays: readonly number[]; breakPeriodIds: readonly number[] },
): RoutineCell[] {
  const seen = new Set<string>();
  return cells.filter((c) => {
    const key = slotKey(c.day, c.periodId);
    const bad =
      !ctx.workingDays.includes(c.day) ||
      ctx.breakPeriodIds.includes(c.periodId) ||
      seen.has(key);
    seen.add(key);
    return bad;
  });
}

/** "08:00:00" or "08:00" -> "08:00". */
export const hhmm = (time: string) => time.slice(0, 5);

/** Dates from start to end (inclusive), as YYYY-MM-DD. */
export function datesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (d <= last && out.length < 400) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/**
 * The weeks of a month as rows of 7 dates (Saturday first); days of the other months are
 * null. month: "YYYY-MM".
 */
export function monthGrid(month: string): (string | null)[][] {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // Saturday = column 0.
  const lead = (first.getUTCDay() + 1) % 7;
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++)
    cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** "YYYY-MM" of the month before or after. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

export const isMonth = (v: unknown): v is string =>
  typeof v === "string" && /^(19|20)[0-9]{2}-(0[1-9]|1[0-2])$/.test(v);
