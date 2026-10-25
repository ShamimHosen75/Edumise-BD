import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { pickLocalized } from "@/lib/format";
import { publicMediaUrl } from "@/lib/supabase/public";

import { PersonCard } from "../people/person-card";
import { Section } from "./section";

export type StaffCard = {
  id: number | null;
  full_name_en: string | null;
  full_name_bn: string | null;
  photo_path: string | null;
  designation_en: string | null;
  designation_bn: string | null;
  subject_en: string | null;
  subject_bn: string | null;
};

const local = (
  s: StaffCard,
  field: "full_name" | "designation" | "subject",
  lang: Locale,
) =>
  pickLocalized(
    {
      [`${field}_en`]: s[`${field}_en`] ?? "",
      [`${field}_bn`]: s[`${field}_bn`],
    } as Record<`${typeof field}_en`, string>,
    field,
    lang,
  );

/** Current teachers by rank, public fields only (from the public_staff view). */
export function TeacherHighlights({
  lang,
  dict,
  staff,
}: {
  lang: Locale;
  dict: Dictionary;
  staff: StaffCard[];
}) {
  if (staff.length === 0) return null;
  return (
    <Section
      id="teachers"
      title={dict.site.home.teachers}
      more={{
        href: `/${lang}/teachers`,
        label: dict.people.allTeachers,
      }}
    >
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {staff.map((s) => (
          <li key={s.id}>
            <PersonCard
              name={local(s, "full_name", lang)}
              photo={publicMediaUrl(s.photo_path)}
              lines={[local(s, "designation", lang), local(s, "subject", lang)]}
              href={s.id ? `/${lang}/teachers/${s.id}` : undefined}
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}
