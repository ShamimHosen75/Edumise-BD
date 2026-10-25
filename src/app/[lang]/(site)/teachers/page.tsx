import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContentHeader } from "@/components/site/content/content-header";
import { listHref } from "@/components/site/content/pagination";
import { TabLinks } from "@/components/site/content/tab-links";
import { PersonCard } from "@/components/site/people/person-card";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { pickLocalized } from "@/lib/format";
import { groupByDesignation } from "@/lib/people";
import { getDirectory } from "@/lib/site/people-data";
import { publicMediaUrl } from "@/lib/supabase/public";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ status?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.people.teachers,
    description: dict.people.teachersIntro,
  };
}

export default async function TeachersPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const p = dict.people;
  const former = (await searchParams).status === "former";
  const directory = await getDirectory();
  const groups = groupByDesignation(
    directory.filter((s) => s.is_current !== former),
  );
  const base = `/${lang}/teachers`;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <ContentHeader title={p.teachers} intro={p.teachersIntro} />
      <TabLinks
        label={p.tabsLabel}
        tabs={[
          { href: base, label: p.current, active: !former },
          {
            href: listHref(base, { status: "former" }),
            label: p.former,
            active: former,
          },
        ]}
      />
      {groups.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border p-6 text-center text-sm">
          {p.noOne}
        </p>
      ) : (
        groups.map((g) => (
          <section
            key={g.key}
            aria-labelledby={`designation-${g.key}`}
            className="flex flex-col gap-3"
          >
            <h2 id={`designation-${g.key}`} className="text-lg font-semibold">
              {pickLocalized(g.first, "designation", lang)}
            </h2>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {g.rows.map((s) => (
                <li key={s.id}>
                  <PersonCard
                    name={pickLocalized(s, "full_name", lang)}
                    photo={publicMediaUrl(s.photo_path)}
                    lines={[
                      pickLocalized(s, "designation", lang),
                      pickLocalized(s, "subject", lang),
                    ]}
                    href={`${base}/${s.id}`}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
