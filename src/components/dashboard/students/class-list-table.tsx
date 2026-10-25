"use client";

import {
  tableLabels,
  translator,
} from "@/components/dashboard/academic/labels";
import { DataTable } from "@/components/ui/data-table";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { localizeDigits } from "@/lib/format";

export type ClassListRow = {
  id: number;
  roll: number;
  name: string;
  code: string;
  phone: string;
};

/** Students of one section this session, by roll. */
export function ClassListTable({
  lang,
  title,
  rows,
  messages,
}: {
  lang: Locale;
  title: string;
  rows: ClassListRow[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const s = (key: string) => tr(`students.${key}`);
  return (
    <DataTable
      title={title}
      csvName="class-list"
      data={rows}
      getRowId={(r) => String(r.id)}
      labels={{ ...tableLabels(tr, lang), empty: s("none") }}
      initialSort={{ id: "roll" }}
      pageSize={50}
      columns={[
        {
          id: "roll",
          header: s("roll"),
          value: (r) => r.roll,
          cell: (r) => localizeDigits(r.roll, lang),
        },
        { id: "name", header: s("name"), value: (r) => r.name },
        { id: "code", header: s("code"), value: (r) => r.code },
        {
          id: "phone",
          header: s("guardianPhone"),
          value: (r) => r.phone,
          cell: (r) => (r.phone ? localizeDigits(r.phone, lang) : "—"),
        },
      ]}
    />
  );
}
