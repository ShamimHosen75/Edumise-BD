import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { listCertificates } from "@/lib/certificates-data";
import { formatDate, localizeDigits, pickLocalized } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).certificates.title }
    : {};
}

/** Issued certificates, newest first. */
export default async function CertificatesPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const c = dict.certificates;
  const rows = await listCertificates(await createClient());
  const th = "px-3 py-2 text-left";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{c.title}</h1>
          <p className="text-muted-foreground text-sm">{c.intro}</p>
        </div>
        <Link
          href={`/${lang}/dashboard/certificates/new`}
          className={cn(buttonVariants())}
        >
          <Plus aria-hidden="true" />
          {c.issue}
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border p-4 text-sm">
          {c.none}
        </p>
      ) : (
        <div
          role="region"
          tabIndex={0}
          aria-label={c.list}
          className="focus-visible:ring-ring overflow-x-auto rounded-xl border outline-none focus-visible:ring-2"
        >
          <table className="w-full text-sm" data-testid="certificate-list">
            <caption className="sr-only">{c.list}</caption>
            <thead className="bg-muted">
              <tr>
                {[c.reference, c.type, c.student, c.issuedOn, c.status].map(
                  (h) => (
                    <th key={h} scope="col" className={th}>
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <th scope="row" className={`${th} font-mono font-medium`}>
                    <Link
                      href={`/${lang}/dashboard/certificates/${r.id}`}
                      className="text-primary hover:underline"
                      aria-label={c.viewNamed.replace(
                        "{reference}",
                        r.reference,
                      )}
                    >
                      {r.reference}
                    </Link>
                  </th>
                  <td className="px-3 py-2">{c.types[r.type]}</td>
                  <td className="px-3 py-2">
                    {pickLocalized(r, "student_name", lang)}
                    {r.studentCode ? (
                      <span className="text-muted-foreground block text-xs">
                        {localizeDigits(r.studentCode, lang)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {formatDate(r.issued_on, lang, "medium")}
                  </td>
                  <td className="px-3 py-2">
                    {r.revoked_at ? (
                      <span className="text-destructive font-medium">
                        {c.revoked}
                      </span>
                    ) : (
                      c.valid
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
