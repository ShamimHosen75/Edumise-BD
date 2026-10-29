"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

import {
  deleteAcademic,
  saveAcademic,
} from "@/app/[lang]/dashboard/academic/actions";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import type { Locale } from "@/i18n/config";
import { ACADEMIC, type AcademicEntity } from "@/lib/academic";

import { dialogLabels, tableLabels, type Translate } from "./labels";

type Result =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

type Props<T extends { id: number }> = {
  lang: Locale;
  /** An academic list, or any list with its own `actions` and `schema`. */
  entity: AcademicEntity | string;
  tr: Translate;
  title: string;
  /** "session", "class", ... (for "Add session"). */
  item: string;
  rows: T[];
  columns: DataTableColumn<T>[];
  /** Name shown in "Edit: …" and delete messages. */
  rowName: (row: T) => string;
  /** Form values for a new row (null) or an existing one. */
  defaults: (row: T | null) => FieldValues;
  fields: (form: UseFormReturn<FieldValues>) => React.ReactNode;
  extraActions?: (row: T) => React.ReactNode;
  initialSort?: { id: string; desc?: boolean };
  /** Server actions for lists outside the academic setup (e.g. fees, other roles). */
  actions?: {
    save: (id: number | null, values: FieldValues) => Promise<Result>;
    remove: (id: number) => Promise<Result>;
  };
  schema?: Parameters<typeof FormDialog>[0]["schema"];
  /** Send the form values as typed (see FormDialog). */
  submitRaw?: boolean;
};

/** A DataTable with add / edit dialogs and delete for one academic list. */
export function CrudTable<T extends { id: number }>(props: Props<T>) {
  const { lang, entity, tr, item, rowName } = props;
  const router = useRouter();
  const [pending, start] = useTransition();
  const schema = props.schema ?? ACADEMIC[entity as AcademicEntity].schema;
  const save = (id: number | null, values: FieldValues) =>
    props.actions
      ? props.actions.save(id, values)
      : saveAcademic(lang, entity, id, values);
  const removeRow = (id: number) =>
    props.actions ? props.actions.remove(id) : deleteAcademic(lang, entity, id);
  const common = {
    schema,
    successMessage: tr("academic.saved"),
    translate: (key: string) => tr(key),
    labels: dialogLabels(tr),
    children: props.fields,
    submitRaw: props.submitRaw,
  };

  const remove = (row: T) => {
    if (!window.confirm(tr("academic.deleteConfirm", { name: rowName(row) })))
      return;
    start(async () => {
      const result = await removeRow(row.id).catch(() => ({
        ok: false as const,
        error: "auth.unexpected" as const,
      }));
      if (!result.ok) {
        toast.error(tr(result.error));
        return;
      }
      toast.success(tr("academic.deleted"));
      router.refresh();
    });
  };

  return (
    <DataTable
      title={props.title}
      csvName={entity}
      data={props.rows}
      columns={props.columns}
      getRowId={(row) => String(row.id)}
      labels={tableLabels(tr, lang)}
      initialSort={props.initialSort}
      toolbar={
        <FormDialog
          {...common}
          title={tr("academic.add", { item })}
          defaultValues={props.defaults(null)}
          onSubmit={(values) => save(null, values)}
          trigger={
            <Button type="button">
              <Plus aria-hidden="true" />
              {tr("academic.add", { item })}
            </Button>
          }
        />
      }
      rowActions={(row) => (
        <>
          <FormDialog
            {...common}
            title={tr("academic.editNamed", { name: rowName(row) })}
            defaultValues={props.defaults(row)}
            onSubmit={(values) => save(row.id, values)}
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={tr("academic.editNamed", { name: rowName(row) })}
              >
                <Pencil aria-hidden="true" />
                <span className="hidden sm:inline">
                  {tr("contentAdmin.edit")}
                </span>
              </Button>
            }
          />
          {props.extraActions?.(row)}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            disabled={pending}
            onClick={() => remove(row)}
            aria-label={tr("academic.deleteNamed", { name: rowName(row) })}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </>
      )}
    />
  );
}
