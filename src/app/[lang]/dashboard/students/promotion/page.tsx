import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PromotionTool } from "@/components/dashboard/students/promotion-tool";
import { StudentsHeader } from "@/components/dashboard/students/students-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { studentMessages } from "@/lib/student-messages";
import {
  classChoices,
  sessions as sessionList,
  studentList,
} from "@/lib/students-data";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ from?: string; class?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).promotion.title }
    : {};
}

export default async function PromotionPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const p = dict.promotion;
  const db = await createClient();
  const [all, classes] = await Promise.all([
    sessionList(db),
    classChoices(db, lang),
  ]);
  const q = await searchParams;
  const from =
    all.find((s) => String(s.id) === q.from) ??
    all.find((s) => s.is_current) ??
    all[0];
  const cls = classes.find((c) => String(c.id) === q.class);
  const rows =
    from && cls
      ? (await studentList(db, from.id, lang)).filter(
          (r) => r.level === cls.level && r.status === "active",
        )
      : [];
  // Sessions are newest first: the one just before "from" in the list is the next year.
  const next = from
    ? all[all.findIndex((s) => s.id === from.id) - 1]
    : undefined;
  const select = "bg-background h-10 rounded-md border px-3 text-sm";

  return (
    <div className="flex flex-col gap-6">
      <StudentsHeader
        lang={lang}
        dict={dict}
        active="promotion"
        title={p.title}
        intro={p.intro}
      />
      <form
        action={`/${lang}/dashboard/students/promotion`}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="promotion-from">{p.from}</Label>
          <select
            id="promotion-from"
            name="from"
            defaultValue={from?.id}
            className={select}
          >
            {all.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="promotion-class">{p.class}</Label>
          <select
            id="promotion-class"
            name="class"
            defaultValue={cls?.id}
            className={select}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          {p.load}
        </Button>
      </form>
      {from && cls ? (
        <PromotionTool
          key={`${from.id}-${cls.id}`}
          lang={lang}
          fromSession={from.id}
          classId={cls.id}
          isLastClass={cls.level === Math.max(...classes.map((c) => c.level))}
          rows={rows.map((r) => ({
            id: r.id,
            name: r.name,
            code: r.code,
            section: r.section,
            roll: r.roll,
          }))}
          sessions={all.filter((s) => s.id !== from.id)}
          defaultTo={next?.id}
          messages={studentMessages(dict)}
        />
      ) : null}
    </div>
  );
}
