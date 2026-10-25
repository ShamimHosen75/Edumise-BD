import type { FieldValues } from "react-hook-form";

import type { Translate } from "@/components/dashboard/academic/labels";
import type { Locale } from "@/i18n/config";
import { formatDate, localizeDigits } from "@/lib/format";

import type { ClassOption, Option } from "./step-fields";

/** Every answer, grouped as on the form (review step and the printable copy). */
export function ApplicationSummary({
  values,
  tr,
  lang,
  classes,
  groups,
  files,
}: {
  values: FieldValues;
  tr: Translate;
  lang: Locale;
  classes: ClassOption[];
  groups: Option[];
  /** Names of the chosen files, by field. */
  files: Record<string, string | undefined>;
}) {
  const f = (key: string) => tr(`admission.fields.${key}`);
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v : "—");
  const digits = (v: unknown) =>
    typeof v === "string" && v ? localizeDigits(v, lang) : "—";
  const choice = (prefix: string, v: unknown) =>
    typeof v === "string" && v ? tr(`${prefix}.${v}`) : "—";
  const sections: [string, [string, string][]][] = [
    [
      tr("admission.steps.student"),
      [
        [f("studentNameEn"), s(values.student_name_en)],
        [f("studentNameBn"), s(values.student_name_bn)],
        [
          f("birthDate"),
          values.birth_date ? formatDate(String(values.birth_date), lang) : "—",
        ],
        [f("gender"), choice("admission.genders", values.gender)],
        [f("birthRegNo"), digits(values.birth_reg_no)],
        [f("religion"), choice("admission.religions", values.religion)],
        [f("bloodGroup"), s(values.blood_group)],
        [f("photo"), files.photo ?? "—"],
      ],
    ],
    [
      tr("admission.steps.guardian"),
      [
        [f("fatherName"), s(values.father_name)],
        [f("motherName"), s(values.mother_name)],
        [f("localGuardian"), s(values.local_guardian_name)],
        [f("phone"), digits(values.guardian_phone)],
        [f("occupation"), s(values.guardian_occupation)],
        [f("email"), s(values.guardian_email)],
        [f("presentAddress"), s(values.present_address)],
        [f("permanentAddress"), s(values.permanent_address)],
      ],
    ],
    [
      tr("admission.steps.academic"),
      [
        [
          f("class"),
          classes.find((c) => c.id === values.class_id)?.name ?? "—",
        ],
        [f("group"), groups.find((g) => g.id === values.group_id)?.name ?? "—"],
        [f("previousSchool"), s(values.previous_school)],
        [f("lastResult"), s(values.last_result)],
      ],
    ],
    [
      tr("admission.steps.documents"),
      [
        [f("birthCertificate"), files.birth_certificate ?? "—"],
        [f("transcript"), files.transcript ?? "—"],
      ],
    ],
  ];
  return (
    <div className="flex flex-col gap-4">
      {sections.map(([title, rows]) => (
        <section
          key={title}
          className="rounded-xl border p-4 print:break-inside-avoid"
        >
          <h3 className="mb-2 font-semibold">{title}</h3>
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
    </div>
  );
}
