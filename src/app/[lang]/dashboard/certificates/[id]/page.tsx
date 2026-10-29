import { FileDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CertificateView } from "@/components/certificates/certificate-view";
import { RevokeButton } from "@/components/dashboard/certificates/revoke-button";
import { PrintButton } from "@/components/routine/print-button";
import { buttonVariants } from "@/components/ui/button";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { verifyLink } from "@/lib/certificate-qr";
import { certificateById } from "@/lib/certificates-data";
import { certificatesMessages } from "@/lib/certificates-messages";
import { sheetHeader } from "@/lib/school";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ lang: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).certificates.title }
    : {};
}

/** One certificate: print it (page language), download the PDF, or revoke it. */
export default async function CertificatePage({ params }: Props) {
  const { lang, id } = await params;
  if (!isLocale(lang) || !/^[1-9][0-9]{0,15}$/.test(id)) notFound();
  const dict = await getDictionary(lang);
  const c = dict.certificates;
  const cert = await certificateById(await createClient(), Number(id));
  if (!cert) notFound();
  const [school, link] = await Promise.all([
    sheetHeader(lang, dict),
    verifyLink(cert.reference, lang),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link
          href={`/${lang}/dashboard/certificates`}
          className="text-primary text-sm hover:underline"
        >
          <span aria-hidden="true">←</span> {c.back}
        </Link>
        <PrintButton label={c.print} />
        <a
          href={`/${lang}/dashboard/certificates/${cert.id}/pdf`}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          <FileDown aria-hidden="true" />
          {c.downloadPdf}
        </a>
        {cert.revoked_at ? null : (
          <RevokeButton
            lang={lang}
            id={cert.id}
            reference={cert.reference}
            messages={certificatesMessages(dict)}
          />
        )}
        <p className="text-muted-foreground w-full text-xs">{c.pdfNote}</p>
        {cert.revoke_reason ? (
          <p className="w-full text-sm">
            {c.reason}: {cert.revoke_reason}
          </p>
        ) : null}
      </div>
      <CertificateView
        lang={lang}
        dict={dict}
        cert={cert}
        school={school}
        qr={link.qr}
        verifyUrl={link.url}
      />
    </div>
  );
}
