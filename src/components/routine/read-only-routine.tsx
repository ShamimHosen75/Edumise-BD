import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { slotKey } from "@/lib/routine";
import type { Period, RoutineEntry } from "@/lib/routine-data";

import { gridLabels } from "./grid-labels";
import { EntryText, RoutineGrid } from "./routine-grid";

/**
 * A routine to read or print. "section" shows teacher and room in each class (a section's
 * week); "teacher" shows the section and room (a teacher's week).
 */
export function ReadOnlyRoutine({
  lang,
  dict,
  caption,
  periods,
  workingDays,
  entries,
  view,
}: {
  lang: Locale;
  dict: Dictionary;
  caption: string;
  periods: Period[];
  workingDays: number[];
  entries: RoutineEntry[];
  view: "section" | "teacher";
}) {
  const bySlot = new Map(entries.map((e) => [slotKey(e.day, e.periodId), e]));
  return (
    <RoutineGrid
      periods={periods}
      workingDays={workingDays}
      labels={gridLabels(dict, lang, caption)}
      cell={(_day, _period, key) => {
        const e = bySlot.get(key);
        return e ? (
          <EntryText
            title={e.subject}
            lines={
              view === "section" ? [e.teacher, e.room] : [e.section, e.room]
            }
          />
        ) : (
          <span className="text-muted-foreground block px-1">—</span>
        );
      }}
    />
  );
}
