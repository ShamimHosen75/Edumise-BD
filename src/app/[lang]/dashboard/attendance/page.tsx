import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { AttendanceHeader } from "@/components/dashboard/attendance/attendance-header";
import { AttendanceTaker } from "@/components/dashboard/attendance/attendance-taker";
import { SectionDateForm } from "@/components/dashboard/attendance/section-date-form";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { canMark, isSchoolDay } from "@/lib/attendance";
import {
  attendanceFrame,
  isAdmin,
  markableSections,
  sectionMarks,
  sectionRoster,
} from "@/lib/attendance-data";
import { attendanceMessages } from "@/lib/attendance-messages";
import { requireRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ section?: string; date?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).attendance.take }
    : {};
}

export default async function TakeAttendancePage({
  params,
  searchParams,
}: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const me = await requireRole(lang, ["super_admin", "admin", "teacher"]);
  const dict = await getDictionary(lang);
  const a = dict.attendance;
  const db = await createClient();
  const [frame, sections] = await Promise.all([
    attendanceFrame(db),
    markableSections(db, me, lang),
  ]);
  const q = await searchParams;
  const section =
    sections.find((s) => String(s.id) === q.section) ?? sections[0];
  const date = z.iso.date().safeParse(q.date).success ? q.date! : frame.today;
  const query = section ? `?section=${section.id}` : "";

  let body: React.ReactNode;
  if (!section || !frame.session) {
    body = <Notice text={a.noSections} />;
  } else if (date > frame.today) {
    body = <Notice text={a.future} />;
  } else if (!isSchoolDay(date, frame.workingDays, frame.holidays)) {
    body = <Notice text={a.closed} />;
  } else {
    const [roster, marks] = await Promise.all([
      sectionRoster(db, frame.session.id, section.id, lang),
      sectionMarks(db, section.id, date, date),
    ]);
    const saved = Object.fromEntries(marks.map((m) => [m.studentId, m.status]));
    const editable = canMark(
      date,
      frame.today,
      isAdmin(me) ? "admin" : "teacher",
    );
    body =
      roster.length === 0 ? (
        <Notice text={a.noStudents} />
      ) : editable ? (
        <>
          {marks.length ? (
            <p className="text-muted-foreground text-sm">{a.savedAt}</p>
          ) : null}
          <AttendanceTaker
            key={`${section.id}-${date}`}
            lang={lang}
            sectionId={section.id}
            date={date}
            roster={roster}
            saved={saved}
            messages={attendanceMessages(dict)}
          />
        </>
      ) : (
        <>
          <Notice text={a.readOnly} />
          <ul className="flex flex-col gap-1 text-sm">
            {roster.map((r) => (
              <li
                key={r.studentId}
                className="flex justify-between border-b py-2"
              >
                <span>{r.name}</span>
                <span className="font-medium">
                  {saved[r.studentId] ? a.statuses[saved[r.studentId]!] : "—"}
                </span>
              </li>
            ))}
          </ul>
        </>
      );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <AttendanceHeader lang={lang} dict={dict} active="take" query={query} />
      <SectionDateForm
        action={`/${lang}/dashboard/attendance`}
        sections={sections}
        section={section?.id}
        dateName="date"
        dateType="date"
        dateLabel={a.date}
        dateValue={date}
        max={frame.today}
        labels={{ section: a.section, show: a.show }}
      />
      {section ? (
        <h2 className="text-lg font-semibold">
          {section.name} · {formatDate(date, lang, "medium")}
        </h2>
      ) : null}
      {body}
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <p role="status" className="rounded-xl border p-4 text-sm">
      {text}
    </p>
  );
}
