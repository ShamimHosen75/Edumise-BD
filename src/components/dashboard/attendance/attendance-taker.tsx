"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  saveAttendance,
  type SaveAttendanceResult,
} from "@/app/[lang]/dashboard/attendance/actions";
import { translator } from "@/components/dashboard/academic/labels";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import {
  ATTENDANCE_STATUSES,
  nextStatus,
  type AttendanceStatus,
} from "@/lib/attendance";
import type { RosterRow } from "@/lib/attendance-data";
import { localizeDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

const COLORS: Record<AttendanceStatus, string> = {
  present: "border-primary/40 bg-primary/10 text-primary",
  absent: "border-destructive/50 bg-destructive/10 text-destructive",
  late: "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  leave: "border-sky-500/50 bg-sky-500/10 text-sky-800 dark:text-sky-300",
};

/**
 * One big button per student: tap to cycle the status. Everyone starts Present (or as
 * saved before). The bar at the bottom shows the counts and saves the whole day at once.
 */
export function AttendanceTaker({
  lang,
  sectionId,
  date,
  roster,
  saved,
  messages,
}: {
  lang: Locale;
  sectionId: number;
  date: string;
  roster: RosterRow[];
  /** Statuses already saved for this day, by student id. */
  saved: Record<number, AttendanceStatus>;
  messages: Messages;
}) {
  const tr = translator(messages);
  const a = (key: string, vars?: Record<string, string>) =>
    tr(`attendance.${key}`, vars);
  const n = (v: number) => localizeDigits(v, lang);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [marks, setMarks] = useState<Record<number, AttendanceStatus>>(() =>
    Object.fromEntries(
      roster.map((r) => [r.studentId, saved[r.studentId] ?? "present"]),
    ),
  );
  const [dirty, setDirty] = useState(Object.keys(saved).length === 0);
  const set = (next: Record<number, AttendanceStatus>) => {
    setMarks(next);
    setDirty(true);
  };
  const counts = Object.fromEntries(
    ATTENDANCE_STATUSES.map((s) => [
      s,
      n(Object.values(marks).filter((v) => v === s).length),
    ]),
  );

  const save = () =>
    start(async () => {
      const result: SaveAttendanceResult = await saveAttendance(lang, {
        section_id: sectionId,
        date,
        marks: roster.map((r) => ({
          student_id: r.studentId,
          status: marks[r.studentId] ?? "present",
        })),
      }).catch(() => ({ ok: false, error: "auth.unexpected" }));
      if (!result.ok) return void toast.error(tr(result.error));
      setDirty(false);
      toast.success(a("saved"));
      router.refresh();
    });

  const all = (status: AttendanceStatus) =>
    set(Object.fromEntries(roster.map((r) => [r.studentId, status])));

  return (
    <div className="flex flex-col gap-3" aria-busy={pending}>
      <p className="text-muted-foreground text-sm">{a("tapHint")}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => all("present")}>
          {a("allPresent")}
        </Button>
        <Button type="button" variant="outline" onClick={() => all("absent")}>
          {a("allAbsent")}
        </Button>
      </div>
      <ul className="flex flex-col gap-2" aria-label={a("take")}>
        {roster.map((r) => {
          const status = marks[r.studentId] ?? "present";
          const label = a(`statuses.${status}`);
          return (
            <li key={r.studentId}>
              <button
                type="button"
                data-testid="attendance-student"
                aria-label={a("studentStatus", {
                  name: r.name,
                  roll: n(r.roll),
                  status: label,
                })}
                onClick={() =>
                  set({ ...marks, [r.studentId]: nextStatus(status) })
                }
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-3 text-left transition-colors",
                  COLORS[status],
                )}
              >
                <span className="w-8 shrink-0 text-center text-lg font-semibold">
                  {n(r.roll)}
                </span>
                <span className="text-foreground min-w-0 flex-1 truncate font-medium">
                  {r.name}
                </span>
                <span className="shrink-0 text-sm font-semibold">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="bg-background sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t px-4 py-3 md:mx-0 md:px-0">
        <p
          role="status"
          className="min-w-0 flex-1 text-sm"
          data-testid="attendance-counts"
        >
          {a("counts", counts)}
          {dirty ? (
            <span className="text-muted-foreground block text-xs">
              {a("notSaved")}
            </span>
          ) : null}
        </p>
        <Button
          type="button"
          size="lg"
          onClick={save}
          disabled={pending}
          className="min-h-12"
        >
          {pending ? a("saving") : a("save")}
        </Button>
      </div>
    </div>
  );
}
