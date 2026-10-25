"use client";

import Link from "next/link";

import {
  tableLabels,
  translator,
} from "@/components/dashboard/academic/labels";
import { DataTable } from "@/components/ui/data-table";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import type { QueueRow } from "@/lib/admissions-data";
import { meritList } from "@/lib/admission";
import { localizeDigits } from "@/lib/format";

/** Applicants of one class ranked by test marks (ties: earlier application first). */
export function MeritTable({
  lang,
  className,
  rows,
  messages,
}: {
  lang: Locale;
  className: string;
  rows: QueueRow[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const a = (key: string) => tr(`admissionsAdmin.${key}`);
  const ranked = meritList(rows);
  return (
    <DataTable
      title={tr("admissionsAdmin.meritFor", { class: className })}
      csvName="merit-list"
      data={ranked}
      getRowId={(r) => String(r.id)}
      labels={{ ...tableLabels(tr, lang), empty: a("noMarks") }}
      initialSort={{ id: "rank" }}
      pageSize={50}
      columns={[
        {
          id: "rank",
          header: a("rank"),
          value: (r) => r.rank,
          cell: (r) => localizeDigits(r.rank, lang),
        },
        {
          id: "student",
          header: a("student"),
          value: (r) => r.student,
          cell: (r) => (
            <Link
              href={`/${lang}/dashboard/admissions/${r.id}`}
              className="font-medium hover:underline"
            >
              {r.student}
            </Link>
          ),
        },
        {
          id: "tracking",
          header: a("trackingNo"),
          value: (r) => r.tracking_no,
        },
        {
          id: "marks",
          header: a("marks"),
          value: (r) => r.test_marks,
          cell: (r) => localizeDigits(r.test_marks ?? 0, lang),
        },
        {
          id: "status",
          header: a("status"),
          value: (r) => tr(`admission.statuses.${r.status}`),
        },
      ]}
    />
  );
}
