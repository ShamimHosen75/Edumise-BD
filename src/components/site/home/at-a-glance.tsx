import {
  School,
  UserRound,
  Users,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { formatNumber, pickLocalized } from "@/lib/format";
import { barPercent } from "@/lib/site/chart";
import type { PublicStats } from "@/lib/site/data";

import { Section } from "./section";

/** Live counters plus a students-per-class bar chart (counts only, from public_stats()). */
export function AtAGlance({
  lang,
  dict,
  stats,
}: {
  lang: Locale;
  dict: Dictionary;
  stats: PublicStats | null;
}) {
  if (!stats) return null;
  const h = dict.site.home;
  const tiles: { label: string; value: number; Icon: LucideIcon }[] = [
    { label: h.classes, value: stats.classes, Icon: School },
    { label: h.students, value: stats.students, Icon: Users },
    { label: h.teacherCount, value: stats.teachers, Icon: BookOpen },
    { label: h.staffCount, value: stats.staff, Icon: UserRound },
  ];
  const max = Math.max(0, ...stats.by_class.map((c) => c.students));

  return (
    <Section id="at-a-glance" title={h.atAGlance}>
      <div className="grid gap-6 lg:grid-cols-2">
        <ul className="grid grid-cols-2 gap-3">
          {tiles.map(({ label, value, Icon }) => (
            <li
              key={label}
              className="bg-card flex items-center gap-3 rounded-xl border p-4"
            >
              <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span
                  className="block text-2xl font-bold tabular-nums"
                  data-testid={`count-${label}`}
                >
                  {formatNumber(value, lang)}
                </span>
                <span className="text-muted-foreground text-sm">{label}</span>
              </span>
            </li>
          ))}
        </ul>

        {stats.by_class.length > 0 ? (
          <figure className="bg-card rounded-xl border p-4">
            <figcaption className="mb-3 text-sm font-semibold">
              {h.chartTitle}
            </figcaption>
            {/* Single series: no legend; values in text colour; each row reads as "Class 6: 10 students". */}
            <ul className="flex flex-col gap-2.5">
              {stats.by_class.map((c) => {
                const className = pickLocalized(c, "name", lang);
                const count = formatNumber(c.students, lang);
                const label = t(dict, "site.home.chartRow", {
                  class: className,
                  count,
                });
                return (
                  <li
                    key={c.level}
                    className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-2 text-sm"
                    title={label}
                  >
                    <span
                      className="text-muted-foreground truncate"
                      aria-hidden="true"
                    >
                      {className}
                    </span>
                    <span
                      className="bg-muted h-3 rounded-sm"
                      aria-hidden="true"
                    >
                      <span
                        className="bg-primary block h-3 rounded-r"
                        style={{ width: `${barPercent(c.students, max)}%` }}
                      />
                    </span>
                    <span
                      className="text-right font-medium tabular-nums"
                      aria-hidden="true"
                    >
                      {count}
                    </span>
                    <span className="sr-only">{label}</span>
                  </li>
                );
              })}
            </ul>
          </figure>
        ) : null}
      </div>
    </Section>
  );
}
