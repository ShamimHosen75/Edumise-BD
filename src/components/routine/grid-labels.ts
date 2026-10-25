import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { localizeDigits } from "@/lib/format";

import type { GridLabels } from "./routine-grid";

/** Grid labels for server-rendered routines. */
export function gridLabels(
  dict: Dictionary,
  lang: Locale,
  caption: string,
): GridLabels {
  return {
    caption,
    day: dict.routine.day,
    period: (p) =>
      t(dict, "routine.period", { number: localizeDigits(p.number, lang) }),
    breakLabel: dict.routine.break,
    dayName: (d) => (dict.days as Record<string, string>)[String(d)] ?? "",
    time: (v) => localizeDigits(v, lang),
  };
}
