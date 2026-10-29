import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CollectForm } from "@/components/dashboard/fees/collect-form";
import { FeesNav } from "@/components/dashboard/fees/fees-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import {
  collectItems,
  findStudents,
  studentForCollect,
} from "@/lib/collection-data";
import { fineRule } from "@/lib/fees-data";
import { studentPayments } from "@/lib/receipts-data";
import { feesMessages } from "@/lib/fees-messages";
import { formatCurrency, formatDate, localizeDigits } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string; student?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).fees.collect.title }
    : {};
}

/** Find a student, then collect what they owe. */
export default async function CollectPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const c = dict.fees.collect;
  const db = await createClient();
  const { q = "", student: studentParam } = await searchParams;
  const studentId = /^[1-9]\d{0,15}$/.test(studentParam ?? "")
    ? Number(studentParam)
    : null;
  const student = studentId
    ? await studentForCollect(db, studentId, lang)
    : null;
  const found =
    !student && q.trim() ? await findStudents(db, q.slice(0, 80), lang) : [];
  const [items, payments] = student
    ? await Promise.all([
        collectItems(db, student.id, await fineRule(db), lang),
        studentPayments(db, student.id),
      ])
    : [[], []];
  const n = (v: string | number) => localizeDigits(v, lang);
  const base = `/${lang}/dashboard/fees/collect`;

  return (
    <div className="flex flex-col gap-5">
      <FeesNav lang={lang} dict={dict} active="collect" />
      <form
        method="get"
        action={base}
        className="flex flex-wrap items-end gap-3"
        role="search"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-sm">
          <Label htmlFor="collect-q">{c.search}</Label>
          <Input
            id="collect-q"
            name="q"
            defaultValue={q}
            maxLength={80}
            aria-describedby="collect-q-hint"
          />
          <p id="collect-q-hint" className="text-muted-foreground text-xs">
            {c.searchHint}
          </p>
        </div>
        <Button type="submit" className="mb-5">
          {c.find}
        </Button>
      </form>

      {!student && q.trim() ? (
        found.length ? (
          <ul className="flex flex-col gap-2" data-testid="found-students">
            {found.map((s) => (
              <li key={s.id}>
                <Link
                  href={`${base}?student=${s.id}`}
                  className="hover:bg-muted flex flex-wrap gap-x-3 rounded-lg border p-3 text-sm"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted-foreground">
                    {n(s.code)}
                    {s.section ? ` · ${s.section}` : ""}
                    {s.roll !== null
                      ? ` · ${dict.fees.invoices.roll} ${n(s.roll)}`
                      : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">{c.noStudents}</p>
        )
      ) : null}

      {student ? (
        <section
          className="flex flex-col gap-4"
          aria-labelledby="collect-student"
        >
          <div>
            <h2 id="collect-student" className="text-lg font-semibold">
              {student.name}
            </h2>
            <p className="text-muted-foreground text-sm">
              {n(student.code)}
              {student.section ? ` · ${student.section}` : ""}
              {student.roll !== null
                ? ` · ${dict.fees.invoices.roll} ${n(student.roll)}`
                : ""}
            </p>
          </div>
          {items.length ? (
            <CollectForm
              key={items.map((i) => `${i.id}:${i.outstanding}`).join()}
              lang={lang}
              studentId={student.id}
              items={items}
              messages={feesMessages(dict)}
            />
          ) : (
            <p className="text-sm" data-testid="nothing-due">
              {c.nothingDue}
            </p>
          )}
          {payments.length ? (
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold">{c.recent}</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {payments.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/${lang}/dashboard/receipts/${p.id}`}
                      className="text-primary hover:underline"
                    >
                      {p.receiptNo}
                    </Link>{" "}
                    · {formatDate(p.paidOn, lang, "medium")} ·{" "}
                    {formatCurrency(p.amount, lang)} ·{" "}
                    {dict.fees.methods[p.method]}
                    {p.cancelled ? ` · ${dict.fees.receipt.cancelled}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <Link
            href={base}
            className="text-primary w-fit text-sm hover:underline"
          >
            {t(dict, "fees.collect.another")}
          </Link>
        </section>
      ) : null}
    </div>
  );
}
