import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { amountInWordsBn, amountInWordsEn } from "@/lib/amount-words";
import { receiverText } from "@/lib/receipt-text";
import type { Receipt } from "@/lib/receipts-data";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  localizeDigits,
} from "@/lib/format";

/** A money receipt: what was paid, for what, and the amount in words (EN and BN). */
export function ReceiptView({
  lang,
  dict,
  receipt: r,
  school,
  qr,
}: {
  lang: Locale;
  dict: Dictionary;
  receipt: Receipt;
  school: { name: string; address: string };
  qr: string;
}) {
  const v = dict.fees.receipt;
  const money = (p: number) => formatCurrency(p, lang);
  const cell = "border px-3 py-2";
  const facts: [string, string][] = [
    [v.receiptNo, r.receiptNo],
    [v.date, formatDate(r.paidOn, lang, "medium")],
    [
      dict.fees.invoices.student,
      `${r.student} (${localizeDigits(r.studentCode, lang)})`,
    ],
    ...(r.section
      ? [
          [
            v.class,
            `${r.section}${r.roll !== null ? ` · ${dict.fees.invoices.roll} ${localizeDigits(r.roll, lang)}` : ""}`,
          ] as [string, string],
        ]
      : []),
    [
      v.method,
      `${dict.fees.methods[r.method]}${r.txnId ? ` · ${v.txn} ${r.txnId}` : ""}`,
    ],
    [v.collectedBy, receiverText(r, dict)],
    ...(r.note ? [[v.note, r.note] as [string, string]] : []),
  ];
  return (
    <article
      className="print-sheet relative flex flex-col gap-4 rounded-xl border p-4 sm:p-6 print:border-0 print:p-0"
      data-testid="receipt"
    >
      {r.cancelled ? (
        <p
          role="status"
          className="border-destructive text-destructive rounded-md border-2 p-2 text-center font-semibold"
        >
          {v.cancelled} · {formatDateTime(r.cancelled.at, lang)} ·{" "}
          {r.cancelled.reason}
        </p>
      ) : null}
      <header className="text-center">
        <p className="text-lg font-semibold">{school.name}</p>
        {school.address ? (
          <p className="text-muted-foreground text-xs">{school.address}</p>
        ) : null}
        <h1 className="mt-2 text-xl font-semibold">{v.title}</h1>
      </header>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          {facts.map(([k, val]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium">{val}</dd>
            </div>
          ))}
        </dl>
        {/* eslint-disable-next-line @next/next/no-img-element -- a generated data URL */}
        <img src={qr} alt={v.qr} width={96} height={96} className="size-24" />
      </div>
      <div
        role="region"
        tabIndex={0}
        aria-label={v.lines}
        className="overflow-x-auto"
      >
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{v.lines}</caption>
          <thead className="bg-muted">
            <tr>
              {[
                dict.fees.invoices.invoiceNo,
                dict.fees.invoices.head,
                dict.fees.invoices.period,
                v.amount,
              ].map((h) => (
                <th key={h} scope="col" className={`${cell} text-left`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.lines.map((l, n) => (
              <tr key={n}>
                <td className={cell}>{l.invoiceNo}</td>
                <th scope="row" className={`${cell} text-left font-normal`}>
                  {l.head}
                </th>
                <td className={cell}>{l.period || "—"}</td>
                <td className={`${cell} text-right`}>{money(l.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <th scope="row" colSpan={3} className={`${cell} text-left`}>
                {v.total}
              </th>
              <td className={`${cell} text-right`} data-testid="receipt-total">
                {money(r.amount)}
              </td>
            </tr>
            <tr>
              <th
                scope="row"
                colSpan={3}
                className={`${cell} text-left font-normal`}
              >
                {v.dueNow}
              </th>
              <td className={`${cell} text-right`} data-testid="receipt-due">
                {money(r.dueNow)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="text-sm" data-testid="receipt-words">
        <p>
          <span className="text-muted-foreground">{v.inWords}: </span>
          <span lang="en">{amountInWordsEn(r.amount)}</span>
        </p>
        <p lang="bn">{amountInWordsBn(r.amount)}</p>
      </div>
      <div className="mt-8 flex justify-end text-sm">
        <p className="border-t px-6 pt-1">{v.signature}</p>
      </div>
    </article>
  );
}
