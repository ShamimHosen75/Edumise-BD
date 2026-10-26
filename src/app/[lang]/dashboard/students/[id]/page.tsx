import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StudentDocuments } from "@/components/dashboard/students/student-documents";
import { StudentGuardians } from "@/components/dashboard/students/student-guardians";
import { StudentHistory } from "@/components/dashboard/students/student-history";
import { StudentOverview } from "@/components/dashboard/students/student-overview";
import { TabLinks } from "@/components/site/content/tab-links";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localizeDigits, pickLocalized } from "@/lib/format";
import { studentDetail } from "@/lib/student-detail";
import { studentMessages } from "@/lib/student-messages";
import {
  groupOptions,
  sectionOptions,
  sessions as sessionList,
} from "@/lib/students-data";
import { createClient } from "@/lib/supabase/server";

const TABS = [
  "overview",
  "guardians",
  "history",
  "attendance",
  "results",
  "fees",
  "documents",
] as const;
type Tab = (typeof TABS)[number];

type Props = {
  params: Promise<{ lang: string; id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).students.title }
    : {};
}

export default async function StudentPage({ params, searchParams }: Props) {
  const { lang, id: raw } = await params;
  const id = /^[1-9][0-9]{0,15}$/.test(raw) ? Number(raw) : null;
  if (!isLocale(lang) || id === null) notFound();
  const wanted = (await searchParams).tab;
  const tab: Tab = TABS.find((x) => x === wanted) ?? "overview";
  const dict = await getDictionary(lang);
  const p = dict.studentProfile;
  const db = await createClient();
  const detail = await studentDetail(db, id, lang);
  if (!detail) notFound();
  const { student, current } = detail;
  const name = pickLocalized(student, "full_name", lang);
  const messages = studentMessages(dict);
  const base = `/${lang}/dashboard/students/${id}`;
  const options =
    tab === "overview"
      ? await Promise.all([
          sessionList(db, lang),
          sectionOptions(db, lang),
          groupOptions(db, lang),
        ])
      : null;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/${lang}/dashboard/students`}
        className="text-primary text-sm hover:underline"
      >
        <span aria-hidden="true">←</span> {dict.students.list}
      </Link>
      <header className="flex flex-wrap items-center gap-4">
        {detail.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- private file, short-lived link
          <img
            src={detail.photoUrl}
            alt=""
            className="size-20 rounded-lg border object-cover"
          />
        ) : null}
        <div>
          <h1 className="text-2xl font-semibold">{name}</h1>
          <p className="text-muted-foreground text-sm">
            {dict.students.code}:{" "}
            <span data-testid="student-code">
              {localizeDigits(student.student_code, lang)}
            </span>
            {" · "}
            {dict.students.statuses[student.status]}
            {current
              ? ` · ${current.className} ${current.section}, ${p.roll} ${localizeDigits(current.roll, lang)}`
              : ""}
          </p>
        </div>
      </header>
      <TabLinks
        label={p.tabs}
        tabs={TABS.map((x) => ({
          href: x === "overview" ? base : `${base}?tab=${x}`,
          label: p[x],
          active: x === tab,
        }))}
      />
      {options ? (
        <StudentOverview
          lang={lang}
          dict={dict}
          detail={detail}
          sessions={options[0]}
          sections={options[1]}
          groups={options[2]}
          messages={messages}
        />
      ) : tab === "guardians" ? (
        <StudentGuardians
          lang={lang}
          studentId={id}
          guardians={detail.guardians}
          messages={messages}
        />
      ) : tab === "history" ? (
        <StudentHistory lang={lang} dict={dict} rows={detail.history} />
      ) : tab === "documents" ? (
        <StudentDocuments
          lang={lang}
          studentId={id}
          documents={detail.documents}
          admissionDocuments={detail.admissionDocuments}
          messages={messages}
        />
      ) : (
        <p className="text-muted-foreground rounded-xl border p-4 text-sm">
          {p.comingSoon}
        </p>
      )}
    </div>
  );
}
