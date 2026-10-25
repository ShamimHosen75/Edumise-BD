"use client";

import { CrudTable } from "@/components/dashboard/academic/crud-table";
import { translator } from "@/components/dashboard/academic/labels";
import {
  SelectField,
  TextField,
} from "@/components/dashboard/content/form-controls";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { formatDate, localizeDigits } from "@/lib/format";
import { hhmm } from "@/lib/routine";

export type PaperRow = {
  id: number;
  exam_id: number;
  class_id: number;
  subject_id: number;
  exam_date: string;
  starts_at: string;
  ends_at: string;
  className: string;
  level: number;
  subject: string;
};

type Option = { id: number; name: string };

/** The papers of one exam: class, subject, date and time. */
export function ExamScheduleManager({
  lang,
  examId,
  rows,
  classes,
  subjects,
  messages,
}: {
  lang: Locale;
  examId: number;
  rows: PaperRow[];
  classes: Option[];
  subjects: Option[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const e = (key: string) => tr(`examSchedule.${key}`);
  const time = (v: string) => localizeDigits(hhmm(v), lang);
  const name = (r: PaperRow) => `${r.className}: ${r.subject}`;
  return (
    <CrudTable
      lang={lang}
      entity="exam-schedule"
      tr={tr}
      title={e("list")}
      item={e("item")}
      rows={rows}
      rowName={name}
      initialSort={{ id: "date" }}
      columns={[
        {
          id: "class",
          header: e("class"),
          value: (r) => r.className,
          sortValue: (r) => r.level,
          filter: classes.map((c) => ({ value: c.name, label: c.name })),
        },
        { id: "subject", header: e("subject"), value: (r) => r.subject },
        {
          id: "date",
          header: e("date"),
          value: (r) => formatDate(r.exam_date, lang),
          sortValue: (r) => `${r.exam_date} ${r.starts_at}`,
        },
        {
          id: "time",
          header: e("time"),
          value: (r) => `${time(r.starts_at)}–${time(r.ends_at)}`,
        },
      ]}
      defaults={(r) => ({
        exam_id: examId,
        class_id: r?.class_id ?? null,
        subject_id: r?.subject_id ?? null,
        exam_date: r?.exam_date ?? "",
        starts_at: r ? hhmm(r.starts_at) : "10:00",
        ends_at: r ? hhmm(r.ends_at) : "13:00",
      })}
      fields={(form) => (
        <>
          <SelectField
            form={form}
            t={tr}
            name="class_id"
            label={e("class")}
            numeric
            empty="—"
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
          />
          <SelectField
            form={form}
            t={tr}
            name="subject_id"
            label={e("subject")}
            numeric
            empty="—"
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
          />
          <TextField
            form={form}
            t={tr}
            type="date"
            name="exam_date"
            label={e("date")}
          />
          <TextField
            form={form}
            t={tr}
            type="time"
            name="starts_at"
            label={e("startsAt")}
          />
          <TextField
            form={form}
            t={tr}
            type="time"
            name="ends_at"
            label={e("endsAt")}
          />
        </>
      )}
    />
  );
}
