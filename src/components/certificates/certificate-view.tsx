import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { formatDate } from "@/lib/format";
import type { CertificateRow } from "@/lib/certificates-data";

/**
 * The certificate as printed (A4 portrait): school header, title, reference and date,
 * the text in the page language (English when no Bangla text), signature and QR code.
 */
export function CertificateView({
  lang,
  dict,
  cert,
  school,
  qr,
  verifyUrl,
}: {
  lang: Locale;
  dict: Dictionary;
  cert: CertificateRow;
  school: { name: string; address: string };
  /** QR code image (data URL) that opens verifyUrl. */
  qr: string;
  verifyUrl: string;
}) {
  const c = dict.certificates;
  const body =
    lang === "bn" && cert.body_bn.trim() ? cert.body_bn : cert.body_en;
  return (
    <article
      className="print-sheet bg-background relative flex flex-col gap-6 rounded-xl border p-6 sm:p-10 print:rounded-none print:border-0 print:p-0"
      aria-label={`${c.types[cert.type]} ${cert.reference}`}
      data-testid="certificate"
    >
      {cert.revoked_at ? (
        <p
          role="status"
          className="border-destructive text-destructive rounded-lg border-2 p-3 text-center font-semibold"
        >
          {c.revoked} ·{" "}
          {c.revokedOn.replace(
            "{date}",
            formatDate(cert.revoked_at, lang, "medium"),
          )}
        </p>
      ) : null}
      <header className="flex flex-col items-center gap-1 text-center">
        <p className="text-xl font-semibold">{school.name}</p>
        {school.address ? (
          <p className="text-muted-foreground text-sm">{school.address}</p>
        ) : null}
        <h1 className="mt-4 text-2xl font-semibold tracking-wide underline underline-offset-8">
          {c.types[cert.type]}
        </h1>
      </header>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <p>
          {c.reference}:{" "}
          <span
            className="font-mono font-semibold"
            data-testid="certificate-reference"
          >
            {cert.reference}
          </span>
        </p>
        <p>
          {c.date}: {formatDate(cert.issued_on, lang, "long")}
        </p>
      </div>
      <p
        className="text-base leading-8 whitespace-pre-line"
        lang={lang === "bn" && cert.body_bn.trim() ? "bn" : "en"}
      >
        {body}
      </p>
      <div className="mt-12 flex flex-wrap items-end justify-between gap-6">
        <div className="flex items-end gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- generated QR data URL */}
          <img src={qr} alt="" width={96} height={96} className="size-24" />
          <p className="text-muted-foreground max-w-56 text-xs break-all">
            {c.verifyHint.replace("{url}", verifyUrl)}
          </p>
        </div>
        <p className="w-48 border-t pt-1 text-center text-sm">{c.issuer}</p>
      </div>
    </article>
  );
}
