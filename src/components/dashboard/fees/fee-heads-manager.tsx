"use client";

import {
  deleteFeeHead,
  saveFeeHead,
} from "@/app/[lang]/dashboard/fees/actions";
import { CrudTable } from "@/components/dashboard/academic/crud-table";
import { translator } from "@/components/dashboard/academic/labels";
import {
  SelectField,
  TextField,
} from "@/components/dashboard/content/form-controls";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { FEE_FREQUENCIES } from "@/lib/fees";
import type { FeeHeadRow } from "@/lib/fees-data";
import { localizeDigits, pickLocalized } from "@/lib/format";
import { feeHeadSchema } from "@/lib/validation/fees";

export function FeeHeadsManager({
  lang,
  rows,
  messages,
}: {
  lang: Locale;
  rows: FeeHeadRow[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const h = (key: string) => tr(`fees.heads.${key}`);
  return (
    <CrudTable
      lang={lang}
      entity="fee-heads"
      tr={tr}
      title={h("title")}
      item={h("item")}
      rows={rows}
      schema={feeHeadSchema}
      actions={{
        save: (id, values) => saveFeeHead(lang, id, values),
        remove: (id) => deleteFeeHead(lang, id),
      }}
      rowName={(r) => pickLocalized(r, "name", lang)}
      initialSort={{ id: "order" }}
      columns={[
        {
          id: "order",
          header: h("sortOrder"),
          value: (r) => r.sort_order,
          cell: (r) => localizeDigits(r.sort_order, lang),
        },
        { id: "code", header: h("code"), value: (r) => r.code },
        {
          id: "name",
          header: h("name"),
          value: (r) => pickLocalized(r, "name", lang),
        },
        {
          id: "frequency",
          header: h("frequency"),
          value: (r) => h(`frequencies.${r.frequency}`),
        },
      ]}
      defaults={(r) => ({
        code: r?.code ?? "",
        name_en: r?.name_en ?? "",
        name_bn: r?.name_bn ?? "",
        frequency: r?.frequency ?? "one_time",
        sort_order:
          r?.sort_order ??
          (rows.length ? Math.max(...rows.map((x) => x.sort_order)) + 1 : 1),
      })}
      fields={(form) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField form={form} t={tr} name="code" label={h("code")} />
            <TextField
              form={form}
              t={tr}
              type="number"
              name="sort_order"
              label={h("sortOrder")}
            />
          </div>
          <TextField
            form={form}
            t={tr}
            name="name_en"
            label={h("nameEn")}
            lang="en"
          />
          <TextField
            form={form}
            t={tr}
            name="name_bn"
            label={h("nameBn")}
            lang="bn"
          />
          <SelectField
            form={form}
            t={tr}
            name="frequency"
            label={h("frequency")}
            options={FEE_FREQUENCIES.map((f) => ({
              value: f,
              label: h(`frequencies.${f}`),
            }))}
          />
        </>
      )}
    />
  );
}
