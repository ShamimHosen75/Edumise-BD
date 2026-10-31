import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RefreshWhileWaiting } from "@/components/dashboard/fees/refresh-while-waiting";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireRole } from "@/lib/auth/session";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ lang: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).fees.online.statusTitle }
    : {};
}

/** Where the payer lands after the gateway: paid (with the receipt), failed or waiting. */
export default async function PaymentStatusPage({ params }: Props) {
  const { lang, id } = await params;
  if (!isLocale(lang) || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const me = await requireRole(lang, [
    "guardian",
    "student",
    "super_admin",
    "admin",
    "accountant",
  ]);
  const dict = await getDictionary(lang);
  const o = dict.fees.online;
  const { data: intent } = await (
    await createClient()
  )
    .from("payment_intents")
    .select("id, student_id, amount, status, payment_id, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!intent) notFound();
  const status = intent.status as "created" | "paid" | "failed";
  const back =
    me.role === "guardian"
      ? `/${lang}/dashboard/my-children/${intent.student_id}/fees`
      : me.role === "student"
        ? `/${lang}/dashboard/my-profile/fees`
        : `/${lang}/dashboard/fees/collect?student=${intent.student_id}`;
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">{o.statusTitle}</h1>
      <p
        role="status"
        data-testid="payment-status"
        className={`rounded-xl border p-4 font-semibold ${status === "paid" ? "border-green-700 text-green-800 dark:text-green-300" : status === "failed" ? "border-destructive text-destructive" : ""}`}
      >
        {o.statuses[status]}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{o.amount}</dt>
        <dd className="font-medium">{formatCurrency(intent.amount, lang)}</dd>
        <dt className="text-muted-foreground">{o.started}</dt>
        <dd>{formatDateTime(intent.created_at, lang)}</dd>
      </dl>
      {status === "created" ? (
        <RefreshWhileWaiting label={o.checkAgain} />
      ) : null}
      {intent.payment_id ? (
        <Link
          href={`/${lang}/dashboard/receipts/${intent.payment_id}`}
          className="text-primary w-fit font-medium hover:underline"
        >
          {o.seeReceipt}
        </Link>
      ) : null}
      <Link href={back} className="text-primary w-fit text-sm hover:underline">
        <span aria-hidden="true">←</span> {dict.fees.receipt.back}
      </Link>
    </div>
  );
}
