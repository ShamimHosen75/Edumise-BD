import type { Translate } from "@/components/dashboard/academic/labels";
import type { Locale } from "@/i18n/config";
import type { CollectItem } from "@/lib/collection-data";
import { formatCurrency, formatDate } from "@/lib/format";

/** What the student owes, one row per item, with a tick box to pay it. */
export function DueItemList({
  lang,
  items,
  ticked,
  chosen,
  onTick,
  tr,
}: {
  lang: Locale;
  items: CollectItem[];
  ticked: ReadonlySet<number>;
  chosen: readonly CollectItem[];
  onTick: (id: number, on: boolean) => void;
  tr: Translate;
}) {
  const inPlay = new Set(chosen.map((i) => i.id));
  const cell = "border-b px-2 py-2";
  return (
    <div
      role="region"
      tabIndex={0}
      aria-label={tr("fees.collect.items")}
      className="overflow-x-auto rounded-lg border"
    >
      <table className="w-full text-sm" data-testid="due-items">
        <caption className="sr-only">{tr("fees.collect.items")}</caption>
        <thead className="bg-muted text-left">
          <tr>
            <th scope="col" className={cell}>
              <span className="sr-only">{tr("fees.collect.pay")}</span>
            </th>
            <th scope="col" className={cell}>
              {tr("fees.invoices.head")}
            </th>
            <th scope="col" className={cell}>
              {tr("fees.invoices.invoiceNo")}
            </th>
            <th scope="col" className={cell}>
              {tr("fees.invoices.due")}
            </th>
            <th scope="col" className={`${cell} text-right`}>
              {tr("fees.invoices.outstanding")}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const label = `${i.head}${i.period ? ` ${i.period}` : ""}`;
            return (
              <tr
                key={i.id}
                className={inPlay.has(i.id) ? "" : "text-muted-foreground"}
              >
                <td className={cell}>
                  <input
                    type="checkbox"
                    className="size-5"
                    aria-label={tr("fees.collect.payNamed", {
                      item: `${label} (${i.invoiceNo})`,
                    })}
                    checked={i.isFine ? inPlay.has(i.id) : ticked.has(i.id)}
                    // A fine is paid with its invoice's items, never on its own.
                    disabled={i.isFine}
                    onChange={(e) => onTick(i.id, e.target.checked)}
                  />
                </td>
                <th scope="row" className={`${cell} text-left font-normal`}>
                  {label}
                  {i.isFine ? (
                    <span className="text-muted-foreground block text-xs">
                      {tr(
                        i.live
                          ? "fees.collect.fineLive"
                          : "fees.collect.fineFrozen",
                      )}
                    </span>
                  ) : null}
                </th>
                <td className={cell}>{i.invoiceNo}</td>
                <td className={cell}>{formatDate(i.dueOn, lang, "medium")}</td>
                <td className={`${cell} text-right`}>
                  {formatCurrency(i.outstanding, lang)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
