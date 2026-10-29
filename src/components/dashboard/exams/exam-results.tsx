"use client";

import { FileDown, Sheet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { processResults } from "@/app/[lang]/dashboard/exams/results-actions";
import { translator } from "@/components/dashboard/academic/labels";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { formatDateTime, formatNumber, localizeDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ResultsSection = { id: number; name: string; students: number };

/** Process results (exam in review), the summary, and the sheets per section. */
export function ExamResults({
  lang,
  examId,
  status,
  processedAt,
  current,
  summary,
  sections,
  messages,
}: {
  lang: Locale;
  examId: number;
  status: string;
  processedAt: string | null;
  current: boolean;
  summary: {
    students: number;
    passed: number;
    failed: number;
    passRate: number | null;
    gpa5: number;
  };
  sections: ResultsSection[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const r = (key: string, vars?: Record<string, string>) =>
    tr(`results.${key}`, vars);
  const n = (v: number) => localizeDigits(v, lang);
  const router = useRouter();
  const [pending, start] = useTransition();
  const base = `/${lang}/dashboard/exams/${examId}`;

  const run = () => {
    if (!window.confirm(r("processConfirm"))) return;
    start(async () => {
      const result = await processResults(lang, examId).catch(() => ({
        ok: false as const,
        error: "auth.unexpected" as const,
        count: undefined,
      }));
      if (!result.ok)
        return void toast.error(
          tr(result.error, { count: n(result.count ?? 0) }),
        );
      toast.success(r("processed", { count: n(result.count) }));
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-labelledby="results-process"
        aria-busy={pending}
        className="flex flex-col gap-3 rounded-xl border p-4"
      >
        <h2 id="results-process" className="font-semibold">
          {r("process")}
        </h2>
        <p className="text-sm" role="status" data-testid="results-state">
          {processedAt
            ? r("processedAt", { date: formatDateTime(processedAt, lang) })
            : r("notProcessed")}
          {processedAt && !current ? (
            <span className="text-destructive block">{r("stale")}</span>
          ) : null}
        </p>
        {status === "review" ? (
          <Button
            type="button"
            className="w-fit"
            disabled={pending}
            onClick={run}
          >
            {pending ? r("processing") : r("process")}
          </Button>
        ) : (
          <p className="text-muted-foreground text-sm">{r("processHint")}</p>
        )}
      </section>
      {summary.students ? (
        <>
          <dl
            className="grid grid-cols-2 gap-3 sm:grid-cols-5"
            data-testid="results-summary"
          >
            {(
              [
                ["students", n(summary.students)],
                ["passed", n(summary.passed)],
                ["failed", n(summary.failed)],
                [
                  "passRate",
                  summary.passRate === null
                    ? "—"
                    : `${formatNumber(summary.passRate, lang)}%`,
                ],
                ["gpa5", n(summary.gpa5)],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-xl border p-3">
                <dt className="text-muted-foreground text-xs">{r(k)}</dt>
                <dd className="text-lg font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          <section
            aria-labelledby="results-sections"
            className="flex flex-col gap-2"
          >
            <h2 id="results-sections" className="font-semibold">
              {r("sections")}
            </h2>
            <ul className="flex flex-col gap-2">
              {sections.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border p-3"
                >
                  <span className="min-w-0 flex-1 font-medium">
                    {s.name}{" "}
                    <span className="text-muted-foreground text-sm font-normal">
                      ({n(s.students)})
                    </span>
                  </span>
                  <Link
                    href={`${base}/tabulation?section=${s.id}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                    )}
                    aria-label={r("tabulationOf", { section: s.name })}
                  >
                    <Sheet aria-hidden="true" />
                    {r("tabulation")}
                  </Link>
                  <a
                    href={`${base}/tabulation/pdf?section=${s.id}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                    )}
                    aria-label={`${r("markSheets")}: ${s.name}`}
                  >
                    <FileDown aria-hidden="true" />
                    {r("markSheets")}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <p className="text-muted-foreground rounded-xl border p-4 text-sm">
          {r("none")}
        </p>
      )}
    </div>
  );
}
