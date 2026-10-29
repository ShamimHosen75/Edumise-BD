import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MarksGrid } from "@/components/dashboard/marks/marks-grid";
import { MarksImport } from "@/components/dashboard/marks/marks-import";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { isAdmin, sectionRoster } from "@/lib/attendance-data";
import { requireRole } from "@/lib/auth/session";
import { examsMessages } from "@/lib/exams-messages";
import { takesSubject } from "@/lib/marks";
import { marksEntries, marksExams, savedMarks } from "@/lib/marks-data";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ exam?: string; entry?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).marks.title }
    : {};
}

export default async function MarksPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const me = await requireRole(lang, ["super_admin", "admin", "teacher"]);
  const dict = await getDictionary(lang);
  const m = dict.marks;
  const db = await createClient();
  const q = await searchParams;
  const exams = await marksExams(db, me, lang);
  const exam = exams.find((e) => String(e.id) === q.exam) ?? exams[0];
  const entries = exam ? await marksEntries(db, me, exam.id, lang) : [];
  const entry = entries.find((e) => e.key === q.entry) ?? entries[0];
  const select = "bg-background h-10 max-w-full rounded-md border px-3 text-sm";

  let body: React.ReactNode = null;
  if (!exam) body = <Notice text={m.noExam} />;
  else if (!entry) body = <Notice text={m.noSubjects} />;
  else {
    const { data: session } = await db
      .from("academic_sessions")
      .select("id")
      .eq("is_current", true)
      .single();
    // Only students who take the subject (their group's subjects) and are still here.
    const roster = (
      await sectionRoster(db, session!.id, entry.sectionId, lang, {
        current: true,
      })
    ).filter((r) => takesSubject(entry.groups, r.groupId));
    const { marks, lockedAt } = await savedMarks(
      db,
      entry.examSubjectId,
      entry.sectionId,
      roster.map((r) => r.studentId),
    );
    const editable =
      exam.status === "marks_entry" ||
      (isAdmin(me) && exam.status === "review");
    const messages = examsMessages(dict);
    // A new key after every save from elsewhere (import, unlock) resets the grid.
    const version = `${entry.key}-${lockedAt ?? ""}-${marks.length}-${marks
      .map((x) => `${x.cq}${x.mcq}${x.practical}${x.is_absent}`)
      .join("")}`;
    body = (
      <>
        <h2 className="text-lg font-semibold">
          {exam.name} · {entry.label}
        </h2>
        <MarksGrid
          key={version}
          lang={lang}
          entry={entry}
          roster={roster}
          initial={marks}
          lockedAt={lockedAt}
          editable={editable}
          messages={messages}
        />
        {editable && !lockedAt ? (
          <MarksImport
            key={`import-${version}`}
            lang={lang}
            entry={entry}
            roster={roster}
            saved={marks}
            messages={messages}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">{m.title}</h1>
        <p className="text-muted-foreground text-sm">{m.intro}</p>
      </div>
      {exam ? (
        <form
          action={`/${lang}/dashboard/marks`}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="marks-exam">{m.exam}</Label>
            <select
              id="marks-exam"
              name="exam"
              defaultValue={exam.id}
              className={select}
            >
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          {entries.length ? (
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="marks-entry">{m.what}</Label>
              <select
                id="marks-entry"
                name="entry"
                defaultValue={entry?.key}
                className={select}
              >
                {entries.map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <Button type="submit" variant="outline">
            {m.show}
          </Button>
        </form>
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
