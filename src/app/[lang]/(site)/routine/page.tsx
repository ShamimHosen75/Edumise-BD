import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ChoiceForm } from "@/components/routine/choice-form";
import { PrintButton } from "@/components/routine/print-button";
import { ReadOnlyRoutine } from "@/components/routine/read-only-routine";
import { ContentHeader } from "@/components/site/content/content-header";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { localizeDigits } from "@/lib/format";
import { pageAlternates } from "@/lib/site/detail-metadata";
import { getRoutineFrame, getSectionRoutine } from "@/lib/site/routine-data";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ section?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    alternates: pageAlternates(lang, "/routine"),
    title: dict.routine.title,
    description: dict.routine.publicIntro,
  };
}

export default async function PublicRoutinePage({
  params,
  searchParams,
}: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const r = dict.routine;
  const { periods, workingDays, session, sections } =
    await getRoutineFrame(lang);
  const wanted = (await searchParams).section;
  const section = sections.find((s) => String(s.id) === wanted) ?? sections[0];
  const entries =
    session && section
      ? await getSectionRoutine(session.id, section.id, lang)
      : [];
  const title =
    session && section
      ? t(dict, "routine.printTitle", {
          name: section.name,
          session: localizeDigits(session.name, lang),
        })
      : r.title;

  return (
    <div className="print-landscape mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 print:p-0">
      <div className="print:hidden">
        <ContentHeader title={r.title} intro={r.publicIntro} />
      </div>
      <ChoiceForm
        action={`/${lang}/routine`}
        name="section"
        label={r.section}
        submit={r.show}
        options={sections}
        value={section?.id}
      />
      {session && section && periods.length ? (
        <section className="flex flex-col gap-4" aria-label={title}>
          <h2 className="text-lg font-semibold">{title}</h2>
          {entries.length === 0 ? (
            <p className="text-muted-foreground text-sm">{r.noClasses}</p>
          ) : null}
          <ReadOnlyRoutine
            lang={lang}
            dict={dict}
            caption={title}
            periods={periods}
            workingDays={workingDays}
            entries={entries}
            view="section"
          />
          <PrintButton label={r.print} />
        </section>
      ) : (
        <p className="text-muted-foreground rounded-xl border p-6 text-center text-sm">
          {r.noClasses}
        </p>
      )}
    </div>
  );
}
