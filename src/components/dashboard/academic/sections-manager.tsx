"use client";

import {
  SelectField,
  TextField,
} from "@/components/dashboard/content/form-controls";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { localizeDigits, pickLocalized } from "@/lib/format";

import { CrudTable } from "./crud-table";
import { translator } from "./labels";

type Named = { id: number; name_en: string; name_bn: string };
export type SectionRow = Named & {
  class_id: number;
  class_name_en: string;
  class_name_bn: string;
  class_level: number;
  capacity: number | null;
  class_teacher_id: number | null;
  teacher_en: string | null;
  teacher_bn: string | null;
};

export function SectionsManager({
  lang,
  rows,
  classes,
  teachers,
  messages,
}: {
  lang: Locale;
  rows: SectionRow[];
  classes: (Named & { level: number })[];
  teachers: Named[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const className = (r: SectionRow) =>
    pickLocalized(
      { name_en: r.class_name_en, name_bn: r.class_name_bn },
      "name",
      lang,
    );
  const teacher = (r: SectionRow) =>
    r.teacher_en
      ? pickLocalized(
          { name_en: r.teacher_en, name_bn: r.teacher_bn },
          "name",
          lang,
        )
      : "";
  const sectionName = (r: SectionRow) =>
    `${className(r)} ${pickLocalized(r, "name", lang)}`;

  return (
    <CrudTable
      lang={lang}
      entity="sections"
      tr={tr}
      title={tr("academic.sections")}
      item={tr("academic.item.section")}
      rows={rows}
      rowName={sectionName}
      initialSort={{ id: "class" }}
      columns={[
        {
          id: "class",
          header: tr("academic.class"),
          // Sort by level, show the name.
          value: (r) => r.class_level,
          cell: className,
          // Only classes that have sections (an empty value would mean "All").
          filter: classes
            .filter((c) => rows.some((r) => r.class_id === c.id))
            .map((c) => ({
              value: String(rows.find((r) => r.class_id === c.id)!.class_level),
              label: pickLocalized(c, "name", lang),
            })),
        },
        {
          id: "name",
          header: tr("academic.name"),
          value: (r) => pickLocalized(r, "name", lang),
        },
        {
          id: "capacity",
          header: tr("academic.capacity"),
          value: (r) => r.capacity,
          cell: (r) =>
            r.capacity === null ? "—" : localizeDigits(r.capacity, lang),
        },
        {
          id: "teacher",
          header: tr("academic.classTeacher"),
          value: teacher,
          cell: (r) => teacher(r) || tr("academic.noTeacher"),
        },
      ]}
      defaults={(r) => ({
        class_id: r?.class_id ?? null,
        name_en: r?.name_en ?? "",
        name_bn: r?.name_bn ?? "",
        capacity: r?.capacity ?? "",
        class_teacher_id: r?.class_teacher_id ?? null,
      })}
      fields={(form) => (
        <>
          <SelectField
            form={form}
            t={tr}
            name="class_id"
            label={tr("academic.class")}
            numeric
            empty={tr("academic.chooseClass")}
            options={classes.map((c) => ({
              value: c.id,
              label: pickLocalized(c, "name", lang),
            }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>
          <TextField
            form={form}
            t={tr}
            type="number"
            name="capacity"
            label={tr("academic.capacity")}
            hint={tr("academic.capacityHint")}
          />
          <SelectField
            form={form}
            t={tr}
            name="class_teacher_id"
            label={tr("academic.classTeacher")}
            numeric
            empty={tr("academic.noTeacher")}
            options={teachers.map((s) => ({
              value: s.id,
              label: pickLocalized(s, "name", lang),
            }))}
          />
        </>
      )}
    />
  );
}
