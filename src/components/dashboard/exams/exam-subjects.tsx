"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { addClassSubjects } from "@/app/[lang]/dashboard/exams/actions";
import { CrudTable } from "@/components/dashboard/academic/crud-table";
import { translator } from "@/components/dashboard/academic/labels";
import {
  CheckboxField,
  SelectField,
  TextField,
} from "@/components/dashboard/content/form-controls";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import type { ExamSubjectRow } from "@/lib/exams-data";
import { localizeDigits } from "@/lib/format";

type Option = { id: number; name: string };

/** Subjects of one class in the exam, with full and pass marks per part. */
export function ExamSubjects({
  lang,
  examId,
  cls,
  rows,
  subjects,
  messages,
}: {
  lang: Locale;
  examId: number;
  cls: Option;
  rows: ExamSubjectRow[];
  /** Subjects taught in this class. */
  subjects: Option[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const e = (key: string, vars?: Record<string, string>) =>
    tr(`exams.${key}`, vars);
  const n = (v: number | null) => (v === null ? "—" : localizeDigits(v, lang));
  const router = useRouter();
  const [pending, start] = useTransition();
  const addAll = () =>
    start(async () => {
      const result = await addClassSubjects(lang, examId, cls.id).catch(() => ({
        ok: false as const,
        error: "auth.unexpected" as const,
      }));
      if (!result.ok) return void toast.error(tr(result.error));
      toast.success(e("added", { count: n(result.count) }));
      router.refresh();
    });
  const part = (full: number, pass: number | null) =>
    full ? `${n(full)} / ${n(pass)}` : "—";

  return (
    <section className="flex flex-col gap-3" aria-label={cls.name}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{cls.name}</h2>
        <Button
          type="button"
          variant="outline"
          onClick={addAll}
          disabled={pending}
        >
          <Plus aria-hidden="true" />
          {e("addClassSubjects", { class: cls.name })}
        </Button>
      </div>
      <CrudTable
        lang={lang}
        entity="exam-subjects"
        tr={tr}
        title={`${cls.name}: ${e("subjects")}`}
        item={e("itemSubject")}
        rows={rows}
        rowName={(r) =>
          e("subjectName", { class: cls.name, subject: r.subject })
        }
        initialSort={{ id: "subject" }}
        columns={[
          {
            id: "subject",
            header: e("subject"),
            value: (r) => r.subject,
            sortValue: (r) => r.sortOrder,
          },
          {
            id: "cq",
            header: e("cqFull"),
            value: (r) => part(r.cq_full, r.cq_pass),
          },
          {
            id: "mcq",
            header: e("mcqFull"),
            value: (r) => part(r.mcq_full, r.mcq_pass),
          },
          {
            id: "practical",
            header: e("practicalFull"),
            value: (r) => part(r.practical_full, r.practical_pass),
          },
          { id: "full", header: e("fullMarks"), value: (r) => n(r.full_marks) },
          {
            id: "gpa",
            header: e("countsInGpa"),
            value: (r) => (r.counts_in_gpa ? e("yes") : e("no")),
          },
        ]}
        defaults={(r) => ({
          exam_id: examId,
          class_id: cls.id,
          subject_id: r?.subject_id ?? null,
          cq_full: String(r?.cq_full ?? 70),
          cq_pass:
            r?.cq_pass === null || r?.cq_pass === undefined
              ? r
                ? ""
                : "23"
              : String(r.cq_pass),
          mcq_full: String(r?.mcq_full ?? 30),
          mcq_pass:
            r?.mcq_pass === null || r?.mcq_pass === undefined
              ? r
                ? ""
                : "10"
              : String(r.mcq_pass),
          practical_full: String(r?.practical_full ?? 0),
          practical_pass:
            r?.practical_pass === null || r?.practical_pass === undefined
              ? ""
              : String(r.practical_pass),
          counts_in_gpa: r?.counts_in_gpa ?? true,
          // Read only by the form below: the subject of a saved row cannot change.
          locked_subject: r ? r.subject : "",
        })}
        fields={(form) => (
          <>
            {form.getValues("locked_subject") ? (
              <p className="text-sm">
                {e("subject")}:{" "}
                <strong>{String(form.getValues("locked_subject"))}</strong>
              </p>
            ) : (
              <SelectField
                form={form}
                t={tr}
                name="subject_id"
                label={e("subject")}
                numeric
                empty="—"
                options={subjects.map((s) => ({ value: s.id, label: s.name }))}
              />
            )}
            <div className="grid grid-cols-2 gap-3">
              <TextField
                form={form}
                t={tr}
                type="number"
                name="cq_full"
                label={e("cqFull")}
              />
              <TextField
                form={form}
                t={tr}
                type="number"
                name="cq_pass"
                label={e("cqPass")}
              />
              <TextField
                form={form}
                t={tr}
                type="number"
                name="mcq_full"
                label={e("mcqFull")}
              />
              <TextField
                form={form}
                t={tr}
                type="number"
                name="mcq_pass"
                label={e("mcqPass")}
              />
              <TextField
                form={form}
                t={tr}
                type="number"
                name="practical_full"
                label={e("practicalFull")}
              />
              <TextField
                form={form}
                t={tr}
                type="number"
                name="practical_pass"
                label={e("practicalPass")}
              />
            </div>
            <CheckboxField
              form={form}
              name="counts_in_gpa"
              label={e("countsInGpa")}
            />
          </>
        )}
      />
    </section>
  );
}
