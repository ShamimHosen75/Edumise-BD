import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StudentResultsPage } from "@/components/results/student-results-page";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireRole } from "@/lib/auth/session";
import { myChildren } from "@/lib/portal-data";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ lang: string; id: string }>;
  searchParams: Promise<{ exam?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).results.title }
    : {};
}

/** A guardian's view of one child's published results. */
export default async function ChildResultsPage({
  params,
  searchParams,
}: Props) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  const me = await requireRole(lang, ["guardian"]);
  const db = await createClient();
  const child = (await myChildren(db, me.id, lang)).find(
    (c) => String(c.id) === id,
  );
  if (!child) notFound();
  return (
    <StudentResultsPage
      db={db}
      lang={lang}
      dict={await getDictionary(lang)}
      studentId={child.id}
      name={child.name}
      code={child.code}
      base={`/${lang}/dashboard/my-children/${child.id}/results`}
      exam={(await searchParams).exam}
    />
  );
}
