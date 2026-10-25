"use client";

import Link from "next/link";

import {
  tableLabels,
  translator,
} from "@/components/dashboard/academic/labels";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import type { QueueRow } from "@/lib/admissions-data";
import { formatDate, localizeDigits } from "@/lib/format";
import { ADMISSION_STATUSES } from "@/lib/validation/admission";
import { cn } from "@/lib/utils";

const BADGE: Record<string, string> = {
  submitted: "bg-muted",
  under_review: "bg-muted",
  test_scheduled:
    "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  approved: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
  waitlisted: "bg-muted",
};

/** The admission queue: search, class and status filters, CSV. */
export function AdmissionsTable({
  lang,
  rows,
  messages,
}: {
  lang: Locale;
  rows: QueueRow[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const a = (key: string) => tr(`admissionsAdmin.${key}`);
  const status = (r: QueueRow) => tr(`admission.statuses.${r.status}`);
  const classes = [
    ...new Map(rows.map((r) => [r.level, r.class_name])).entries(),
  ]
    .sort(([x], [y]) => x - y)
    .map(([, name]) => ({ value: name, label: name }));
  const base = `/${lang}/dashboard/admissions`;

  return (
    <DataTable
      title={a("queue")}
      csvName="admissions"
      data={rows}
      getRowId={(r) => String(r.id)}
      labels={tableLabels(tr, lang)}
      pageSize={20}
      columns={[
        {
          id: "tracking",
          header: a("trackingNo"),
          value: (r) => r.tracking_no,
        },
        {
          id: "student",
          header: a("student"),
          value: (r) => r.student,
          cell: (r) => (
            <Link
              href={`${base}/${r.id}`}
              className="font-medium hover:underline"
            >
              {r.student}
            </Link>
          ),
        },
        {
          id: "class",
          header: a("class"),
          value: (r) => r.class_name,
          sortValue: (r) => r.level,
          filter: classes,
        },
        {
          id: "status",
          header: a("status"),
          value: status,
          filter: ADMISSION_STATUSES.map((s) => ({
            value: tr(`admission.statuses.${s}`),
            label: tr(`admission.statuses.${s}`),
          })),
          cell: (r) => (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                BADGE[r.status],
              )}
            >
              {status(r)}
            </span>
          ),
        },
        {
          id: "phone",
          header: a("phone"),
          value: (r) => r.phone,
          cell: (r) => localizeDigits(r.phone, lang),
        },
        {
          id: "submitted",
          header: a("submitted"),
          value: (r) => r.submitted_at,
          cell: (r) => formatDate(r.submitted_at, lang, "medium"),
        },
        {
          id: "marks",
          header: a("marks"),
          value: (r) => r.test_marks,
          cell: (r) =>
            r.test_marks === null ? "—" : localizeDigits(r.test_marks, lang),
        },
      ]}
      rowActions={(r) => (
        <Link
          href={`${base}/${r.id}`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
          aria-label={tr("admissionsAdmin.openNamed", { name: r.student })}
        >
          {a("open")}
        </Link>
      )}
    />
  );
}
