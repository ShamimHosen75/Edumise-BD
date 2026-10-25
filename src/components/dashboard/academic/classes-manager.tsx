"use client";

import { TextField } from "@/components/dashboard/content/form-controls";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { localizeDigits, pickLocalized } from "@/lib/format";

import { CrudTable } from "./crud-table";
import { translator } from "./labels";

export type ClassRow = {
  id: number;
  level: number;
  name_en: string;
  name_bn: string;
  sections: number;
};

export function ClassesManager({
  lang,
  rows,
  messages,
}: {
  lang: Locale;
  rows: ClassRow[];
  messages: Messages;
}) {
  const tr = translator(messages);
  return (
    <CrudTable
      lang={lang}
      entity="classes"
      tr={tr}
      title={tr("academic.classes")}
      item={tr("academic.item.class")}
      rows={rows}
      rowName={(r) => pickLocalized(r, "name", lang)}
      initialSort={{ id: "level" }}
      columns={[
        {
          id: "level",
          header: tr("academic.level"),
          value: (r) => r.level,
          cell: (r) => localizeDigits(r.level, lang),
        },
        {
          id: "name",
          header: tr("academic.name"),
          value: (r) => pickLocalized(r, "name", lang),
        },
        {
          id: "sections",
          header: tr("academic.sections"),
          value: (r) => r.sections,
          cell: (r) => localizeDigits(r.sections, lang),
        },
      ]}
      defaults={(r) => ({
        level: r?.level ?? "",
        name_en: r?.name_en ?? "",
        name_bn: r?.name_bn ?? "",
      })}
      fields={(form) => (
        <>
          <TextField
            form={form}
            t={tr}
            type="number"
            name="level"
            label={tr("academic.level")}
          />
          <TextField
            form={form}
            t={tr}
            name="name_en"
            label={tr("academic.nameEn")}
            lang="en"
          />
          <TextField
            form={form}
            t={tr}
            name="name_bn"
            label={tr("academic.nameBn")}
            lang="bn"
          />
        </>
      )}
    />
  );
}
