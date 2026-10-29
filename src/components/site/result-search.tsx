"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ResultChoices } from "@/lib/site/result-data";

export type ResultSearchText = {
  session: string;
  exam: string;
  class: string;
  section: string;
  group: string;
  anyGroup: string;
  roll: string;
  search: string;
  choose: string;
};

type Values = {
  session?: string;
  exam?: string;
  class?: string;
  section?: string;
  group?: string;
  roll?: string;
};

const select = "bg-background h-10 w-full rounded-md border px-3 text-sm";

/**
 * Session → exam → class → section (→ group from Class 9) + roll. A GET form, so the
 * result has its own address and the page works without JavaScript (then every option
 * is listed).
 */
export function ResultSearch({
  action,
  choices,
  text,
  values,
  errors,
}: {
  action: string;
  choices: ResultChoices;
  text: ResultSearchText;
  values: Values;
  errors: Partial<Record<"exam" | "section" | "roll" | "group", string>>;
}) {
  const sessions = [...new Set(choices.exams.map((e) => e.session))];
  const [session, setSession] = useState(values.session ?? sessions[0] ?? "");
  const exams = choices.exams.filter((e) => e.session === session);
  const [exam, setExam] = useState(values.exam ?? String(exams[0]?.id ?? ""));
  const classIds =
    choices.exams.find((e) => String(e.id) === exam)?.classIds ?? [];
  const classes = choices.classes.filter((c) => classIds.includes(c.id));
  const [cls, setCls] = useState(values.class ?? String(classes[0]?.id ?? ""));
  const sections = choices.sections.filter((s) => String(s.classId) === cls);
  const level = choices.classes.find((c) => String(c.id) === cls)?.level ?? 0;
  const err = (k: keyof typeof errors) =>
    errors[k]
      ? {
          "aria-invalid": true as const,
          "aria-describedby": `result-${k}-error`,
        }
      : {};
  const message = (k: keyof typeof errors) =>
    errors[k] ? (
      <p id={`result-${k}-error`} className="text-destructive text-sm">
        {errors[k]}
      </p>
    ) : null;

  return (
    <form
      action={action}
      className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3 print:hidden"
      data-testid="result-search"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="result-session">{text.session}</Label>
        <select
          id="result-session"
          name="session"
          className={select}
          value={session}
          onChange={(e) => {
            setSession(e.target.value);
            const first = choices.exams.find(
              (x) => x.session === e.target.value,
            );
            setExam(String(first?.id ?? ""));
            setCls("");
          }}
        >
          {sessions.map((s) => (
            <option key={s} value={s}>
              {choices.exams.find((e) => e.session === s)?.sessionLabel ?? s}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="result-exam">{text.exam}</Label>
        <select
          id="result-exam"
          name="exam"
          className={select}
          value={exam}
          onChange={(e) => {
            setExam(e.target.value);
            setCls("");
          }}
          {...err("exam")}
        >
          {exams.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        {message("exam")}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="result-class">{text.class}</Label>
        <select
          id="result-class"
          name="class"
          className={select}
          value={cls}
          onChange={(e) => setCls(e.target.value)}
        >
          <option value="">{text.choose}</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="result-section">{text.section}</Label>
        <select
          id="result-section"
          name="section"
          className={select}
          defaultValue={values.section ?? ""}
          key={cls}
          {...err("section")}
        >
          <option value="">{text.choose}</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {message("section")}
      </div>
      {level >= 9 && choices.groups.length ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="result-group">{text.group}</Label>
          <select
            id="result-group"
            name="group"
            className={select}
            defaultValue={values.group ?? ""}
            {...err("group")}
          >
            <option value="">{text.anyGroup}</option>
            {choices.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          {message("group")}
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="result-roll">{text.roll}</Label>
        <Input
          id="result-roll"
          name="roll"
          inputMode="numeric"
          autoComplete="off"
          defaultValue={values.roll ?? ""}
          {...err("roll")}
        />
        {message("roll")}
      </div>
      <div className="flex items-end">
        <Button type="submit">{text.search}</Button>
      </div>
    </form>
  );
}
