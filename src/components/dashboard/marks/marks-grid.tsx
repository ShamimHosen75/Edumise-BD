"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import {
  saveMarks,
  submitMarks,
  type SaveMarksResult,
} from "@/app/[lang]/dashboard/marks/actions";
import { translator } from "@/components/dashboard/academic/labels";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import type { RosterRow } from "@/lib/attendance-data";
import { formatDate, localizeDigits } from "@/lib/format";
import {
  checkMarkRow,
  isComplete,
  partsInUse,
  readMark,
  type MarkRow,
  type Part,
} from "@/lib/marks";
import type { MarksEntry } from "@/lib/marks-data";

import { MarksRow, type Draft } from "./marks-row";

// QA-01: saved marks in the reader's digits (readMark accepts both kinds).
const toText = (v: number | null, lang: Locale) =>
  v === null ? "" : localizeDigits(v, lang);
const same = (a: MarkRow, b: MarkRow) =>
  a.is_absent === b.is_absent &&
  a.cq === b.cq &&
  a.mcq === b.mcq &&
  a.practical === b.practical;

/** One row per student: a box per part in use, "absent", and the total. Saves as you type. */
export function MarksGrid({
  lang,
  entry,
  roster,
  initial,
  lockedAt,
  editable,
  messages,
}: {
  lang: Locale;
  entry: MarksEntry;
  roster: RosterRow[];
  initial: MarkRow[];
  lockedAt: string | null;
  /** The exam takes marks (admins: also in review). */
  editable: boolean;
  messages: Messages;
}) {
  // Stable between renders, so the autosave timer is not restarted needlessly.
  const tr = useMemo(() => translator(messages), [messages]);
  const m = (key: string, vars?: Record<string, string>) =>
    tr(`marks.${key}`, vars);
  const n = (v: number) => localizeDigits(v, lang);
  const router = useRouter();
  const parts = partsInUse(entry);
  const readOnly = !editable || lockedAt !== null;
  const [drafts, setDrafts] = useState<Record<number, Draft>>(() =>
    Object.fromEntries(
      roster.map((r) => {
        const saved = initial.find((x) => x.student_id === r.studentId);
        return [
          r.studentId,
          {
            texts: {
              cq: toText(saved?.cq ?? null, lang),
              mcq: toText(saved?.mcq ?? null, lang),
              practical: toText(saved?.practical ?? null, lang),
            },
            absent: saved?.is_absent ?? false,
          },
        ];
      }),
    ),
  );
  const [dirty, setDirty] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [submitting, start] = useTransition();
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  const rowOf = useCallback(
    (studentId: number, d = draftsRef.current[studentId]!): MarkRow => ({
      student_id: studentId,
      cq: readMark(d.texts.cq),
      mcq: readMark(d.texts.mcq),
      practical: readMark(d.texts.practical),
      is_absent: d.absent,
    }),
    [],
  );

  /** Sends the changed rows that are valid; returns false if something failed. */
  const flush = useCallback(
    async (ids: Set<number>) => {
      const rows = [...ids]
        .map((id) => rowOf(id))
        .filter((r) => Object.keys(checkMarkRow(r, entry)).length === 0);
      if (!rows.length) return true;
      setStatus("saving");
      const result: SaveMarksResult = await saveMarks(lang, {
        exam_subject_id: entry.examSubjectId,
        section_id: entry.sectionId,
        rows,
      }).catch(() => ({ ok: false, error: "auth.unexpected" }));
      if (!result.ok) {
        setStatus("error");
        toast.error(tr(result.error));
        return false;
      }
      // Only rows unchanged since they were sent are saved; a newer edit typed while
      // the request was on its way stays dirty and is sent next.
      setDirty((cur) => {
        const next = new Set(cur);
        for (const r of rows)
          if (same(rowOf(r.student_id), r)) next.delete(r.student_id);
        return next;
      });
      setStatus("saved");
      return true;
    },
    [entry, lang, rowOf, tr],
  );

  // Autosave a moment after the last change.
  useEffect(() => {
    if (!dirty.size || readOnly) return;
    const timer = setTimeout(() => void flush(dirty), 800);
    return () => clearTimeout(timer);
  }, [dirty, flush, readOnly]);

  const change = (studentId: number, d: Draft) => {
    setDrafts((cur) => ({ ...cur, [studentId]: d }));
    setDirty((cur) => new Set(cur).add(studentId));
  };

  const rows = roster.map((r) => rowOf(r.studentId, drafts[r.studentId]));
  const entered = rows.filter((r) => isComplete(r, entry)).length;
  const anyProblem = rows.some(
    (r) => Object.keys(checkMarkRow(r, entry)).length,
  );

  const submit = () => {
    if (anyProblem) return void toast.error(m("saveFailed"));
    if (entered < roster.length)
      return void toast.error(
        m("missing", { count: n(roster.length - entered) }),
      );
    if (
      !window.confirm(
        m("submitConfirm", { subject: entry.subject, section: entry.section }),
      )
    )
      return;
    start(async () => {
      if (!(await flush(new Set(roster.map((r) => r.studentId))))) return;
      const result = await submitMarks(
        lang,
        entry.examSubjectId,
        entry.sectionId,
      ).catch(() => ({
        ok: false as const,
        error: "auth.unexpected" as const,
      }));
      if (!result.ok) return void toast.error(tr(result.error));
      toast.success(m("submitted"));
      router.refresh();
    });
  };

  const full = (p: Part) => entry[`${p}_full`];
  const cell = "px-2 py-1.5";

  return (
    <div className="flex flex-col gap-3">
      {lockedAt ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl border p-3 text-sm"
        >
          <Lock className="size-4" aria-hidden="true" />
          {m("lockedNote", { date: formatDate(lockedAt, lang, "medium") })}
        </p>
      ) : !editable ? (
        <p role="status" className="rounded-xl border p-3 text-sm">
          {m("readOnly")}
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">{m("autosave")}</p>
      )}
      <div
        role="region"
        tabIndex={0}
        aria-label={entry.label}
        className="focus-visible:ring-ring overflow-x-auto rounded-xl border outline-none focus-visible:ring-2"
      >
        <table className="w-full text-sm">
          <caption className="sr-only">{entry.label}</caption>
          <thead className="bg-muted text-left">
            <tr>
              <th scope="col" className={cell}>
                {m("roll")}
              </th>
              <th scope="col" className={cell}>
                {m("name")}
              </th>
              {parts.map((p) => (
                <th key={p} scope="col" className={cell}>
                  {m(p)}{" "}
                  <span className="text-muted-foreground text-xs font-normal">
                    ({n(full(p))})
                  </span>
                </th>
              ))}
              <th scope="col" className={cell}>
                {m("absent")}
              </th>
              <th scope="col" className={cell}>
                {m("total")}
              </th>
            </tr>
          </thead>
          <tbody>
            {roster.map((r, i) => (
              <MarksRow
                key={r.studentId}
                lang={lang}
                student={r}
                parts={parts}
                entry={entry}
                draft={drafts[r.studentId]!}
                row={rows[i]!}
                readOnly={readOnly}
                m={m}
                onChange={(d) => change(r.studentId, d)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-background sticky bottom-0 flex flex-wrap items-center gap-3 border-t py-3">
        <p
          role="status"
          className="min-w-0 flex-1 text-sm"
          data-testid="marks-progress"
        >
          {m("progress", { entered: n(entered), total: n(roster.length) })}
          <span className="text-muted-foreground block text-xs">
            {status === "saving"
              ? m("saving")
              : anyProblem || status === "error"
                ? m("saveFailed")
                : dirty.size
                  ? m("unsaved")
                  : status === "saved"
                    ? m("savedAll")
                    : ""}
          </span>
        </p>
        {!readOnly ? (
          <Button type="button" onClick={submit} disabled={submitting}>
            <Lock aria-hidden="true" />
            {submitting ? m("submitting") : m("submit")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
