import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/routine/print-button";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { periodNamer } from "@/lib/fee-periods";
import { fineRule } from "@/lib/fees-data";
import { formatCurrency, formatDate, localizeDigits } from "@/lib/format";
import { invoiceDetail } from "@/lib/invoices-data";
import { sheetHeader } from "@/lib/school";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ lang: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).fees.invoices.title }
    : {};
}

/** One invoice: items, waivers, what is owed and the late fine today. Printable. */
export default async function InvoicePage({ params }: Props) {
  const { lang, id } = await params;
  if (!isLocale(lang) || !/^[1-9][0-9]{0,15}$/.test(id)) notFound();
  const dict = await getDictionary(lang);
  const v = dict.fees.invoices;
  const db = await createClient();
  const rule = await fineRule(db);
  const [inv, school, periodName] = await Promise.all([
    invoiceDetail(db, Number(id), rule, lang),
    sheetHeader(lang, dict),
    periodNamer(db, lang),
  ]);
  if (!inv) notFound();
  const money = (p: number) => formatCurrency(p, lang);
  const cell = "border px-3 py-2";
  const facts: [string, string][] = [
    [v.invoiceNo, inv.invoiceNo],
    [v.student, `${inv.student} (${localizeDigits(inv.studentCode, lang)})`],
    [
      dict.fees.receipt.class,
      `${inv.section}${inv.roll !== null ? ` · ${v.roll} ${localizeDigits(inv.roll, lang)}` : ""}`,
    ],
    [v.issued, formatDate(inv.issuedOn, lang, "medium")],
    [v.due, formatDate(inv.dueOn, lang, "medium")],
    [v.status, v.statuses[inv.status]],
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link
          href={`/${lang}/dashboard/fees`}
          className="text-primary text-sm hover:underline"
        >
          <span aria-hidden="true">←</span> {v.back}
        </Link>
        <PrintButton label={v.print} />
      </div>
      <article
        className="print-sheet flex flex-col gap-4 rounded-xl border p-4 sm:p-6 print:border-0 print:p-0"
        data-testid="invoice"
      >
        <header className="text-center">
          <p className="text-lg font-semibold">{school.name}</p>
          {school.address ? (
            <p className="text-muted-foreground text-xs">{school.address}</p>
          ) : null}
          <h1 className="mt-2 text-xl font-semibold">{v.title}</h1>
        </header>
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          {facts.map(([k, val]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium">{val}</dd>
            </div>
          ))}
        </dl>
        <div
          role="region"
          tabIndex={0}
          aria-label={v.items}
          className="overflow-x-auto"
        >
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{v.items}</caption>
            <thead className="bg-muted">
              <tr>
                {[v.head, v.period, v.gross, v.waiver, v.net].map((h) => (
                  <th key={h} scope="col" className={`${cell} text-left`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inv.items.map((i, n) => (
                <tr key={n}>
                  <th scope="row" className={`${cell} text-left font-normal`}>
                    {i.head}
                  </th>
                  <td className={cell}>
                    {i.periodKey ? periodName(i.periodKey) : "—"}
                  </td>
                  <td className={`${cell} text-right`}>{money(i.gross)}</td>
                  <td className={`${cell} text-right`}>
                    {i.waiver ? money(i.waiver) : "—"}
                  </td>
                  <td className={`${cell} text-right`}>{money(i.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="grid gap-2 sm:grid-cols-4" data-testid="invoice-totals">
          {(
            [
              [v.total, money(inv.total)],
              [v.paid, money(inv.paid)],
              [v.outstanding, money(inv.total - inv.paid)],
              [v.fine, inv.fine ? money(inv.fine) : "—"],
            ] as [string, string][]
          ).map(([k, val]) => (
            <div key={k} className="rounded-lg border p-2">
              <dt className="text-muted-foreground text-xs">{k}</dt>
              <dd className="font-semibold">{val}</dd>
            </div>
          ))}
        </dl>
        {inv.fine ? (
          <p className="text-muted-foreground text-xs">{v.fineNote}</p>
        ) : null}
      </article>
    </div>
  );
}
