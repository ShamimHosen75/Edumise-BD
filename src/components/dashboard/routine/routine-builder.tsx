"use client";

import { Plus, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  saveRoutine,
  type SaveRoutineResult,
} from "@/app/[lang]/dashboard/routine/actions";
import { translator } from "@/components/dashboard/academic/labels";
import { EntryText, RoutineGrid } from "@/components/routine/routine-grid";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { localizeDigits } from "@/lib/format";
import {
  findClashes,
  slotKey,
  type Booking,
  type Clash,
  type RoutineCell,
} from "@/lib/routine";
import type { Period } from "@/lib/routine-data";
import { cn } from "@/lib/utils";

import { CellEditor } from "./cell-editor";

type Option = { id: number; name: string };

/** Click a class to edit it; clashes with other sections show at once; Save sends all. */
export function RoutineBuilder({
  lang,
  sessionId,
  sectionId,
  periods,
  workingDays,
  initial,
  others,
  subjects,
  teachers,
  rooms,
  messages,
}: {
  lang: Locale;
  sessionId: number;
  sectionId: number;
  periods: Period[];
  workingDays: number[];
  initial: RoutineCell[];
  others: Booking[];
  subjects: Option[];
  teachers: Option[];
  rooms: Option[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const r = (key: string, vars?: Record<string, string>) =>
    tr(`routine.${key}`, vars);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cells, setCells] = useState(
    () => new Map(initial.map((c) => [slotKey(c.day, c.periodId), c])),
  );
  const [selected, setSelected] = useState<{
    day: number;
    period: Period;
  } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [serverClashes, setServerClashes] = useState<Clash[]>([]);
  const list = [...cells.values()];
  const clashes = useMemo(
    () => [
      ...new Map(
        [...findClashes(list, others, sectionId), ...serverClashes].map((c) => [
          `${c.kind}:${c.day}:${c.periodId}:${c.section}`,
          c,
        ]),
      ).values(),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- list is derived from cells
    [cells, others, sectionId, serverClashes],
  );
  const clashAt = (key: string) =>
    clashes.filter((c) => slotKey(c.day, c.periodId) === key);
  const name = (options: Option[], id: number | null) =>
    options.find((o) => o.id === id)?.name ?? "";
  const n = (v: number) => localizeDigits(v, lang);
  const dayName = (d: number) => tr(`days.${d}`);

  /** Back to the cell that was being edited (keyboard and screen reader users). */
  const focusSlot = (key: string) =>
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLButtonElement>(`[data-slot="${key}"]`)
        ?.focus(),
    );

  const update = (key: string, cell: RoutineCell | null) => {
    setCells((cur) => {
      const next = new Map(cur);
      if (cell) next.set(key, cell);
      else next.delete(key);
      return next;
    });
    setServerClashes([]);
    setDirty(true);
    setSelected(null);
    focusSlot(key);
  };

  const save = () =>
    start(async () => {
      const result: SaveRoutineResult = await saveRoutine(lang, {
        session_id: sessionId,
        section_id: sectionId,
        cells: list,
      }).catch(() => ({ ok: false, error: "auth.unexpected" }));
      if (!result.ok) {
        setServerClashes(result.clashes ?? []);
        // Other sections may have changed since the page loaded.
        router.refresh();
        return void toast.error(tr(result.error));
      }
      setDirty(false);
      toast.success(r("saved"));
      router.refresh();
    });

  const editing = selected ? slotKey(selected.day, selected.period.id) : null;

  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      <RoutineGrid
        periods={periods}
        workingDays={workingDays}
        labels={{
          caption: r("title"),
          day: r("day"),
          period: (p) => r("period", { number: n(p.number) }),
          breakLabel: r("break"),
          dayName,
          time: (v) => localizeDigits(v, lang),
        }}
        cell={(day, period, key) => {
          const c = cells.get(key);
          const clash = clashAt(key);
          const label = r("cellLabel", {
            day: dayName(day),
            number: n(period.number),
            subject: c ? name(subjects, c.subjectId) : r("noSubject"),
          });
          return (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setSelected({ day, period })}
                aria-label={label}
                aria-pressed={editing === key}
                data-slot={key}
                className={cn(
                  "hover:bg-accent flex min-h-14 w-full items-start rounded-md border border-transparent text-left",
                  editing === key && "border-primary",
                  clash.length > 0 && "border-destructive bg-destructive/10",
                )}
              >
                {c ? (
                  <EntryText
                    title={name(subjects, c.subjectId)}
                    lines={[name(teachers, c.staffId), name(rooms, c.roomId)]}
                  />
                ) : (
                  <Plus
                    className="text-muted-foreground m-auto size-4 print:hidden"
                    aria-hidden="true"
                  />
                )}
              </button>
              {clash.map((x) => (
                <span
                  key={`${x.kind}-${x.section}`}
                  className="text-destructive text-xs"
                >
                  {x.kind === "teacher"
                    ? r("clashTeacher", { section: x.section })
                    : r("clashRoom", { section: x.section })}
                </span>
              ))}
            </div>
          );
        }}
      />
      {selected && editing ? (
        <CellEditor
          key={editing}
          title={r("editCell", {
            day: dayName(selected.day),
            number: n(selected.period.number),
          })}
          hint={r("editHint")}
          cell={cells.get(editing) ?? null}
          subjects={subjects}
          teachers={teachers}
          rooms={rooms}
          labels={{
            subject: r("subject"),
            teacher: r("teacher"),
            room: r("room"),
            noSubject: r("noSubject"),
            noTeacher: r("noTeacher"),
            noRoom: r("noRoom"),
            apply: r("apply"),
            clear: r("clear"),
            close: r("close"),
          }}
          onApply={(v) =>
            update(editing, {
              day: selected.day,
              periodId: selected.period.id,
              ...v,
            })
          }
          onClear={() => update(editing, null)}
          onClose={() => {
            setSelected(null);
            focusSlot(editing);
          }}
        />
      ) : null}
      <div className="bg-background sticky bottom-0 flex flex-wrap items-center gap-3 border-t py-3 print:hidden">
        <Button
          type="button"
          onClick={save}
          disabled={pending || clashes.length > 0}
        >
          {pending ? r("saving") : r("save")}
        </Button>
        <Button type="button" variant="outline" onClick={() => window.print()}>
          <Printer aria-hidden="true" />
          {r("print")}
        </Button>
        {clashes.length ? (
          <p role="status" className="text-destructive text-sm">
            {r("clashCount", { count: n(clashes.length) })}
          </p>
        ) : dirty ? (
          <p role="status" className="text-muted-foreground text-sm">
            {r("unsaved")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
