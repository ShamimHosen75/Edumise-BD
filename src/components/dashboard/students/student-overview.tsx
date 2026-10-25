import { FileDown } from "lucide-react";

import {
  removeStudentPhoto,
  uploadStudentPhoto,
} from "@/app/[lang]/dashboard/students/actions";
import { ContentFile } from "@/components/dashboard/content/content-file";
import { buttonVariants } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Messages } from "@/i18n/messages";
import { t } from "@/i18n/t";
import { localizeDigits, pickLocalized } from "@/lib/format";
import type { StudentDetail } from "@/lib/student-detail";
import type { SectionOption } from "@/lib/students-data";
import { studentFormValues } from "@/lib/validation/student";

import { EnrollmentForm } from "./enrollment-form";
import { FamilyLogin } from "./family-login";
import { StudentForm } from "./student-form";

/** The Overview tab: record, photo, enrolment, login and ID card. */
export function StudentOverview({
  lang,
  dict,
  detail,
  sessions,
  sections,
  groups,
  messages,
}: {
  lang: Locale;
  dict: Dictionary;
  detail: StudentDetail;
  sessions: { id: number; name: string; is_current: boolean }[];
  sections: SectionOption[];
  groups: { id: number; name: string }[];
  messages: Messages;
}) {
  const p = dict.studentProfile;
  const { student, current } = detail;
  const id = student.id;
  const name = pickLocalized(student, "full_name", lang);
  const currentSession = sessions.find((s) => s.is_current);
  const box = "flex max-w-4xl flex-col gap-3 rounded-xl border p-4";

  return (
    <div className="flex flex-col gap-6">
      <StudentForm
        lang={lang}
        id={id}
        defaults={studentFormValues(student)}
        sections={sections}
        groups={groups}
        messages={messages}
      />
      <section className={box} aria-labelledby="enrol-title">
        <h2 id="enrol-title" className="font-semibold">
          {p.enrollment}
        </h2>
        <p className="text-sm" data-testid="current-enrollment">
          {current
            ? t(dict, "studentProfile.currentEnrollment", {
                session: current.session,
                section: `${current.className} ${current.section}`,
                roll: localizeDigits(current.roll, lang),
              })
            : p.notEnrolled}
        </p>
        <EnrollmentForm
          lang={lang}
          studentId={id}
          defaults={{
            session_id: current?.sessionId ?? currentSession?.id ?? null,
            section_id: current?.sectionId ?? null,
            roll: current ? String(current.roll) : "",
            group_id: current?.groupId ?? null,
          }}
          sessions={sessions}
          sections={sections}
          groups={groups}
          messages={messages}
        />
      </section>
      <div className="max-w-4xl">
        <ContentFile
          title={p.photo}
          kind="image"
          url={detail.photoUrl}
          messages={messages}
          upload={uploadStudentPhoto.bind(null, lang, id)}
          remove={removeStudentPhoto.bind(null, lang, id)}
        />
      </div>
      <section className={box} aria-labelledby="student-login-title">
        <h2 id="student-login-title" className="font-semibold">
          {p.studentLogin}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t(dict, "studentProfile.studentLoginIntro", {
            code: student.student_code,
          })}
        </p>
        <FamilyLogin
          lang={lang}
          kind="student"
          id={id}
          name={name}
          state={detail.login}
          messages={messages}
        />
      </section>
      <section className={box}>
        <h2 className="font-semibold">{p.idCard}</h2>
        <p className="text-muted-foreground text-sm">{p.idCardHint}</p>
        <a
          href={`/${lang}/dashboard/students/${id}/id-card`}
          className={buttonVariants({ variant: "outline", className: "w-fit" })}
          download
        >
          <FileDown aria-hidden="true" />
          {p.idCard}
        </a>
      </section>
    </div>
  );
}
