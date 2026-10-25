"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, type FieldValues, type Resolver } from "react-hook-form";
import { toast } from "sonner";

import {
  deleteStudent,
  saveStudent,
} from "@/app/[lang]/dashboard/students/actions";
import { translator } from "@/components/dashboard/academic/labels";
import {
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/dashboard/content/form-controls";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import type { SectionOption } from "@/lib/students-data";
import { BLOOD_GROUPS, GENDERS, RELIGIONS } from "@/lib/validation/admission";
import {
  newStudentSchema,
  STUDENT_STATUSES,
  studentSchema,
} from "@/lib/validation/student";

/** A student's own record. A new student also gets a section in the current session. */
export function StudentForm({
  lang,
  id,
  defaults,
  sections,
  groups,
  messages,
}: {
  lang: Locale;
  id: number | null;
  defaults: FieldValues;
  sections: SectionOption[];
  groups: { id: number; name: string }[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const router = useRouter();
  const schema = id === null ? newStudentSchema : studentSchema;
  const form = useForm<FieldValues>({
    resolver: zodResolver(schema) as unknown as Resolver<FieldValues>,
    defaultValues:
      id === null
        ? { ...defaults, section_id: null, roll: "", group_id: null }
        : defaults,
  });
  const { isSubmitting } = form.formState;
  const f = (key: string) => tr(`studentProfile.fields.${key}`);
  const p = (key: string) => tr(`studentProfile.${key}`);
  const list = `/${lang}/dashboard/students`;
  const base = { form, t: tr };
  const options = (values: readonly string[], prefix?: string) =>
    values.map((v) => ({ value: v, label: prefix ? tr(`${prefix}.${v}`) : v }));

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await saveStudent(lang, id, values).catch(() => ({
      ok: false as const,
      error: "auth.unexpected" as const,
      fieldErrors: undefined,
    }));
    if (!result.ok) {
      for (const [field, key] of Object.entries(result.fieldErrors ?? {}))
        form.setError(field, { message: key });
      toast.error(tr(result.error));
      return;
    }
    toast.success(p("saved"));
    if (id === null) router.replace(`${list}/${result.id}`);
    else router.refresh();
  });

  const remove = async () => {
    if (id === null) return;
    const name = String(form.getValues("full_name_en"));
    if (!window.confirm(tr("studentProfile.deleteConfirm", { name }))) return;
    const result = await deleteStudent(lang, id).catch(() => ({
      ok: false as const,
      error: "auth.unexpected" as const,
    }));
    if (!result.ok) return void toast.error(tr(result.error));
    router.replace(list);
  };

  const box = "flex flex-col gap-4 rounded-xl border p-4";
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-busy={isSubmitting}
      className="flex max-w-4xl flex-col gap-6"
    >
      <fieldset className={box}>
        <legend className="px-1 font-semibold">{p("details")}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            {...base}
            name="full_name_en"
            label={f("nameEn")}
            lang="en"
          />
          <TextField
            {...base}
            name="full_name_bn"
            label={f("nameBn")}
            lang="bn"
          />
          <SelectField
            {...base}
            name="gender"
            label={f("gender")}
            empty="—"
            options={options(GENDERS, "admission.genders")}
          />
          <SelectField
            {...base}
            name="status"
            label={f("status")}
            options={options(STUDENT_STATUSES, "students.statuses")}
          />
          <SelectField
            {...base}
            name="religion"
            label={f("religion")}
            empty="—"
            options={options(RELIGIONS, "admission.religions")}
          />
          <SelectField
            {...base}
            name="blood_group"
            label={f("bloodGroup")}
            empty="—"
            options={options(BLOOD_GROUPS)}
          />
          <TextField
            {...base}
            type="date"
            name="admitted_on"
            label={f("admittedOn")}
          />
        </div>
      </fieldset>

      {id === null ? (
        <fieldset className={box}>
          <legend className="px-1 font-semibold">{p("enrollment")}</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              {...base}
              name="section_id"
              label={p("section")}
              numeric
              empty="—"
              options={sections.map((s) => ({ value: s.id, label: s.name }))}
            />
            <TextField
              {...base}
              type="number"
              name="roll"
              label={p("roll")}
              hint={p("rollHint")}
            />
            <SelectField
              {...base}
              name="group_id"
              label={p("group")}
              numeric
              empty={p("noGroup")}
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
            />
          </div>
        </fieldset>
      ) : null}

      <fieldset className={box}>
        <legend className="px-1 font-semibold">{p("private")}</legend>
        <p className="text-muted-foreground text-xs">{p("privateHint")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            {...base}
            type="date"
            name="birth_date"
            label={f("birthDate")}
          />
          <TextField {...base} name="birth_reg_no" label={f("birthRegNo")} />
          <TextField
            {...base}
            name="personal_phone"
            label={f("personalPhone")}
          />
        </div>
        <TextAreaField
          {...base}
          name="address"
          label={f("address")}
          rows={2}
          maxLength={300}
        />
      </fieldset>

      <div className="bg-background sticky bottom-0 flex flex-wrap items-center gap-3 border-t py-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? tr("dialog.saving") : tr("dialog.save")}
        </Button>
        <Button asChild variant="outline">
          <Link href={list}>{tr("contentAdmin.backToList")}</Link>
        </Button>
        {id !== null ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            onClick={remove}
          >
            {tr("contentAdmin.delete")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
