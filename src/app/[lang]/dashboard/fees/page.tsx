import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FeesNav } from "@/components/dashboard/fees/fees-nav";
import { InvoiceTable } from "@/components/dashboard/fees/invoice-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { parsePeriod, type InvoiceStatus } from "@/lib/fees";
import { periodNamer } from "@/lib/fee-periods";
import { feeSessions, fineRule } from "@/lib/fees-data";
import {
  formatCurrency,
  localizeDigits,
  pickLocalized,
  toAsciiDigits,
} from "@/lib/format";
import { invoiceList } from "@/lib/invoices-data";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

const STATUSES: InvoiceStatus[] = ["unpaid", "partial", "paid", "cancelled"];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).fees.invoices.title }
    : {};
}

/** Invoices of a session, filtered by status, period and class. */
export default async function InvoicesPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const v = dict.fees.invoices;
  const db = await createClient();
  const q = await searchParams;
  const [sessions, rule, { data: classes }, periodName] = await Promise.all([
    feeSessions(db),
    fineRule(db),
    db.from("classes").select("id, name_en, name_bn").order("level"),
    periodNamer(db, lang),
  ]);
  const session =
    sessions.find((s) => String(s.id) === q.session) ??
    sessions.find((s) => s.current) ??
    sessions[0];
  if (!session) notFound();
  const status = STATUSES.find((s) => s === q.status);
  // Bangla digits are accepted ("২০২৬-১০").
  const typed = toAsciiDigits(q.period ?? "").trim();
  const period = typed && parsePeriod(typed) ? typed : undefined;
  const classId = (classes ?? []).find((c) => String(c.id) === q.class)?.id;
  const rows = await invoiceList(
    db,
    { sessionId: session.id, status, period, classId },
    rule,
    lang,
  );
  const due = rows.reduce(
    (s, r) => s + (r.status === "cancelled" ? 0 : r.total - r.paid),
    0,
  );
  const select = "bg-background h-10 rounded-md border px-3 text-sm";

  return (
    <div className="flex flex-col gap-5">
      <FeesNav lang={lang} dict={dict} active="invoices" />
      <form
        action={`/${lang}/dashboard/fees`}
        className="flex flex-wrap items-end gap-3 print:hidden"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inv-session">{dict.fees.generate.session}</Label>
          <select
            id="inv-session"
            name="session"
            defaultValue={session.id}
            className={select}
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {localizeDigits(s.name, lang)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inv-status">{v.status}</Label>
          <select
            id="inv-status"
            name="status"
            defaultValue={status ?? ""}
            className={select}
          >
            <option value="">{v.anyStatus}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {v.statuses[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inv-class">{v.class}</Label>
          <select
            id="inv-class"
            name="class"
            defaultValue={classId ?? ""}
            className={select}
          >
            <option value="">{v.anyClass}</option>
            {(classes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {pickLocalized(c, "name", lang)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inv-period">{v.period}</Label>
          <Input
            id="inv-period"
            name="period"
            defaultValue={period ?? ""}
            placeholder={v.periodHint}
            className="w-32"
          />
        </div>
        <Button type="submit" variant="outline">
          {v.filter}
        </Button>
      </form>
      <p
        className="text-sm font-medium"
        role="status"
        data-testid="invoice-count"
      >
        {v.count
          .replace("{count}", localizeDigits(rows.length, lang))
          .replace("{due}", formatCurrency(due, lang))}
      </p>
      {rows.length ? (
        <InvoiceTable
          lang={lang}
          dict={dict}
          rows={rows}
          periodName={periodName}
        />
      ) : (
        <p className="text-muted-foreground rounded-xl border p-4 text-sm">
          {v.none}
        </p>
      )}
    </div>
  );
}
