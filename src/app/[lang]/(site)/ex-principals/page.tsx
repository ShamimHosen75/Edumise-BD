import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContentHeader } from "@/components/site/content/content-header";
import { PersonCard } from "@/components/site/people/person-card";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { pageAlternates } from "@/lib/site/detail-metadata";
import { t } from "@/i18n/t";
import { formatNumber, pickLocalized } from "@/lib/format";
import { getExPrincipals } from "@/lib/site/people-data";
import { publicMediaUrl } from "@/lib/supabase/public";

type Props = { params: Promise<{ lang: string }> };

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    alternates: pageAlternates(lang, "/ex-principals"),
    title: dict.people.exPrincipals,
    description: dict.people.exPrincipalsIntro,
  };
}

export default async function ExPrincipalsPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const p = dict.people;
  const people = await getExPrincipals();
  const year = (y: number) => formatNumber(y, lang, { grouping: false });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <ContentHeader title={p.exPrincipals} intro={p.exPrincipalsIntro} />
      {people.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border p-6 text-center text-sm">
          {p.noOne}
        </p>
      ) : (
        <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {people.map((person) => (
            <li key={person.id}>
              <PersonCard
                name={pickLocalized(person, "full_name", lang)}
                photo={publicMediaUrl(person.photo_path)}
                lines={[
                  t(dict, "people.years", {
                    from: year(person.from_year),
                    to: year(person.to_year),
                  }),
                  pickLocalized(person, "note", lang),
                ]}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
