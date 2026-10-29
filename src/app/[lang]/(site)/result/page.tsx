import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/routine/print-button";
import { MarkSheet } from "@/components/results/mark-sheet";
import { ContentHeader } from "@/components/site/content/content-header";
import { ResultSearch } from "@/components/site/result-search";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { t, type TranslationKey } from "@/i18n/t";
import { hitRateLimit } from "@/lib/rate-limit";
import { clientIp, LIMITS, rateKey } from "@/lib/rate-limit-keys";
import { readMarkSheet } from "@/lib/results-data";
import { sheetHeader } from "@/lib/school";
import { pageAlternates } from "@/lib/site/detail-metadata";
import { getResultChoices } from "@/lib/site/result-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { resultSearchSchema } from "@/lib/validation/results";

type Search = Partial<
  Record<"session" | "exam" | "class" | "section" | "group" | "roll", string>
>;
type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Search>;
};

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    alternates: pageAlternates(lang, "/result"),
    title: dict.result.title,
    description: dict.result.intro,
    // A found mark sheet is personal: keep searches out of search engines.
    ...((await searchParams).roll ? { robots: { index: false } } : {}),
  };
}

/** Public result search: one mark sheet per search, rate-limited per visitor. */
export default async function ResultPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const r = dict.result;
  const [choices, query] = await Promise.all([
    getResultChoices(lang),
    searchParams,
  ]);
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const values = {
    session: str(query.session),
    exam: str(query.exam),
    class: str(query.class),
    section: str(query.section),
    group: str(query.group),
    roll: str(query.roll),
  };

  const errors: Partial<Record<"exam" | "section" | "roll" | "group", string>> =
    {};
  let outcome: React.ReactNode = null;
  if (values.roll !== undefined) {
    const parsed = resultSearchSchema.safeParse({
      exam: values.exam ?? "",
      section: values.section ?? "",
      roll: values.roll,
      group: values.group ?? "",
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]) as keyof typeof errors;
        errors[field] ??= t(dict, issue.message as TranslationKey);
      }
    } else if (
      (await hitRateLimit(
        rateKey("result-ip", clientIp(await headers())),
        LIMITS.resultPerIp,
      )) ||
      (await hitRateLimit(
        rateKey("result-ip-day", clientIp(await headers())),
        LIMITS.resultPerIpDay,
      ))
    ) {
      outcome = <Notice text={r.tooMany} />;
    } else {
      const { exam, section, roll, group } = parsed.data;
      const { data, error } = await createAdminClient().rpc("lookup_result", {
        p_exam_id: exam,
        p_section_id: section,
        p_roll: roll,
        p_group_id: group ?? undefined,
      });
      if (error) throw new Error(error.message);
      const sheet = readMarkSheet(data);
      outcome = sheet ? (
        <div className="flex flex-col gap-3">
          <PrintButton label={dict.results.print} />
          <MarkSheet
            lang={lang}
            dict={dict}
            sheet={sheet}
            school={await sheetHeader(lang, dict)}
          />
        </div>
      ) : (
        <Notice text={r.notFound} />
      );
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 print:p-0">
      <div className="print:hidden">
        <ContentHeader title={r.title} intro={r.intro} />
      </div>
      {choices.exams.length ? (
        <ResultSearch
          action={`/${lang}/result`}
          choices={choices}
          text={{
            session: dict.results.session,
            exam: r.exam,
            class: r.class,
            section: r.section,
            group: r.group,
            anyGroup: r.anyGroup,
            roll: r.roll,
            search: r.search,
            choose: r.choose,
          }}
          values={values}
          errors={errors}
        />
      ) : (
        <Notice text={r.none} />
      )}
      <div aria-live="polite">{outcome}</div>
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <p
      role="status"
      className="text-muted-foreground rounded-xl border p-6 text-center text-sm"
    >
      {text}
    </p>
  );
}
