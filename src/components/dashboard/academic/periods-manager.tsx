"use client";

import {
  CheckboxField,
  TextField,
} from "@/components/dashboard/content/form-controls";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { localizeDigits } from "@/lib/format";
import { hhmm } from "@/lib/routine";

import { CrudTable } from "./crud-table";
import { translator } from "./labels";
import { WorkingDaysForm } from "./working-days-form";

export type PeriodRow = {
  id: number;
  number: number;
  starts_at: string;
  ends_at: string;
  is_break: boolean;
};

/** Class periods with times and break flag, and the school's working days. */
export function PeriodsManager({
  lang,
  rows,
  workingDays,
  messages,
}: {
  lang: Locale;
  rows: PeriodRow[];
  workingDays: number[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const a = (key: string) => tr(`academic.${key}`);
  const time = (v: string) => localizeDigits(hhmm(v), lang);
  return (
    <div className="flex flex-col gap-6">
      <WorkingDaysForm lang={lang} value={workingDays} messages={messages} />
      <CrudTable
        lang={lang}
        entity="periods"
        tr={tr}
        title={a("periods")}
        item={a("item.period")}
        rows={rows}
        rowName={(r) =>
          `${a("periodNumber")} ${localizeDigits(r.number, lang)}`
        }
        initialSort={{ id: "number" }}
        columns={[
          {
            id: "number",
            header: a("periodNumber"),
            value: (r) => r.number,
            cell: (r) => localizeDigits(r.number, lang),
          },
          {
            id: "starts",
            header: a("startsAt"),
            value: (r) => time(r.starts_at),
          },
          { id: "ends", header: a("endsAt"), value: (r) => time(r.ends_at) },
          {
            id: "break",
            header: a("breakYes"),
            value: (r) => (r.is_break ? a("breakYes") : ""),
            cell: (r) => (r.is_break ? a("breakYes") : "—"),
          },
        ]}
        defaults={(r) => ({
          number: r ? String(r.number) : String(rows.length + 1),
          starts_at: r ? hhmm(r.starts_at) : "",
          ends_at: r ? hhmm(r.ends_at) : "",
          is_break: r?.is_break ?? false,
        })}
        fields={(form) => (
          <>
            <TextField
              form={form}
              t={tr}
              type="number"
              name="number"
              label={a("periodNumber")}
            />
            <TextField
              form={form}
              t={tr}
              type="time"
              name="starts_at"
              label={a("startsAt")}
            />
            <TextField
              form={form}
              t={tr}
              type="time"
              name="ends_at"
              label={a("endsAt")}
            />
            <CheckboxField form={form} name="is_break" label={a("isBreak")} />
          </>
        )}
      />
    </div>
  );
}
