import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContentHeader } from "@/components/site/content/content-header";
import { listHref } from "@/components/site/content/pagination";
import { TabLinks } from "@/components/site/content/tab-links";
import { PersonCard } from "@/components/site/people/person-card";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { formatDate, pickLocalized } from "@/lib/format";
import { dhakaToday, groupByTerm } from "@/lib/people";
import { getGoverningBody } from "@/lib/site/people-data";
import { publicMediaUrl } from "@/lib/supabase/public";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ view?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.people.governingBody,
    description: dict.people.governingIntro,
  };
}

export default async function GoverningBodyPage({
  params,
  searchParams,
}: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const p = dict.people;
  const former = (await searchParams).view === "former";
  const terms = groupByTerm(await getGoverningBody(), dhakaToday());
  const shown = former ? terms.former : terms.current;
  const base = `/${lang}/governing-body`;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <ContentHeader
        title={former ? p.formerGoverning : p.governingBody}
        intro={p.governingIntro}
      />
      <TabLinks
        label={p.governingBody}
        tabs={[
          { href: base, label: p.current, active: !former },
          {
            href: listHref(base, { view: "former" }),
            label: p.former,
            active: former,
          },
        ]}
      />
      {shown.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border p-6 text-center text-sm">
          {p.noOne}
        </p>
      ) : (
        shown.map((term) => {
          const first = term.rows[0]!;
          const heading = t(dict, "people.term", {
            from: formatDate(first.term_start, lang, "medium"),
            to: first.term_end
              ? formatDate(first.term_end, lang, "medium")
              : p.present,
          });
          return (
            <section
              key={term.key}
              aria-label={heading}
              className="flex flex-col gap-3"
            >
              <h2 className="text-lg font-semibold">{heading}</h2>
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {term.rows.map((m) => (
                  <li key={m.id}>
                    <PersonCard
                      name={pickLocalized(m, "full_name", lang)}
                      photo={publicMediaUrl(m.photo_path)}
                      lines={[pickLocalized(m, "position", lang)]}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
