import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { localizeDigits, pickLocalized } from "@/lib/format";
import { detailMetadata } from "@/lib/site/detail-metadata";
import { getStaffProfile } from "@/lib/site/people-data";
import { publicMediaUrl } from "@/lib/supabase/public";

type Props = { params: Promise<{ lang: string; id: string }> };

export const revalidate = 3600;

const parseId = (raw: string) =>
  /^[1-9][0-9]{0,15}$/.test(raw) ? Number(raw) : null;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, id } = await params;
  const num = parseId(id);
  if (!isLocale(lang) || !num) return {};
  const person = await getStaffProfile(num);
  if (!person) return {};
  const name = pickLocalized(person, "full_name", lang);
  return detailMetadata({
    lang,
    path: `/teachers/${num}`,
    title: name,
    bodyHtml: `${pickLocalized(person, "designation", lang)}. ${pickLocalized(person, "bio", lang)}`,
    image: publicMediaUrl(person.photo_path),
  });
}

/**
 * Staff profile. Reads the public_staff view, which has only public columns: NID, birth
 * date, address and personal phone cannot reach this page.
 */
export default async function StaffProfilePage({ params }: Props) {
  const { lang, id } = await params;
  const num = parseId(id);
  if (!isLocale(lang) || !num) notFound();
  const person = await getStaffProfile(num);
  if (!person) notFound();
  const dict = await getDictionary(lang);
  const p = dict.people;
  const name = pickLocalized(person, "full_name", lang);
  const photo = publicMediaUrl(person.photo_path);
  const facts: [string, string][] = [
    [p.subject, pickLocalized(person, "subject", lang)],
    [p.qualification, pickLocalized(person, "qualification", lang)],
    [
      p.joined,
      person.joining_year ? localizeDigits(person.joining_year, lang) : "",
    ],
  ];
  const bio = pickLocalized(person, "bio", lang);

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <Link
        href={`/${lang}/teachers`}
        className="text-primary text-sm hover:underline"
      >
        ← {p.allTeachers}
      </Link>
      <header className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        {photo ? (
          <Image
            src={photo}
            alt={t(dict, "people.photoOf", { name })}
            width={192}
            height={192}
            priority
            className="size-36 rounded-full object-cover"
          />
        ) : null}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{name}</h1>
          <p className="text-muted-foreground">
            {pickLocalized(person, "designation", lang)}
          </p>
          {!person.is_current ? (
            <p className="bg-muted w-fit rounded-full px-2 py-0.5 text-xs">
              {p.formerNote}
            </p>
          ) : null}
        </div>
      </header>
      <dl className="grid gap-3 rounded-xl border p-4 sm:grid-cols-3">
        {facts
          .filter(([, value]) => value)
          .map(([term, value]) => (
            <div key={term}>
              <dt className="text-muted-foreground text-xs">{term}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
      </dl>
      {bio ? (
        <section aria-labelledby="bio-title" className="flex flex-col gap-2">
          <h2 id="bio-title" className="text-lg font-semibold">
            {p.about}
          </h2>
          <p className="whitespace-pre-line">{bio}</p>
        </section>
      ) : null}
    </article>
  );
}
