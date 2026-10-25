"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  addAssignment,
  removeAssignment,
} from "@/app/[lang]/dashboard/staff/assignment-actions";
import {
  dialogLabels,
  tableLabels,
  translator,
} from "@/components/dashboard/academic/labels";
import { SelectField } from "@/components/dashboard/content/form-controls";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { assignmentSchema } from "@/lib/validation/staff";

export type AssignmentRow = {
  id: number;
  session: string;
  section: string;
  /** Class level, to sort sections in class order. */
  level: number;
  subject: string;
};
type Option = { id: number; label: string };

/** The subjects a teacher teaches, per section and session. */
export function StaffAssignments({
  lang,
  staffId,
  rows,
  sessions,
  currentSessionId,
  sections,
  subjects,
  messages,
}: {
  lang: Locale;
  staffId: number;
  rows: AssignmentRow[];
  sessions: Option[];
  currentSessionId: number | null;
  /** Each section with the subjects taught in its class. */
  sections: (Option & { subjectIds: number[] })[];
  subjects: Option[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const router = useRouter();
  const [pending, start] = useTransition();
  const name = (r: AssignmentRow) => `${r.subject}, ${r.section}`;

  const remove = (r: AssignmentRow) =>
    start(async () => {
      const result = await removeAssignment(lang, r.id).catch(() => ({
        ok: false as const,
        error: "auth.unexpected" as const,
      }));
      if (!result.ok) return void toast.error(tr(result.error));
      toast.success(tr("staff.done"));
      router.refresh();
    });

  return (
    <section
      aria-labelledby="assignments-title"
      className="flex max-w-4xl flex-col gap-3 rounded-xl border p-4"
    >
      <div>
        <h2 id="assignments-title" className="font-semibold">
          {tr("staff.assignments")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {tr("staff.assignmentsIntro")}
        </p>
      </div>
      <DataTable
        title={tr("staff.assignments")}
        csvName="teaching"
        data={rows}
        getRowId={(r) => String(r.id)}
        labels={{ ...tableLabels(tr, lang), empty: tr("staff.noAssignments") }}
        initialSort={{ id: "section" }}
        columns={[
          {
            id: "session",
            header: tr("staff.session"),
            value: (r) => r.session,
            filter: sessions.map((s) => ({ value: s.label, label: s.label })),
          },
          {
            id: "section",
            header: tr("staff.section"),
            value: (r) => r.section,
            sortValue: (r) => r.level,
          },
          {
            id: "subject",
            header: tr("staff.subject"),
            value: (r) => r.subject,
          },
        ]}
        rowActions={(r) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            disabled={pending}
            aria-label={tr("staff.removeNamed", { name: name(r) })}
            onClick={() => remove(r)}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        )}
        toolbar={
          <FormDialog
            title={tr("staff.addAssignment")}
            schema={assignmentSchema}
            defaultValues={{
              session_id: currentSessionId,
              section_id: null,
              subject_id: null,
            }}
            onSubmit={(values) => addAssignment(lang, staffId, values)}
            successMessage={tr("staff.saved")}
            translate={(key) => tr(key)}
            labels={dialogLabels(tr)}
            trigger={
              <Button type="button">
                <Plus aria-hidden="true" />
                {tr("staff.addAssignment")}
              </Button>
            }
          >
            {(form) => {
              const section = sections.find(
                (s) => s.id === form.watch("section_id"),
              );
              const taught = section
                ? subjects.filter((s) => section.subjectIds.includes(s.id))
                : subjects;
              const select = (
                name: string,
                label: string,
                options: Option[],
                empty?: string,
              ) => (
                <SelectField
                  form={form}
                  t={tr}
                  name={name}
                  label={label}
                  numeric
                  empty={empty}
                  options={options.map((o) => ({
                    value: o.id,
                    label: o.label,
                  }))}
                />
              );
              return (
                <>
                  {select("session_id", tr("staff.session"), sessions)}
                  {select(
                    "section_id",
                    tr("staff.section"),
                    sections,
                    tr("staff.chooseSection"),
                  )}
                  {select(
                    "subject_id",
                    tr("staff.subject"),
                    taught,
                    tr("staff.chooseSubject"),
                  )}
                </>
              );
            }}
          </FormDialog>
        }
      />
    </section>
  );
}
