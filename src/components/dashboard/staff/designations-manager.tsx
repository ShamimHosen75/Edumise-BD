"use client";

import { CrudTable } from "@/components/dashboard/academic/crud-table";
import { translator } from "@/components/dashboard/academic/labels";
import {
  CheckboxField,
  TextField,
} from "@/components/dashboard/content/form-controls";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { localizeDigits, pickLocalized } from "@/lib/format";

export type DesignationRow = {
  id: number;
  rank: number;
  name_en: string;
  name_bn: string;
  is_teaching: boolean;
};

export function DesignationsManager({
  lang,
  rows,
  messages,
}: {
  lang: Locale;
  rows: DesignationRow[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const kind = (r: DesignationRow) =>
    r.is_teaching ? tr("staff.teachingYes") : tr("staff.teachingNo");
  return (
    <CrudTable
      lang={lang}
      entity="designations"
      tr={tr}
      title={tr("staff.designations")}
      item={tr("staff.item")}
      rows={rows}
      rowName={(r) => pickLocalized(r, "name", lang)}
      initialSort={{ id: "rank" }}
      columns={[
        {
          id: "rank",
          header: tr("staff.rank"),
          value: (r) => r.rank,
          cell: (r) => localizeDigits(r.rank, lang),
        },
        {
          id: "name",
          header: tr("staff.name"),
          value: (r) => pickLocalized(r, "name", lang),
        },
        {
          id: "teaching",
          header: tr("staff.teaching"),
          value: kind,
          filter: [tr("staff.teachingYes"), tr("staff.teachingNo")].map(
            (v) => ({
              value: v,
              label: v,
            }),
          ),
        },
      ]}
      defaults={(r) => ({
        rank:
          r?.rank ??
          (rows.length ? Math.max(...rows.map((x) => x.rank)) + 1 : 1),
        name_en: r?.name_en ?? "",
        name_bn: r?.name_bn ?? "",
        is_teaching: r?.is_teaching ?? true,
      })}
      fields={(form) => (
        <>
          <TextField
            form={form}
            t={tr}
            type="number"
            name="rank"
            label={tr("staff.rank")}
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
          <CheckboxField
            form={form}
            name="is_teaching"
            label={tr("staff.teaching")}
          />
        </>
      )}
    />
  );
}
