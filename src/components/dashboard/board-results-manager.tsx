"use client";

import { CrudTable } from "@/components/dashboard/academic/crud-table";
import { translator } from "@/components/dashboard/academic/labels";
import {
  SelectField,
  TextField,
} from "@/components/dashboard/content/form-controls";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { formatNumber, localizeDigits } from "@/lib/format";
import { passRate } from "@/lib/site/chart";

export type BoardResultRow = {
  id: number;
  exam: "ssc" | "jsc";
  year: number;
  examinees: number;
  passed: number;
  gpa5: number;
};

/** Board exam results by year, shown on the public board results page. */
export function BoardResultsManager({
  lang,
  rows,
  messages,
}: {
  lang: Locale;
  rows: BoardResultRow[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const b = (key: string) => tr(`boardResults.${key}`);
  const n = (v: number) => localizeDigits(v, lang);
  return (
    <CrudTable
      lang={lang}
      entity="board-results"
      tr={tr}
      title={b("admin")}
      item={b("item")}
      rows={rows}
      rowName={(r) => `${b(`exams.${r.exam}`)} ${n(r.year)}`}
      initialSort={{ id: "year", desc: true }}
      columns={[
        {
          id: "year",
          header: b("year"),
          value: (r) => r.year,
          cell: (r) => n(r.year),
        },
        { id: "exam", header: b("exam"), value: (r) => b(`exams.${r.exam}`) },
        {
          id: "examinees",
          header: b("examinees"),
          value: (r) => r.examinees,
          cell: (r) => n(r.examinees),
        },
        {
          id: "passed",
          header: b("passed"),
          value: (r) => r.passed,
          cell: (r) => n(r.passed),
        },
        {
          id: "rate",
          header: b("passRate"),
          value: (r) => passRate(r.passed, r.examinees),
          cell: (r) =>
            `${formatNumber(passRate(r.passed, r.examinees), lang)}%`,
        },
        {
          id: "gpa5",
          header: b("gpa5"),
          value: (r) => r.gpa5,
          cell: (r) => n(r.gpa5),
        },
      ]}
      defaults={(r) => ({
        exam: r?.exam ?? "ssc",
        year: r?.year ?? new Date().getFullYear(),
        examinees: r?.examinees ?? "",
        passed: r?.passed ?? "",
        gpa5: r?.gpa5 ?? 0,
      })}
      fields={(form) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              form={form}
              t={tr}
              name="exam"
              label={b("exam")}
              options={(["ssc", "jsc"] as const).map((e) => ({
                value: e,
                label: b(`exams.${e}`),
              }))}
            />
            <TextField
              form={form}
              t={tr}
              type="number"
              name="year"
              label={b("year")}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              form={form}
              t={tr}
              type="number"
              name="examinees"
              label={b("examinees")}
            />
            <TextField
              form={form}
              t={tr}
              type="number"
              name="passed"
              label={b("passed")}
            />
            <TextField
              form={form}
              t={tr}
              type="number"
              name="gpa5"
              label={b("gpa5")}
            />
          </div>
        </>
      )}
    />
  );
}
