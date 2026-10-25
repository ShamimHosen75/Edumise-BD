"use client";

import type { FieldValues, UseFormReturn } from "react-hook-form";

import type { Translate } from "@/components/dashboard/academic/labels";
import {
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/dashboard/content/form-controls";
import { classUsesGroups } from "@/lib/validation/academic";
import { BLOOD_GROUPS, GENDERS, RELIGIONS } from "@/lib/validation/admission";

export type ClassOption = { id: number; level: number; name: string };
export type Option = { id: number; name: string };

type Props = {
  form: UseFormReturn<FieldValues>;
  tr: Translate;
};

const f = (tr: Translate, key: string) => tr(`admission.fields.${key}`);

export function StudentFields({ form, tr }: Props) {
  const base = { form, t: tr };
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        {...base}
        name="student_name_en"
        label={f(tr, "studentNameEn")}
        lang="en"
      />
      <TextField
        {...base}
        name="student_name_bn"
        label={f(tr, "studentNameBn")}
        lang="bn"
      />
      <TextField
        {...base}
        type="date"
        name="birth_date"
        label={f(tr, "birthDate")}
      />
      <SelectField
        {...base}
        name="gender"
        label={f(tr, "gender")}
        empty={tr("admission.choose")}
        options={GENDERS.map((g) => ({
          value: g,
          label: tr(`admission.genders.${g}`),
        }))}
      />
      <TextField
        {...base}
        name="birth_reg_no"
        label={f(tr, "birthRegNo")}
        hint={f(tr, "birthRegHint")}
      />
      <SelectField
        {...base}
        name="religion"
        label={f(tr, "religion")}
        empty={tr("admission.notGiven")}
        options={RELIGIONS.map((r) => ({
          value: r,
          label: tr(`admission.religions.${r}`),
        }))}
      />
      <SelectField
        {...base}
        name="blood_group"
        label={f(tr, "bloodGroup")}
        empty={tr("admission.notGiven")}
        options={BLOOD_GROUPS.map((b) => ({ value: b, label: b }))}
      />
    </div>
  );
}

export function GuardianFields({ form, tr }: Props) {
  const base = { form, t: tr };
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField {...base} name="father_name" label={f(tr, "fatherName")} />
      <TextField {...base} name="mother_name" label={f(tr, "motherName")} />
      <TextField
        {...base}
        name="local_guardian_name"
        label={f(tr, "localGuardian")}
      />
      <TextField
        {...base}
        type="text"
        name="guardian_phone"
        label={f(tr, "phone")}
        hint={f(tr, "phoneHint")}
      />
      <TextField
        {...base}
        name="guardian_occupation"
        label={f(tr, "occupation")}
      />
      <TextField {...base} name="guardian_email" label={f(tr, "email")} />
      <TextAreaField
        {...base}
        name="present_address"
        label={f(tr, "presentAddress")}
        rows={2}
      />
      <TextAreaField
        {...base}
        name="permanent_address"
        label={f(tr, "permanentAddress")}
        rows={2}
      />
    </div>
  );
}

export function AcademicFields({
  form,
  tr,
  classes,
  groups,
}: Props & { classes: ClassOption[]; groups: Option[] }) {
  const base = { form, t: tr };
  const cls = classes.find((c) => c.id === form.watch("class_id"));
  const usesGroups = cls ? classUsesGroups(cls.level) : false;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField
        {...base}
        name="class_id"
        label={f(tr, "class")}
        numeric
        empty={tr("admission.choose")}
        options={classes.map((c) => ({ value: c.id, label: c.name }))}
      />
      {usesGroups ? (
        <SelectField
          {...base}
          name="group_id"
          label={f(tr, "group")}
          numeric
          empty={tr("admission.choose")}
          options={groups.map((g) => ({ value: g.id, label: g.name }))}
        />
      ) : (
        <div />
      )}
      <TextField
        {...base}
        name="previous_school"
        label={f(tr, "previousSchool")}
      />
      <TextField {...base} name="last_result" label={f(tr, "lastResult")} />
    </div>
  );
}
