"use client";

import { TextField } from "@/components/dashboard/content/form-controls";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { formatDate, pickLocalized } from "@/lib/format";

import { CrudTable } from "./crud-table";
import { translator } from "./labels";

export type HolidayRow = {
  id: number;
  title_en: string;
  title_bn: string;
  starts_on: string;
  ends_on: string;
};

export function HolidaysManager({
  lang,
  rows,
  messages,
}: {
  lang: Locale;
  rows: HolidayRow[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const a = (key: string) => tr(`academic.${key}`);
  const title = (r: HolidayRow) => pickLocalized(r, "title", lang);
  return (
    <CrudTable
      lang={lang}
      entity="holidays"
      tr={tr}
      title={a("holidays")}
      item={a("item.holiday")}
      rows={rows}
      rowName={title}
      initialSort={{ id: "from", desc: true }}
      columns={[
        {
          id: "title",
          header: a("holidayTitle"),
          value: title,
        },
        {
          id: "from",
          header: a("from"),
          value: (r) => formatDate(r.starts_on, lang),
          sortValue: (r) => r.starts_on,
        },
        {
          id: "to",
          header: a("to"),
          value: (r) => formatDate(r.ends_on, lang),
          sortValue: (r) => r.ends_on,
        },
      ]}
      defaults={(r) => ({
        title_en: r?.title_en ?? "",
        title_bn: r?.title_bn ?? "",
        starts_on: r?.starts_on ?? "",
        ends_on: r?.ends_on ?? "",
      })}
      fields={(form) => (
        <>
          <TextField
            form={form}
            t={tr}
            name="title_en"
            label={a("titleEn")}
            lang="en"
          />
          <TextField
            form={form}
            t={tr}
            name="title_bn"
            label={a("titleBn")}
            lang="bn"
          />
          <TextField
            form={form}
            t={tr}
            type="date"
            name="starts_on"
            label={a("from")}
          />
          <TextField
            form={form}
            t={tr}
            type="date"
            name="ends_on"
            label={a("to")}
          />
        </>
      )}
    />
  );
}
