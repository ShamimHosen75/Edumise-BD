"use client";

import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

import { deleteExam, saveExam } from "@/app/[lang]/dashboard/exams/actions";
import {
  dialogLabels,
  tableLabels,
  translator,
} from "@/components/dashboard/academic/labels";
import { TextField } from "@/components/dashboard/content/form-controls";
import { Button, buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import type { ExamRow } from "@/lib/exams-data";
import { formatDate } from "@/lib/format";
import { examSchema } from "@/lib/validation/marks";

type ClassOption = { id: number; name: string };

/** Tick boxes for the classes that sit the exam (a list of class ids in the form). */
function ClassBoxes({
  form,
  classes,
  label,
  error,
}: {
  form: UseFormReturn<FieldValues>;
  classes: ClassOption[];
  label: string;
  error: string;
}) {
  const value = (form.watch("class_ids") as number[]) ?? [];
  return (
    <fieldset
      className="flex flex-col gap-2"
      aria-describedby="exam-classes-error"
    >
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {classes.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.includes(c.id)}
              onChange={(e) =>
                form.setValue(
                  "class_ids",
                  e.target.checked
                    ? [...value, c.id]
                    : value.filter((v) => v !== c.id),
                  { shouldValidate: form.formState.isSubmitted },
                )
              }
            />
            {c.name}
          </label>
        ))}
      </div>
      {error ? (
        <p id="exam-classes-error" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** Exams of the current session: add, edit, delete, open. */
export function ExamsManager({
  lang,
  rows,
  classes,
  messages,
}: {
  lang: Locale;
  rows: ExamRow[];
  classes: ClassOption[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const e = (key: string, vars?: Record<string, string>) =>
    tr(`exams.${key}`, vars);
  const router = useRouter();
  const [pending, start] = useTransition();
  const base = `/${lang}/dashboard/exams`;
  const date = (v: string | null) => (v ? formatDate(v, lang, "medium") : "—");
  const common = {
    schema: examSchema,
    successMessage: e("saved"),
    translate: (key: string) => tr(key),
    labels: dialogLabels(tr),
    children: (form: UseFormReturn<FieldValues>) => (
      <>
        <TextField
          form={form}
          t={tr}
          name="name_en"
          label={e("nameEn")}
          lang="en"
        />
        <TextField
          form={form}
          t={tr}
          name="name_bn"
          label={e("nameBn")}
          lang="bn"
        />
        <TextField
          form={form}
          t={tr}
          type="date"
          name="starts_on"
          label={e("startsOn")}
        />
        <TextField
          form={form}
          t={tr}
          type="date"
          name="ends_on"
          label={e("endsOn")}
        />
        <ClassBoxes
          form={form}
          classes={classes}
          label={e("classes")}
          error={tr(
            form.formState.errors.class_ids?.message as string | undefined,
          )}
        />
      </>
    ),
  };
  const defaults = (r: ExamRow | null) => ({
    name_en: r?.name_en ?? "",
    name_bn: r?.name_bn ?? "",
    starts_on: r?.starts_on ?? "",
    ends_on: r?.ends_on ?? "",
    class_ids: r?.classIds ?? [],
  });
  const remove = (r: ExamRow) => {
    if (!window.confirm(e("deleteConfirm", { name: r.name }))) return;
    start(async () => {
      const result = await deleteExam(lang, r.id).catch(() => ({
        ok: false as const,
        error: "auth.unexpected" as const,
      }));
      if (!result.ok) return void toast.error(tr(result.error));
      toast.success(e("deleted"));
      router.refresh();
    });
  };

  return (
    <DataTable
      title={e("list")}
      csvName="exams"
      data={rows}
      getRowId={(r) => String(r.id)}
      labels={{ ...tableLabels(tr, lang), empty: e("noExams") }}
      loading={pending}
      toolbar={
        <FormDialog
          {...common}
          title={e("add")}
          defaultValues={defaults(null)}
          onSubmit={(values) => saveExam(lang, null, values)}
          trigger={
            <Button type="button">
              <Plus aria-hidden="true" />
              {e("add")}
            </Button>
          }
        />
      }
      columns={[
        {
          id: "name",
          header: e("name"),
          value: (r) => r.name,
          cell: (r) => (
            <Link
              href={`${base}/${r.id}`}
              className="font-medium hover:underline"
            >
              {r.name}
            </Link>
          ),
        },
        { id: "classes", header: e("classes"), value: (r) => r.classes },
        {
          id: "starts",
          header: e("startsOn"),
          value: (r) => date(r.starts_on),
          sortValue: (r) => r.starts_on ?? "",
        },
        {
          id: "status",
          header: e("status"),
          value: (r) => e(`statuses.${r.status}`),
        },
      ]}
      rowActions={(r) => (
        <>
          <Link
            href={`${base}/${r.id}`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
            aria-label={e("openNamed", { name: r.name })}
          >
            <Eye aria-hidden="true" />
            <span className="hidden sm:inline">{e("open")}</span>
          </Link>
          <FormDialog
            {...common}
            title={e("edit", { name: r.name })}
            defaultValues={defaults(r)}
            onSubmit={(values) => saveExam(lang, r.id, values)}
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={e("edit", { name: r.name })}
              >
                <Pencil aria-hidden="true" />
              </Button>
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            disabled={pending}
            onClick={() => remove(r)}
            aria-label={tr("academic.deleteNamed", { name: r.name })}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </>
      )}
    />
  );
}
