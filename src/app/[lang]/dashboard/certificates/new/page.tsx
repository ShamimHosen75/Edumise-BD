import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { IssueForm } from "@/components/dashboard/certificates/issue-form";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { certificatesMessages } from "@/lib/certificates-messages";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ code?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).certificates.issue }
    : {};
}

/** Issue a certificate; ?code= prefills the student ID (from the student's profile). */
export default async function IssueCertificatePage({
  params,
  searchParams,
}: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const code = (await searchParams).code;
  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/${lang}/dashboard/certificates`}
        className="text-primary text-sm hover:underline"
      >
        <span aria-hidden="true">←</span> {dict.certificates.back}
      </Link>
      <h1 className="text-2xl font-semibold">{dict.certificates.issue}</h1>
      <IssueForm
        lang={lang}
        initialCode={
          typeof code === "string" && /^\d{10}$/.test(code) ? code : ""
        }
        messages={certificatesMessages(dict)}
      />
    </div>
  );
}
