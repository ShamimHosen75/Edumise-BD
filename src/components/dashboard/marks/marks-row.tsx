"use client";

import type { Locale } from "@/i18n/config";
import { localizeDigits } from "@/lib/format";
import { checkMarkRow, markTotal, type MarkRow, type Part } from "@/lib/marks";
import type { MarksEntry } from "@/lib/marks-data";
import type { RosterRow } from "@/lib/attendance-data";
import { cn } from "@/lib/utils";

/** What the teacher has typed for one student. */
export type Draft = { texts: Record<Part, string>; absent: boolean };

const cell = "px-2 py-1.5";

/** One student's inputs: a box per part in use, absent, and the total. */
export function MarksRow({
  lang,
  student,
  parts,
  entry,
  draft,
  row,
  readOnly,
  m,
  onChange,
}: {
  lang: Locale;
  student: RosterRow;
  parts: Part[];
  entry: MarksEntry;
  draft: Draft;
  row: MarkRow;
  readOnly: boolean;
  m: (key: string, vars?: Record<string, string>) => string;
  onChange: (d: Draft) => void;
}) {
  const n = (v: number) => localizeDigits(v, lang);
  const problems = checkMarkRow(row, entry);
  const total = markTotal(row);
  const full = (p: Part) => entry[`${p}_full`];
  return (
    <tr className="border-t" data-testid="marks-row">
      <td className={cell}>{n(student.roll)}</td>
      <th scope="row" className={cn(cell, "text-left font-normal")}>
        {student.name}
      </th>
      {parts.map((p) => (
        <td key={p} className={cell}>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            disabled={readOnly || draft.absent}
            value={draft.texts[p]}
            aria-label={m("fieldLabel", {
              part: m(p),
              name: student.name,
              full: n(full(p)),
            })}
            aria-invalid={problems[p] ? true : undefined}
            aria-describedby={
              problems[p] ? `mark-${student.studentId}-${p}-error` : undefined
            }
            onChange={(e) =>
              onChange({
                ...draft,
                texts: { ...draft.texts, [p]: e.target.value },
              })
            }
            className={cn(
              "bg-background h-10 w-20 rounded-md border px-2 text-right disabled:opacity-60",
              problems[p] && "border-destructive ring-destructive/30 ring-2",
            )}
          />
          {/* Shown (and read out) under the box, not only as a red ring. */}
          {problems[p] ? (
            <span
              id={`mark-${student.studentId}-${p}-error`}
              role="alert"
              className="text-destructive block max-w-24 pt-1 text-xs"
            >
              {m(`problems.${problems[p]}`, { full: n(full(p)) })}
            </span>
          ) : null}
        </td>
      ))}
      <td className={cell}>
        <input
          type="checkbox"
          className="size-5"
          disabled={readOnly}
          checked={draft.absent}
          aria-label={m("absentLabel", { name: student.name })}
          onChange={(e) =>
            onChange({
              absent: e.target.checked,
              texts: e.target.checked
                ? { cq: "", mcq: "", practical: "" }
                : draft.texts,
            })
          }
        />
      </td>
      <td className={cn(cell, "font-medium")} data-testid="marks-total">
        {draft.absent
          ? m("absent")
          : total === null
            ? "—"
            : localizeDigits(total, lang)}
      </td>
    </tr>
  );
}
