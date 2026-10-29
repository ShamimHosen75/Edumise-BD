import Link from "next/link";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { formatCurrency, formatDate, localizeDigits } from "@/lib/format";
import type { InvoiceListRow } from "@/lib/invoices-data";
import { cn } from "@/lib/utils";

/** Invoices with what is still owed and the late fine today. */
export function InvoiceTable({
  lang,
  dict,
  rows,
  periodName,
}: {
  lang: Locale;
  dict: Dictionary;
  rows: InvoiceListRow[];
  periodName: (key: string) => string;
}) {
  const v = dict.fees.invoices;
  const money = (p: number) => formatCurrency(p, lang);
  const th = "px-3 py-2 text-left whitespace-nowrap";
  const td = "px-3 py-2";
  return (
    <div
      role="region"
      tabIndex={0}
      aria-label={v.title}
      className="focus-visible:ring-ring overflow-x-auto rounded-xl border outline-none focus-visible:ring-2"
    >
      <table className="w-full text-sm" data-testid="invoice-list">
        <caption className="sr-only">{v.title}</caption>
        <thead className="bg-muted">
          <tr>
            {[
              v.invoiceNo,
              v.student,
              v.period,
              v.due,
              v.total,
              v.outstanding,
              v.fine,
              v.status,
            ].map((h) => (
              <th key={h} scope="col" className={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <th scope="row" className={cn(th, "font-mono font-medium")}>
                <Link
                  href={`/${lang}/dashboard/fees/invoices/${r.id}`}
                  className="text-primary hover:underline"
                  aria-label={v.viewNamed.replace("{no}", r.invoiceNo)}
                >
                  {r.invoiceNo}
                </Link>
              </th>
              <td className={td}>
                {r.student}
                <span className="text-muted-foreground block text-xs">
                  {r.section}
                  {r.roll !== null
                    ? ` · ${v.roll} ${localizeDigits(r.roll, lang)}`
                    : ""}
                </span>
              </td>
              <td className={td}>{r.periods.map(periodName).join(", ")}</td>
              <td className={cn(td, "whitespace-nowrap")}>
                {formatDate(r.dueOn, lang, "medium")}
              </td>
              <td className={cn(td, "text-right whitespace-nowrap")}>
                {money(r.total)}
              </td>
              <td className={cn(td, "text-right whitespace-nowrap")}>
                {money(r.total - r.paid)}
              </td>
              <td className={cn(td, "text-right whitespace-nowrap")}>
                {r.fine ? money(r.fine) : "—"}
              </td>
              <td className={td} data-testid="invoice-status">
                {v.statuses[r.status]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
