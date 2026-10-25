"use client";

import {
  SelectField,
  TextField,
} from "@/components/dashboard/content/form-controls";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { localizeDigits, pickLocalized } from "@/lib/format";
import { SUBJECT_TYPES } from "@/lib/validation/academic";

import { CrudTable } from "./crud-table";
import { translator } from "./labels";

export type SubjectRow = {
  id: number;
  code: string;
  name_en: string;
  name_bn: string;
  type: (typeof SUBJECT_TYPES)[number];
  sort_order: number;
};

export function SubjectsManager({
  lang,
  rows,
  messages,
}: {
  lang: Locale;
  rows: SubjectRow[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const type = (r: SubjectRow) => tr(`academic.types.${r.type}`);
  return (
    <CrudTable
      lang={lang}
      entity="subjects"
      tr={tr}
      title={tr("academic.subjects")}
      item={tr("academic.item.subject")}
      rows={rows}
      rowName={(r) => pickLocalized(r, "name", lang)}
      initialSort={{ id: "order" }}
      columns={[
        {
          id: "order",
          header: tr("academic.sortOrder"),
          value: (r) => r.sort_order,
          cell: (r) => localizeDigits(r.sort_order, lang),
        },
        { id: "code", header: tr("academic.code"), value: (r) => r.code },
        {
          id: "name",
          header: tr("academic.name"),
          value: (r) => pickLocalized(r, "name", lang),
        },
        {
          id: "type",
          header: tr("academic.type"),
          value: type,
          filter: SUBJECT_TYPES.map((t) => ({
            value: tr(`academic.types.${t}`),
            label: tr(`academic.types.${t}`),
          })),
        },
      ]}
      defaults={(r) => ({
        code: r?.code ?? "",
        name_en: r?.name_en ?? "",
        name_bn: r?.name_bn ?? "",
        type: r?.type ?? "compulsory",
        sort_order:
          r?.sort_order ??
          (rows.length ? Math.max(...rows.map((x) => x.sort_order)) + 1 : 1),
      })}
      fields={(form) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              form={form}
              t={tr}
              name="code"
              label={tr("academic.code")}
            />
            <TextField
              form={form}
              t={tr}
              type="number"
              name="sort_order"
              label={tr("academic.sortOrder")}
            />
          </div>
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
          <SelectField
            form={form}
            t={tr}
            name="type"
            label={tr("academic.type")}
            options={SUBJECT_TYPES.map((t) => ({
              value: t,
              label: tr(`academic.types.${t}`),
            }))}
          />
        </>
      )}
    />
  );
}
