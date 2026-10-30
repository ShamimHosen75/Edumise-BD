import Link from "next/link";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { studentInvoices, studentPayments } from "@/lib/receipts-data";
import { PayNowButton } from "@/components/dashboard/fees/pay-buttons";
import { fineRule, onlinePayment } from "@/lib/fees-data";
import { feesMessages } from "@/lib/fees-messages";
import { getProvider } from "@/lib/payments";
import { formatCurrency, formatDate, localizeDigits } from "@/lib/format";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/** A student's (or child's) bills, what is due now and their receipts. RLS limits it. */
export async function PortalFees({
  db,
  lang,
  dict,
  studentId,
  name,
  code,
  payOnline = false,
}: {
  db: Client;
  lang: Locale;
  dict: Dictionary;
  studentId: number;
  name: string;
  code: string;
  /** Show "Pay now" when the school has switched online payment on (guardians). */
  payOnline?: boolean;
}) {
  const [invoices, payments, online] = await Promise.all([
    studentInvoices(db, studentId, await fineRule(db), lang),
    studentPayments(db, studentId),
    onlinePayment(db),
  ]);
  const p = dict.fees.portal;
  const v = dict.fees.invoices;
  const money = (x: number) => formatCurrency(x, lang);
  const open = invoices.filter(
    (i) => i.status === "unpaid" || i.status === "partial",
  );
  const due = open.reduce((s, i) => s + i.total - i.paid + i.fine, 0);
  const cell = "border-b px-2 py-2";
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">{p.title}</h1>
        <p className="text-muted-foreground text-sm">
          {name} · {localizeDigits(code, lang)}
        </p>
      </div>
      <p
        className={`rounded-xl border p-4 text-lg font-semibold ${due ? "border-amber-600 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100" : ""}`}
        data-testid="fees-due"
        role="status"
      >
        {due ? t(dict, "fees.portal.due", { amount: money(due) }) : p.allPaid}
      </p>
      {payOnline && online.enabled && due ? (
        online.provider === "manual" ? (
          <p className="text-sm">{dict.fees.online.payAtOffice}</p>
        ) : getProvider(online.provider)?.available() ? (
          <PayNowButton
            lang={lang}
            studentId={studentId}
            messages={feesMessages(dict)}
          />
        ) : null
      ) : null}
      <section
        aria-labelledby="portal-invoices"
        className="flex flex-col gap-2"
      >
        <h2 id="portal-invoices" className="text-lg font-semibold">
          {v.title}
        </h2>
        {invoices.length ? (
          <div
            role="region"
            tabIndex={0}
            aria-labelledby="portal-invoices"
            className="overflow-x-auto rounded-lg border"
          >
            <table className="w-full text-sm" data-testid="portal-invoices">
              <thead className="bg-muted text-left">
                <tr>
                  {[
                    v.invoiceNo,
                    v.period,
                    v.due,
                    v.total,
                    v.paid,
                    v.status,
                  ].map((h) => (
                    <th key={h} scope="col" className={cell}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <th scope="row" className={`${cell} text-left font-normal`}>
                      {i.invoiceNo}
                    </th>
                    <td className={cell}>{i.periods.join(", ")}</td>
                    <td className={cell}>
                      {formatDate(i.dueOn, lang, "medium")}
                    </td>
                    <td className={cell}>
                      {money(i.total)}
                      {i.fine ? (
                        <span className="text-muted-foreground block text-xs">
                          {t(dict, "fees.portal.plusFine", {
                            amount: money(i.fine),
                          })}
                        </span>
                      ) : null}
                    </td>
                    <td className={cell}>{money(i.paid)}</td>
                    <td className={cell}>{v.statuses[i.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{p.noInvoices}</p>
        )}
      </section>
      <section
        aria-labelledby="portal-receipts"
        className="flex flex-col gap-2"
      >
        <h2 id="portal-receipts" className="text-lg font-semibold">
          {p.receipts}
        </h2>
        {payments.length ? (
          <ul
            className="flex flex-col gap-1 text-sm"
            data-testid="portal-receipts"
          >
            {payments.map((x) => (
              <li key={x.id}>
                <Link
                  href={`/${lang}/dashboard/receipts/${x.id}`}
                  className="text-primary hover:underline"
                >
                  {x.receiptNo}
                </Link>{" "}
                · {formatDate(x.paidOn, lang, "medium")} · {money(x.amount)} ·{" "}
                {dict.fees.methods[x.method]}
                {x.cancelled ? ` · ${dict.fees.receipt.cancelled}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">{p.noReceipts}</p>
        )}
      </section>
    </div>
  );
}
