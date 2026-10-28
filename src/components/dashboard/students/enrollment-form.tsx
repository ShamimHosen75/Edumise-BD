"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, type FieldValues, type Resolver } from "react-hook-form";
import { toast } from "sonner";

import { saveEnrollment } from "@/app/[lang]/dashboard/students/actions";
import { translator } from "@/components/dashboard/academic/labels";
import {
  SelectField,
  TextField,
} from "@/components/dashboard/content/form-controls";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import type { SectionOption } from "@/lib/students-data";
import { enrollmentSchema } from "@/lib/validation/student";

/** Enrol in a session or change the section, roll and group there. */
export function EnrollmentForm({
  lang,
  studentId,
  defaults,
  sessions,
  sections,
  groups,
  fourthSubjects,
  messages,
}: {
  lang: Locale;
  studentId: number;
  defaults: FieldValues;
  sessions: { id: number; name: string }[];
  sections: SectionOption[];
  groups: { id: number; name: string }[];
  fourthSubjects: { id: number; name: string }[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const p = (key: string) => tr(`studentProfile.${key}`);
  const router = useRouter();
  const form = useForm<FieldValues>({
    resolver: zodResolver(enrollmentSchema) as unknown as Resolver<FieldValues>,
    defaultValues: defaults,
  });
  const base = { form, t: tr };
  const { isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await saveEnrollment(lang, studentId, values).catch(() => ({
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
    router.refresh();
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-busy={isSubmitting}
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <SelectField
        {...base}
        id="enrol-session"
        name="session_id"
        label={p("session")}
        numeric
        options={sessions.map((s) => ({ value: s.id, label: s.name }))}
      />
      <SelectField
        {...base}
        id="enrol-section"
        name="section_id"
        label={p("section")}
        numeric
        empty="—"
        options={sections.map((s) => ({ value: s.id, label: s.name }))}
      />
      <TextField
        {...base}
        id="enrol-roll"
        type="number"
        name="roll"
        label={p("roll")}
      />
      <SelectField
        {...base}
        id="enrol-group"
        name="group_id"
        label={p("group")}
        numeric
        empty={p("noGroup")}
        options={groups.map((g) => ({ value: g.id, label: g.name }))}
      />
      <SelectField
        {...base}
        id="enrol-fourth"
        name="fourth_subject_id"
        label={p("fourthSubject")}
        hint={p("fourthSubjectHint")}
        numeric
        empty={p("noFourthSubject")}
        options={fourthSubjects.map((s) => ({ value: s.id, label: s.name }))}
      />
      <Button type="submit" className="w-fit" disabled={isSubmitting}>
        {isSubmitting ? tr("dialog.saving") : p("saveEnrollment")}
      </Button>
    </form>
  );
}
