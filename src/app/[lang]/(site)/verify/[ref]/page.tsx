import { CircleCheck, CircleX } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { ContentHeader } from "@/components/site/content/content-header";
import { VerifyForm } from "@/components/site/verify-form";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { normalizeReference, type CertificateType } from "@/lib/certificates";
import { formatDate, pickLocalized } from "@/lib/format";
import { hitRateLimit } from "@/lib/rate-limit";
import { clientIp, LIMITS, rateKey } from "@/lib/rate-limit-keys";
import { createAdminClient } from "@/lib/supabase/admin";

type Props = { params: Promise<{ lang: string; ref: string }> };

type Found = {
  reference: string;
  type: CertificateType;
  name_en: string;
  name_bn: string;
  issued_on: string;
  revoked: boolean;
  revoked_on: string | null;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  // A certificate check names a student: keep it out of search engines.
  return {
    title: (await getDictionary(lang)).verify.title,
    robots: { index: false },
  };
}

/**
 * The QR code target. Shows only the student's name, the certificate type, the issue
 * date and whether it is valid or revoked. Rate-limited per visitor.
 */
export default async function VerifyResultPage({ params }: Props) {
  const { lang, ref: raw } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const v = dict.verify;
  let typed: string;
  try {
    typed = decodeURIComponent(raw).slice(0, 40);
  } catch {
    typed = raw.slice(0, 40); // a malformed %-escape: shown as invalid, not an error
  }
  const ref = normalizeReference(typed);
  if (ref && ref !== typed) redirect(`/${lang}/verify/${ref}`);

  let outcome: React.ReactNode;
  if (!ref) {
    outcome = <Notice text={v.invalid} />;
  } else if (
    await hitRateLimit(
      rateKey("verify-ip", clientIp(await headers())),
      LIMITS.verifyPerIp,
    )
  ) {
    outcome = <Notice text={v.tooMany} />;
  } else {
    const { data, error } = await createAdminClient().rpc(
      "verify_certificate",
      {
        p_reference: ref,
      },
    );
    if (error) throw new Error(error.message);
    const found = data as Found | null;
    outcome = found ? (
      <Result lang={lang} dict={dict} found={found} />
    ) : (
      <Notice text={v.notFound} />
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <ContentHeader title={v.title} intro={v.intro} />
      <div aria-live="polite">{outcome}</div>
      <div className="rounded-xl border p-4">
        <VerifyForm
          lang={lang}
          text={{ reference: v.reference, check: v.another }}
        />
      </div>
    </div>
  );
}

function Result({
  lang,
  dict,
  found,
}: {
  lang: "en" | "bn";
  dict: Awaited<ReturnType<typeof getDictionary>>;
  found: Found;
}) {
  const v = dict.verify;
  const Icon = found.revoked ? CircleX : CircleCheck;
  const rows: [string, string][] = [
    [dict.certificates.reference, found.reference],
    [v.name, pickLocalized(found, "name", lang)],
    [v.type, dict.certificates.types[found.type]],
    [v.issuedOn, formatDate(found.issued_on, lang, "long")],
    ...(found.revoked && found.revoked_on
      ? [
          [v.revokedOn, formatDate(found.revoked_on, lang, "long")] as [
            string,
            string,
          ],
        ]
      : []),
  ];
  return (
    <section
      aria-labelledby="verify-status"
      data-testid="verify-result"
      className={`flex flex-col gap-4 rounded-xl border-2 p-5 ${found.revoked ? "border-destructive" : "border-primary"}`}
    >
      <h2
        id="verify-status"
        className={`flex items-center gap-2 text-lg font-semibold ${found.revoked ? "text-destructive" : "text-primary"}`}
        data-testid="verify-status"
      >
        <Icon className="size-6" aria-hidden="true" />
        {found.revoked ? v.revoked : v.valid}
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(([k, val]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium break-all">{val}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <p
      role="status"
      className="text-muted-foreground rounded-xl border p-6 text-center text-sm"
    >
      {text}
    </p>
  );
}
