import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StatusForm } from "@/components/site/admission/status-form";
import { ContentHeader } from "@/components/site/content/content-header";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { admissionMessages } from "@/lib/admission-messages";
import { pageAlternates } from "@/lib/site/detail-metadata";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    alternates: pageAlternates(lang, "/admission/status"),
    title: dict.admission.statusTitle,
    description: dict.admission.statusIntro,
  };
}

export default async function StatusPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <ContentHeader
        title={dict.admission.statusTitle}
        intro={dict.admission.statusIntro}
      />
      <StatusForm lang={lang} messages={admissionMessages(dict)} />
    </div>
  );
}
