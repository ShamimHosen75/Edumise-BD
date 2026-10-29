import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

import { CancelPaymentButton } from "@/components/dashboard/fees/cancel-payment-button";
import { ReceiptView } from "@/components/dashboard/fees/receipt-view";
import { PrintButton } from "@/components/routine/print-button";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireRole } from "@/lib/auth/session";
import { receiptById } from "@/lib/receipts-data";
import { feesMessages } from "@/lib/fees-messages";
import { sheetHeader } from "@/lib/school";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ lang: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).fees.receipt.title }
    : {};
}

const STAFF = ["super_admin", "admin", "accountant"] as const;

/** A money receipt: the office and the accountant, or the student and guardians (RLS). */
export default async function ReceiptPage({ params }: Props) {
  const { lang, id } = await params;
  if (!isLocale(lang) || !/^[1-9][0-9]{0,15}$/.test(id)) notFound();
  const me = await requireRole(lang, [...STAFF, "student", "guardian"]);
  const dict = await getDictionary(lang);
  const db = await createClient();
  const receipt = await receiptById(db, Number(id), lang);
  if (!receipt) notFound();
  const staff = (STAFF as readonly string[]).includes(me.role);
  const [school, qr] = await Promise.all([
    sheetHeader(lang, dict),
    // Enough to check a printed receipt against the books.
    QRCode.toDataURL(
      `${receipt.receiptNo}|${receipt.studentCode}|${receipt.amount / 100}|${receipt.paidOn}`,
      { margin: 1, errorCorrectionLevel: "M" },
    ),
  ]);
  const back = staff
    ? `/${lang}/dashboard/fees/collect?student=${receipt.studentId}`
    : me.role === "student"
      ? `/${lang}/dashboard/my-profile/fees`
      : `/${lang}/dashboard/my-children/${receipt.studentId}/fees`;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link href={back} className="text-primary text-sm hover:underline">
          <span aria-hidden="true">←</span> {dict.fees.receipt.back}
        </Link>
        <PrintButton label={dict.fees.invoices.print} />
        <a
          href={`/${lang}/dashboard/receipts/${receipt.id}/pdf`}
          className="text-primary text-sm font-medium hover:underline"
        >
          {dict.fees.receipt.pdf}
        </a>
        {!receipt.cancelled &&
        (me.role === "admin" || me.role === "super_admin") ? (
          <CancelPaymentButton
            lang={lang}
            id={receipt.id}
            receiptNo={receipt.receiptNo}
            messages={feesMessages(dict)}
          />
        ) : null}
      </div>
      <ReceiptView
        lang={lang}
        dict={dict}
        receipt={receipt}
        school={school}
        qr={qr}
      />
    </div>
  );
}
