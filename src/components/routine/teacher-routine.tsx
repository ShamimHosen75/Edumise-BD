import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { localizeDigits } from "@/lib/format";
import { routineEntries, routineFrame } from "@/lib/routine-data";
import type { createClient } from "@/lib/supabase/server";

import { PrintButton } from "./print-button";
import { ReadOnlyRoutine } from "./read-only-routine";

/** One teacher's week, ready to print (admin "By teacher" and teacher "My routine"). */
export async function TeacherRoutine({
  db,
  lang,
  dict,
  staffId,
  name,
}: {
  db: Awaited<ReturnType<typeof createClient>>;
  lang: Locale;
  dict: Dictionary;
  staffId: number;
  name: string;
}) {
  const r = dict.routine;
  const { session, periods, workingDays } = await routineFrame(db);
  if (!session || !periods.length)
    return (
      <p className="text-muted-foreground rounded-xl border p-4 text-sm">
        {session ? r.noPeriods : r.noSession}
      </p>
    );
  const entries = await routineEntries(db, session.id, lang, { staffId });
  const title = `${t(dict, "routine.teacherRoutine", { name })} (${localizeDigits(session.name, lang)})`;
  return (
    <section className="print-landscape flex flex-col gap-4" aria-label={title}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">{r.noClasses}</p>
      ) : null}
      <ReadOnlyRoutine
        lang={lang}
        dict={dict}
        caption={title}
        periods={periods}
        workingDays={workingDays}
        entries={entries}
        view="teacher"
      />
      <PrintButton label={r.print} />
    </section>
  );
}
