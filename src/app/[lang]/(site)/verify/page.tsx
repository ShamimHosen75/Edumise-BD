import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ContentHeader } from "@/components/site/content/content-header";
import { VerifyForm } from "@/components/site/verify-form";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { normalizeReference } from "@/lib/certificates";
import { pageAlternates } from "@/lib/site/detail-metadata";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ ref?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    alternates: pageAlternates(lang, "/verify"),
    title: dict.verify.title,
    description: dict.verify.intro,
  };
}

/** Enter a certificate reference; a valid one opens /verify/[ref]. */
export default async function VerifyPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const v = dict.verify;
  const typed = (await searchParams).ref;
  const value = typeof typed === "string" ? typed.slice(0, 40) : undefined;
  const ref = value ? normalizeReference(value) : null;
  if (ref) redirect(`/${lang}/verify/${ref}`);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <ContentHeader title={v.title} intro={v.intro} />
      <div className="rounded-xl border p-4">
        <VerifyForm
          lang={lang}
          text={v}
          value={value}
          error={value ? v.invalid : null}
        />
      </div>
    </div>
  );
}
