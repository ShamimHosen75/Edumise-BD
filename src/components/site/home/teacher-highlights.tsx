import Image from "next/image";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { pickLocalized } from "@/lib/format";
import { publicMediaUrl } from "@/lib/supabase/public";

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

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

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
    <Section id="teachers" title={dict.site.home.teachers}>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {staff.map((s) => {
          const name = pickLocalized(
            s as { full_name_en: string; full_name_bn: string | null },
            "full_name",
            lang,
          );
          const photo = publicMediaUrl(s.photo_path);
          return (
            <li
              key={s.id}
              className="bg-card flex flex-col items-center gap-2 rounded-xl border p-4 text-center"
            >
              {photo ? (
                <Image
                  src={photo}
                  alt=""
                  width={96}
                  height={96}
                  className="size-20 rounded-full object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="bg-primary/10 text-primary flex size-20 items-center justify-center rounded-full text-xl font-semibold"
                >
                  {initials(name)}
                </span>
              )}
              <p className="text-sm leading-tight font-semibold">{name}</p>
              <p className="text-muted-foreground text-xs">
                {pickLocalized(
                  s as {
                    designation_en: string;
                    designation_bn: string | null;
                  },
                  "designation",
                  lang,
                )}
              </p>
              {s.subject_en ? (
                <p className="text-xs">
                  {pickLocalized(
                    s as { subject_en: string; subject_bn: string | null },
                    "subject",
                    lang,
                  )}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
