import { AttendanceCalendar } from "@/components/dashboard/attendance/attendance-calendar";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { attendanceFrame, studentMarks } from "@/lib/attendance-data";
import { monthDates } from "@/lib/attendance-sheet";
import { isMonth } from "@/lib/routine";
import type { createClient } from "@/lib/supabase/server";

/** Shared body of the guardian's and the student's attendance pages. */
export async function StudentAttendancePage({
  db,
  lang,
  dict,
  studentId,
  name,
  base,
  month: wanted,
}: {
  db: Awaited<ReturnType<typeof createClient>>;
  lang: Locale;
  dict: Dictionary;
  studentId: number;
  name: string;
  base: string;
  month: string | undefined;
}) {
  const frame = await attendanceFrame(db);
  const month = isMonth(wanted) ? wanted : frame.today.slice(0, 7);
  const dates = monthDates(month);
  const marks = await studentMarks(db, studentId, dates[0]!, dates.at(-1)!);
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">
          {dict.attendance.myAttendance}: {name}
        </h1>
        <p className="text-muted-foreground text-sm">
          {dict.attendance.calendarIntro}
        </p>
      </div>
      <AttendanceCalendar
        lang={lang}
        dict={dict}
        month={month}
        today={frame.today}
        marks={marks}
        workingDays={frame.workingDays}
        holidays={frame.holidays}
        base={base}
        title={name}
      />
    </div>
  );
}
