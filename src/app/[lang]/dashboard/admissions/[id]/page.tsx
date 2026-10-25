import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";

import { ReviewPanel } from "@/components/dashboard/admissions/review-panel";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { admissionMessages } from "@/lib/admission-messages";
import { admissionDetail } from "@/lib/admissions-data";
import { toDhakaInput } from "@/lib/content/datetime";
import {
  formatBytes,
  formatDate,
  formatDateTime,
  localizeDigits,
  pickLocalized,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ lang: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).admissionsAdmin.title }
    : {};
}

export default async function ApplicationPage({ params }: Props) {
  const { lang, id: raw } = await params;
  const id = /^[1-9][0-9]{0,15}$/.test(raw) ? Number(raw) : null;
  if (!isLocale(lang) || id === null) notFound();
  const dict = await getDictionary(lang);
  const a = dict.admissionsAdmin;
  const f = dict.admission.fields;
  const detail = await admissionDetail(await createClient(), id, lang);
  if (!detail) notFound();
  const { app } = detail;
  const name = pickLocalized(
    { name_en: app.student_name_en, name_bn: app.student_name_bn },
    "name",
    lang,
  );
  const v = (x: string | null | undefined) => (x ? x : "—");
  const groups: [string, [string, string][]][] = [
    [
      a.studentSection,
      [
        [f.studentNameEn, app.student_name_en],
        [f.studentNameBn, v(app.student_name_bn)],
        [f.birthDate, formatDate(app.birth_date, lang)],
        [f.gender, dict.admission.genders[app.gender]],
        [f.birthRegNo, localizeDigits(app.birth_reg_no, lang)],
        [
          f.religion,
          app.religion ? dict.admission.religions[app.religion] : "—",
        ],
        [f.bloodGroup, v(app.blood_group)],
      ],
    ],
    [
      a.guardianSection,
      [
        [f.fatherName, app.father_name],
        [f.motherName, app.mother_name],
        [f.localGuardian, v(app.local_guardian_name)],
        [f.phone, localizeDigits(app.guardian_phone, lang)],
        [f.occupation, v(app.guardian_occupation)],
        [f.email, v(app.guardian_email)],
        [f.presentAddress, app.present_address],
        [f.permanentAddress, v(app.permanent_address)],
      ],
    ],
    [
      a.academicSection,
      [
        [f.class, `${detail.className} (${detail.sessionName})`],
        [f.group, v(detail.groupName)],
        [f.previousSchool, v(app.previous_school)],
        [f.lastResult, v(app.last_result)],
      ],
    ],
  ];

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Link
        href={`/${lang}/dashboard/admissions`}
        className="text-primary text-sm hover:underline"
      >
        <span aria-hidden="true">←</span> {a.queue}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{name}</h1>
          <p className="text-muted-foreground text-sm">
            {t(dict, "admissionsAdmin.detail", { tracking: app.tracking_no })} ·{" "}
            {formatDateTime(app.submitted_at, lang)}
          </p>
          <p className="mt-1 font-medium" data-testid="application-status">
            {dict.admission.statuses[app.status]}
          </p>
        </div>
        {detail.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- private file, short-lived link
          <img
            src={detail.photoUrl}
            alt={`${a.photo}: ${name}`}
            className="size-28 rounded-lg border object-cover"
          />
        ) : null}
      </header>

      {groups.map(([title, rows]) => (
        <section key={title} className="rounded-xl border p-4">
          <h2 className="mb-2 font-semibold">{title}</h2>
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[14rem_1fr]">
            {rows.map(([term, value]) => (
              <div key={term} className="contents">
                <dt className="text-muted-foreground">{term}</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <section className="rounded-xl border p-4">
        <h2 className="mb-2 font-semibold">{a.documents}</h2>
        {detail.documents.length === 0 ? (
          <p className="text-muted-foreground text-sm">{a.noDocuments}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {detail.documents.map((d) => (
              <li key={d.kind} className="flex flex-wrap items-center gap-2">
                <FileText className="size-4" aria-hidden="true" />
                <span>
                  {d.kind === "birth_certificate"
                    ? f.birthCertificate
                    : f.transcript}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatBytes(d.file_size, lang)}
                </span>
                {d.url ? (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {a.view}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ReviewPanel
        lang={lang}
        id={id}
        name={name}
        approved={app.status === "approved"}
        studentCode={detail.studentCode}
        sections={detail.sections}
        messages={admissionMessages(dict)}
        defaults={{
          status: app.status === "approved" ? "submitted" : app.status,
          test_at: toDhakaInput(app.test_at),
          test_venue: app.test_venue,
          test_marks: app.test_marks === null ? "" : String(app.test_marks),
          office_note: app.office_note,
        }}
      />
    </div>
  );
}
