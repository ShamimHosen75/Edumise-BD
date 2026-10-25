"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, type FieldValues, type Resolver } from "react-hook-form";
import { toast } from "sonner";

import { deleteStaff, saveStaff } from "@/app/[lang]/dashboard/staff/actions";
import { translator } from "@/components/dashboard/academic/labels";
import {
  CheckboxField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/dashboard/content/form-controls";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { pickLocalized } from "@/lib/format";
import { staffSchema } from "@/lib/validation/staff";

type Designation = { id: number; name_en: string; name_bn: string };

/** Public profile and private details of one member of staff. */
export function StaffForm({
  lang,
  id,
  defaults,
  designations,
  messages,
}: {
  lang: Locale;
  id: number | null;
  defaults: FieldValues;
  designations: Designation[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const router = useRouter();
  const form = useForm<FieldValues>({
    resolver: zodResolver(staffSchema) as unknown as Resolver<FieldValues>,
    defaultValues: defaults,
  });
  const { isSubmitting } = form.formState;
  const f = (key: string) => tr(`staff.fields.${key}`);
  const list = `/${lang}/dashboard/staff`;
  const base = { form, t: tr };

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await saveStaff(lang, id, values).catch(() => ({
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
    toast.success(tr("staff.saved"));
    if (id === null) router.replace(`${list}/${result.id}`);
    else router.refresh();
  });

  const remove = async () => {
    if (id === null) return;
    const name = String(form.getValues("full_name_en"));
    if (!window.confirm(tr("staff.deleteConfirm", { name }))) return;
    const result = await deleteStaff(lang, id).catch(() => ({
      ok: false as const,
      error: "auth.unexpected" as const,
    }));
    if (!result.ok) return void toast.error(tr(result.error));
    router.replace(list);
  };

  const section = "flex flex-col gap-4 rounded-xl border p-4";
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-busy={isSubmitting}
      className="flex max-w-4xl flex-col gap-6"
    >
      <fieldset className={section}>
        <legend className="px-1 font-semibold">{tr("staff.public")}</legend>
        <p className="text-muted-foreground text-xs">
          {tr("staff.publicHint")}
        </p>
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
            name="designation_id"
            label={f("designation")}
            numeric
            empty={f("chooseDesignation")}
            options={designations.map((d) => ({
              value: d.id,
              label: pickLocalized(d, "name", lang),
            }))}
          />
          <TextField
            {...base}
            type="number"
            name="sort_order"
            label={f("sortOrder")}
          />
          <TextField
            {...base}
            name="subject_en"
            label={f("subjectEn")}
            lang="en"
          />
          <TextField
            {...base}
            name="subject_bn"
            label={f("subjectBn")}
            lang="bn"
          />
          <TextField
            {...base}
            name="qualification_en"
            label={f("qualificationEn")}
            lang="en"
          />
          <TextField
            {...base}
            name="qualification_bn"
            label={f("qualificationBn")}
            lang="bn"
          />
          <TextAreaField
            {...base}
            name="bio_en"
            label={f("bioEn")}
            lang="en"
            maxLength={1000}
          />
          <TextAreaField
            {...base}
            name="bio_bn"
            label={f("bioBn")}
            lang="bn"
            maxLength={1000}
          />
          <TextField
            {...base}
            type="date"
            name="joined_on"
            label={f("joinedOn")}
          />
          <TextField
            {...base}
            type="date"
            name="left_on"
            label={f("leftOn")}
            hint={f("leftOnHint")}
          />
        </div>
        <CheckboxField form={form} name="is_public" label={f("isPublic")} />
      </fieldset>

      <fieldset className={section}>
        <legend className="px-1 font-semibold">{tr("staff.private")}</legend>
        <p className="text-muted-foreground text-xs">
          {tr("staff.privateHint")}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField {...base} name="nid" label={f("nid")} />
          <TextField
            {...base}
            type="date"
            name="birth_date"
            label={f("birthDate")}
          />
          <TextField
            {...base}
            name="personal_phone"
            label={f("personalPhone")}
          />
          <TextField {...base} name="email" label={f("email")} />
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
