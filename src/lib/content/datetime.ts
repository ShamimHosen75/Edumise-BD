// The school works in Bangladesh time (UTC+6, no daylight saving).
const OFFSET_MINUTES = 6 * 60;
const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** ISO time -> value for <input type="datetime-local"> in Bangladesh time ("2026-11-05T09:00"). */
export function toDhakaInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() + OFFSET_MINUTES * 60_000)
    .toISOString()
    .slice(0, 16);
}

/** "2026-11-05T09:00" typed in Bangladesh time -> ISO string with +06:00, or null if invalid. */
export function fromDhakaInput(
  local: string | null | undefined,
): string | null {
  const m = LOCAL.exec(local ?? "");
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const utc = Date.UTC(y, mo - 1, d, h, mi) - OFFSET_MINUTES * 60_000;
  const date = new Date(utc);
  // Reject impossible dates such as 2026-02-31 (Date would roll them over).
  if (toDhakaInput(date.toISOString()) !== local) return null;
  return date.toISOString();
}

/** True when an event has not started yet (or is still running). */
export function isUpcoming(
  startsAt: string,
  endsAt: string | null,
  now = new Date(),
): boolean {
  const end = new Date(endsAt ?? startsAt).getTime();
  return end >= now.getTime();
}
