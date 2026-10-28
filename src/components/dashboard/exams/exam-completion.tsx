"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { unlockMarks } from "@/app/[lang]/dashboard/exams/actions";
import {
  tableLabels,
  translator,
} from "@/components/dashboard/academic/labels";
import { Button, buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import type { CompletionRow } from "@/lib/exams-data";
import { formatDate, localizeDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Marks entered per subject and section, submitted or not, with unlock. */
export function ExamCompletion({
  lang,
  examId,
  rows,
  messages,
}: {
  lang: Locale;
  examId: number;
  rows: CompletionRow[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const e = (key: string, vars?: Record<string, string>) =>
    tr(`exams.${key}`, vars);
  const n = (v: number) => localizeDigits(v, lang);
  const router = useRouter();
  const [pending, start] = useTransition();
  const unlock = (r: CompletionRow) => {
    if (
      !window.confirm(
        e("unlockConfirm", { subject: r.subject, section: r.section }),
      )
    )
      return;
    start(async () => {
      const result = await unlockMarks(
        lang,
        r.examSubjectId,
        r.sectionId,
      ).catch(() => ({
        ok: false as const,
        error: "auth.unexpected" as const,
      }));
      if (!result.ok) return void toast.error(tr(result.error));
      toast.success(e("unlocked"));
      router.refresh();
    });
  };
  const state = (r: CompletionRow) =>
    r.lockedAt ? e("locked") : e("notLocked");

  return (
    <DataTable
      title={e("completion")}
      csvName="marks-completion"
      data={rows}
      getRowId={(r) => r.key}
      labels={{ ...tableLabels(tr, lang), empty: e("noSubjects") }}
      loading={pending}
      pageSize={50}
      columns={[
        {
          id: "section",
          header: e("section"),
          value: (r) => r.section,
          sortValue: (r) => `${r.level}-${r.section}`,
          filter: [...new Set(rows.map((r) => r.section))].map((v) => ({
            value: v,
            label: v,
          })),
        },
        {
          id: "subject",
          header: e("subject"),
          value: (r) => r.subject,
          sortValue: (r) => r.sortOrder,
        },
        {
          id: "entered",
          header: e("entered"),
          value: (r) => `${n(r.entered)} / ${n(r.students)}`,
          sortValue: (r) => r.entered / Math.max(1, r.students),
          cell: (r) => (
            <span
              className={cn(
                r.entered < r.students ? "text-destructive" : "text-primary",
                "font-medium",
              )}
            >
              {n(r.entered)} / {n(r.students)}
            </span>
          ),
        },
        {
          id: "state",
          header: e("locked"),
          value: state,
          filter: [e("locked"), e("notLocked")].map((v) => ({
            value: v,
            label: v,
          })),
          cell: (r) =>
            r.lockedAt
              ? `${e("locked")} · ${formatDate(r.lockedAt, lang, "medium")}`
              : e("notLocked"),
        },
      ]}
      rowActions={(r) => (
        <>
          <Link
            href={`/${lang}/dashboard/marks?exam=${examId}&entry=${r.examSubjectId}-${r.sectionId}`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            {e("enterMarks")}
          </Link>
          {r.lockedAt ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => unlock(r)}
            >
              {e("unlock")}
            </Button>
          ) : null}
        </>
      )}
    />
  );
}
