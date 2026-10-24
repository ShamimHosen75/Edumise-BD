/** Bar length as a percentage of the largest value (0 when there is nothing to show). */
export function barPercent(value: number, max: number): number {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(max) ||
    max <= 0 ||
    value <= 0
  )
    return 0;
  return Math.min(100, Math.round((value / max) * 1000) / 10);
}
