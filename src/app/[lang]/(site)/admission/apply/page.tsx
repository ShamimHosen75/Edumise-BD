import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContentHeader } from "@/components/site/content/content-header";
import { ApplyForm } from "@/components/site/admission/apply-form";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { admissionMessages } from "@/lib/admission-messages";
import { pickLocalized } from "@/lib/format";
import { pageAlternates } from "@/lib/site/detail-metadata";
import { getAdmissionOptions } from "@/lib/site/admission-data";

type Props = { params: Promise<{ lang: string }> };

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    alternates: pageAlternates(lang, "/admission/apply"),
    title: dict.admission.applyTitle,
    description: dict.admission.applyIntro,
  };
}

export default async function ApplyPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const options = await getAdmissionOptions();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <ContentHeader
        title={dict.admission.applyTitle}
        intro={dict.admission.applyIntro}
      />
      {options.open ? (
        <ApplyForm
          lang={lang}
          messages={admissionMessages(dict)}
          classes={options.classes.map((c) => ({
            id: c.id,
            level: c.level,
            name: pickLocalized(c, "name", lang),
          }))}
          groups={options.groups.map((g) => ({
            id: g.id,
            name: pickLocalized(g, "name", lang),
          }))}
        />
      ) : (
        <p className="rounded-xl border p-6 text-center">
          {dict.admission.closed}
        </p>
      )}
    </div>
  );
}
