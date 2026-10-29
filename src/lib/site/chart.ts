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

export type PlotPoint = { x: number; y: number };

/**
 * Positions for a line chart of percentages (0-100) in a box of width x height, with
 * padding for axes. Points are evenly spaced; a single point sits in the middle.
 */
export function linePoints(
  values: readonly number[],
  box: {
    width: number;
    height: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
  },
): PlotPoint[] {
  const w = box.width - box.left - box.right;
  const h = box.height - box.top - box.bottom;
  const clamp = (v: number) =>
    Math.min(100, Math.max(0, Number.isFinite(v) ? v : 0));
  return values.map((v, i) => ({
    x: box.left + (values.length === 1 ? w / 2 : (w * i) / (values.length - 1)),
    y: box.top + h - (h * clamp(v)) / 100,
  }));
}

/** Pass rate as a percentage with one decimal (0 when nobody sat). */
export function passRate(passed: number, examinees: number): number {
  return examinees > 0 ? Math.round((passed / examinees) * 1000) / 10 : 0;
}
