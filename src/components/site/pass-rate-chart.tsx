import type { Locale } from "@/i18n/config";
import { formatNumber, localizeDigits } from "@/lib/format";
import { linePoints } from "@/lib/site/chart";

const BOX = {
  width: 400,
  height: 230,
  left: 40,
  right: 44,
  top: 16,
  bottom: 30,
};
const GRID = [0, 25, 50, 75, 100];

/**
 * Pass rate by year: one series in the school colour, recessive grid, the latest value
 * labelled, a tooltip on every point. The table beside it is the accessible view.
 */
export function PassRateChart({
  lang,
  title,
  points,
}: {
  lang: Locale;
  title: string;
  points: { year: number; rate: number }[];
}) {
  const xy = linePoints(
    points.map((p) => p.rate),
    BOX,
  );
  const pct = (v: number) => `${formatNumber(v, lang)}%`;
  const y = (v: number) => linePoints([v], BOX)[0]!.y;
  const last = xy[xy.length - 1];
  return (
    <figure className="flex max-w-2xl flex-col gap-2">
      <figcaption className="font-semibold">{title}</figcaption>
      <svg
        viewBox={`0 0 ${BOX.width} ${BOX.height}`}
        className="h-auto w-full"
        role="img"
        aria-label={title}
        data-testid="pass-rate-chart"
      >
        {GRID.map((g) => (
          <g key={g}>
            <line
              x1={BOX.left}
              x2={BOX.width - BOX.right}
              y1={y(g)}
              y2={y(g)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={BOX.left - 8}
              y={y(g)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[12px]"
            >
              {pct(g)}
            </text>
          </g>
        ))}
        {xy.map((p, i) => (
          <text
            key={points[i]!.year}
            x={p.x}
            y={BOX.height - 10}
            textAnchor="middle"
            className="fill-muted-foreground text-[12px]"
          >
            {localizeDigits(points[i]!.year, lang)}
          </text>
        ))}
        <polyline
          points={xy.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          className="stroke-primary"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {xy.map((p, i) => (
          <g key={points[i]!.year}>
            <circle
              cx={p.x}
              cy={p.y}
              r={4}
              className="fill-primary stroke-background"
              strokeWidth={2}
            />
            {/* Larger invisible target carries the tooltip. */}
            <circle cx={p.x} cy={p.y} r={14} fill="transparent">
              <title>{`${localizeDigits(points[i]!.year, lang)}: ${pct(points[i]!.rate)}`}</title>
            </circle>
          </g>
        ))}
        {last ? (
          <text
            x={last.x + 10}
            y={last.y}
            dominantBaseline="middle"
            className="fill-foreground text-[13px] font-semibold"
          >
            {pct(points[points.length - 1]!.rate)}
          </text>
        ) : null}
      </svg>
    </figure>
  );
}
