import Link from "next/link";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import type { CollectionSummary } from "@/lib/fee-reports";
import { formatCurrency } from "@/lib/format";

/** The accountant's home: today's and this month's collection, and the largest dues. */
export function CollectionWidgets({
  lang,
  dict,
  data,
}: {
  lang: Locale;
  dict: Dictionary;
  data: CollectionSummary;
}) {
  const w = dict.dashboard.widgets;
  const money = (p: number) => formatCurrency(p, lang);
  const card = "bg-card rounded-xl border p-4 shadow-xs";
  return (
    <ul
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      data-testid="collection-widgets"
    >
      <li className={card}>
        <p className="text-sm font-medium">{w.todaysCollection}</p>
        <p className="mt-2 text-2xl font-semibold" data-testid="widget-today">
          {money(data.today)}
        </p>
        <Link
          href={`/${lang}/dashboard/fees/collect`}
          className="text-primary text-xs hover:underline"
        >
          {dict.fees.nav.collect}
        </Link>
      </li>
      <li className={card}>
        <p className="text-sm font-medium">{w.monthCollection}</p>
        <p className="mt-2 text-2xl font-semibold" data-testid="widget-month">
          {money(data.month)}
        </p>
        <p className="text-muted-foreground text-xs">
          {t(dict, "dashboard.widgets.lastMonth", {
            amount: money(data.lastMonth),
          })}
        </p>
      </li>
      <li className={card}>
        <p className="text-sm font-medium">{w.topDues}</p>
        {data.topDues.length ? (
          <ol className="mt-2 flex flex-col gap-1 text-sm">
            {data.topDues.map((d) => (
              <li key={d.id} className="flex justify-between gap-2">
                <Link
                  href={`/${lang}/dashboard/fees/collect?student=${d.id}`}
                  className="text-primary truncate hover:underline"
                >
                  {d.name}
                </Link>
                <span className="whitespace-nowrap">{money(d.amount)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground mt-2 text-sm">
            {dict.fees.portal.allPaid}
          </p>
        )}
      </li>
    </ul>
  );
}
