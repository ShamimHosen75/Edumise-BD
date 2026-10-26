"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { RoutineCell } from "@/lib/routine";

type Option = { id: number; name: string };

/** Subject, teacher and room for the chosen day and period. */
export function CellEditor({
  title,
  hint,
  cell,
  subjects,
  teachers,
  rooms,
  labels,
  onApply,
  onClear,
  onClose,
}: {
  title: string;
  hint: string;
  cell: RoutineCell | null;
  subjects: Option[];
  teachers: Option[];
  rooms: Option[];
  labels: {
    subject: string;
    teacher: string;
    room: string;
    noSubject: string;
    noTeacher: string;
    noRoom: string;
    apply: string;
    clear: string;
    close: string;
  };
  onApply: (v: {
    subjectId: number;
    staffId: number | null;
    roomId: number | null;
  }) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState(cell ? String(cell.subjectId) : "");
  const [teacher, setTeacher] = useState(
    cell?.staffId ? String(cell.staffId) : "",
  );
  const [room, setRoom] = useState(cell?.roomId ? String(cell.roomId) : "");
  const heading = useRef<HTMLHeadingElement>(null);
  // The editor opens below a wide grid: bring it into view and move focus to it.
  useEffect(() => {
    heading.current?.scrollIntoView({ block: "nearest" });
    heading.current?.focus();
  }, []);
  const num = (v: string) => (v ? Number(v) : null);
  const select = "bg-background h-10 w-full rounded-md border px-3 text-sm";
  const field = (
    id: string,
    label: string,
    value: string,
    set: (v: string) => void,
    options: Option[],
    empty: string,
  ) => (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => set(e.target.value)}
        className={select}
      >
        <option value="">{empty}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <section
      aria-labelledby="cell-editor-title"
      className="bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm print:hidden"
      data-testid="cell-editor"
    >
      <h2
        id="cell-editor-title"
        ref={heading}
        tabIndex={-1}
        className="font-semibold outline-none"
      >
        {title}
      </h2>
      <p className="text-muted-foreground text-xs">{hint}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {field(
          "cell-subject",
          labels.subject,
          subject,
          setSubject,
          subjects,
          labels.noSubject,
        )}
        {field(
          "cell-teacher",
          labels.teacher,
          teacher,
          setTeacher,
          teachers,
          labels.noTeacher,
        )}
        {field("cell-room", labels.room, room, setRoom, rooms, labels.noRoom)}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() =>
            subject
              ? onApply({
                  subjectId: Number(subject),
                  staffId: num(teacher),
                  roomId: num(room),
                })
              : onClear()
          }
        >
          {labels.apply}
        </Button>
        <Button type="button" variant="outline" onClick={onClear}>
          {labels.clear}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          {labels.close}
        </Button>
      </div>
    </section>
  );
}
