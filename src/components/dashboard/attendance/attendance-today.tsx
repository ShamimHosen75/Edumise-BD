import Link from "next/link";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import type { attendanceToday } from "@/lib/attendance-data";
import { localizeDigits } from "@/lib/format";

/** Admin home: today's % per class and the sections not marked yet. */
export function AttendanceToday({
  lang,
  dict,
  data,
}: {
  lang: Locale;
  dict: Dictionary;
  data: NonNullable<Awaited<ReturnType<typeof attendanceToday>>>;
}) {
  const a = dict.attendance;
  const n = (v: number) => localizeDigits(v, lang);
  const base = `/${lang}/dashboard/attendance`;
  return (
    <section
      aria-labelledby="attendance-today"
      className="flex flex-col gap-3 rounded-xl border p-4"
      data-testid="attendance-today"
    >
      <div>
        <h2 id="attendance-today" className="font-semibold">
          {a.today}
        </h2>
        <p className="text-muted-foreground text-xs">{a.todayIntro}</p>
      </div>
      {!data.open ? (
        <p className="text-sm">{a.closed}</p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {data.classes.map((c) => (
              <li key={c.classId} className="bg-muted/40 rounded-lg p-3">
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-2xl font-semibold">
                  {c.marked
                    ? `${localizeDigits(Math.round((c.attended / c.marked) * 100), lang)}%`
                    : a.noPercent}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t(dict, "attendance.marked", {
                    marked: n(c.marked),
                    total: n(c.enrolled),
                  })}
                </p>
              </li>
            ))}
          </ul>
          <div>
            <h3 className="text-sm font-medium">{a.notMarked}</h3>
            {data.unmarked.length === 0 ? (
              <p className="text-muted-foreground text-sm">{a.allMarked}</p>
            ) : (
              <ul className="mt-1 flex flex-wrap gap-2">
                {data.unmarked.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`${base}?section=${s.id}`}
                      className="hover:bg-accent inline-block rounded-full border px-3 py-1 text-sm"
                    >
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
