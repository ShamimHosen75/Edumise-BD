"use client";

import { TextField } from "@/components/dashboard/content/form-controls";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { pickLocalized } from "@/lib/format";

import { CrudTable } from "./crud-table";
import { translator } from "./labels";

export type GroupRow = {
  id: number;
  code: string;
  name_en: string;
  name_bn: string;
};

export function GroupsManager({
  lang,
  rows,
  messages,
}: {
  lang: Locale;
  rows: GroupRow[];
  messages: Messages;
}) {
  const tr = translator(messages);
  return (
    <CrudTable
      lang={lang}
      entity="groups"
      tr={tr}
      title={tr("academic.groups")}
      item={tr("academic.item.group")}
      rows={rows}
      rowName={(r) => pickLocalized(r, "name", lang)}
      initialSort={{ id: "name" }}
      columns={[
        { id: "code", header: tr("academic.code"), value: (r) => r.code },
        {
          id: "name",
          header: tr("academic.name"),
          value: (r) => pickLocalized(r, "name", lang),
        },
      ]}
      defaults={(r) => ({
        code: r?.code ?? "",
        name_en: r?.name_en ?? "",
        name_bn: r?.name_bn ?? "",
      })}
      fields={(form) => (
        <>
          <TextField
            form={form}
            t={tr}
            name="code"
            label={tr("academic.code")}
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
