"use client";

import { Eye, Plus } from "lucide-react";
import Link from "next/link";

import {
  tableLabels,
  translator,
} from "@/components/dashboard/academic/labels";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { localizeDigits } from "@/lib/format";
import type { StudentListRow } from "@/lib/students-data";

/** Everyone enrolled in a session: filters for class, section, group and status. */
export function StudentsTable({
  lang,
  title,
  rows,
  messages,
}: {
  lang: Locale;
  title: string;
  rows: StudentListRow[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const s = (key: string, vars?: Record<string, string>) =>
    tr(`students.${key}`, vars);
  const base = `/${lang}/dashboard/students`;
  const unique = (values: string[]) =>
    [...new Set(values.filter(Boolean))].map((v) => ({ value: v, label: v }));
  const classes = [...new Map(rows.map((r) => [r.level, r.className]))]
    .sort(([a], [b]) => a - b)
    .map(([, name]) => ({ value: name, label: name }));
  const status = (r: StudentListRow) => s(`statuses.${r.status}`);

  return (
    <DataTable
      title={title}
      csvName="students"
      data={rows}
      getRowId={(r) => String(r.id)}
      labels={{ ...tableLabels(tr, lang), empty: s("none") }}
      pageSize={50}
      toolbar={
        <Link href={`${base}/new`} className={buttonVariants()}>
          <Plus aria-hidden="true" />
          {s("add")}
        </Link>
      }
      columns={[
        {
          id: "class",
          header: s("class"),
          value: (r) => r.className,
          sortValue: (r) => r.level,
          filter: classes,
        },
        {
          id: "section",
          header: s("section"),
          value: (r) => r.section,
          filter: unique(rows.map((r) => r.section)).sort((a, b) =>
            a.label.localeCompare(b.label),
          ),
        },
        {
          id: "roll",
          header: s("roll"),
          value: (r) => r.roll,
          cell: (r) => localizeDigits(r.roll, lang),
        },
        {
          id: "name",
          header: s("name"),
          value: (r) => r.name,
          cell: (r) => (
            <Link
              href={`${base}/${r.id}`}
              className="font-medium hover:underline"
            >
              {r.name}
            </Link>
          ),
        },
        {
          id: "code",
          header: s("code"),
          value: (r) => r.code,
          cell: (r) => localizeDigits(r.code, lang),
        },
        {
          id: "group",
          header: s("group"),
          value: (r) => r.group,
          filter: unique(rows.map((r) => r.group)),
          cell: (r) => r.group || "—",
        },
        {
          id: "status",
          header: s("status"),
          value: status,
          filter: unique(rows.map(status)),
        },
        {
          id: "phone",
          header: s("guardianPhone"),
          value: (r) => r.phone,
          cell: (r) => (r.phone ? localizeDigits(r.phone, lang) : "—"),
        },
      ]}
      rowActions={(r) => (
        <Link
          href={`${base}/${r.id}`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
          aria-label={s("openNamed", { name: r.name })}
        >
          <Eye aria-hidden="true" />
          <span className="hidden sm:inline">{s("open")}</span>
        </Link>
      )}
    />
  );
}
