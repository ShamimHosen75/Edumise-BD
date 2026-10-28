"use client";

import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveMarks } from "@/app/[lang]/dashboard/marks/actions";
import { readSpreadsheet } from "@/app/[lang]/dashboard/spreadsheet-actions";
import { translator } from "@/components/dashboard/academic/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import type { RosterRow } from "@/lib/attendance-data";
import { csvRecords } from "@/lib/csv-parse";
import { localizeDigits } from "@/lib/format";
import { readMarkRows, type ImportedMark, type MarkRow } from "@/lib/marks";
import type { MarksEntry } from "@/lib/marks-data";
import { toXlsx } from "@/lib/xlsx";

/** Template (Excel, filled with the class list), upload, preview, then save. */
export function MarksImport({
  lang,
  entry,
  roster,
  saved,
  messages,
}: {
  lang: Locale;
  entry: MarksEntry;
  roster: RosterRow[];
  saved: MarkRow[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const m = (key: string, vars?: Record<string, string>) =>
    tr(`marks.import.${key}`, vars);
  const n = (v: number) => localizeDigits(v, lang);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<ImportedMark[] | null>(null);
  const ready = rows?.filter((r) => r.row) ?? [];
  const allReady = rows !== null && ready.length === rows.length;

  const template = () => {
    const file = toXlsx(entry.label, [
      ["roll", "name", "cq", "mcq", "practical", "absent"],
      ...roster.map((r) => {
        const s = saved.find((x) => x.student_id === r.studentId);
        return [
          r.roll,
          r.name,
          s?.cq ?? null,
          s?.mcq ?? null,
          s?.practical ?? null,
          s?.is_absent ? "yes" : null,
        ];
      }),
    ]);
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(file)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "marks-template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const read = (file: File | undefined) => {
    setRows(null);
    if (!file) return;
    start(async () => {
      let records: Record<string, unknown>[];
      if (/\.csv$/i.test(file.name)) records = csvRecords(await file.text());
      else {
        const data = new FormData();
        data.set("file", file);
        const result = await readSpreadsheet(lang, data).catch(() => ({
          ok: false as const,
          error: "errors.spreadsheet" as const,
        }));
        if (!result.ok) return void toast.error(tr(result.error));
        records = result.rows;
      }
      if (!records.length) return void toast.error(m("none"));
      setRows(readMarkRows(records, roster, entry));
    });
  };

  const apply = () =>
    start(async () => {
      const result = await saveMarks(lang, {
        exam_subject_id: entry.examSubjectId,
        section_id: entry.sectionId,
        rows: ready.map((r) => r.row!),
      }).catch(() => ({
        ok: false as const,
        error: "auth.unexpected" as const,
      }));
      if (!result.ok) return void toast.error(tr(result.error));
      toast.success(m("applied", { count: n(result.saved) }));
      setRows(null);
      router.refresh();
    });

  return (
    <section
      aria-labelledby="marks-import"
      className="flex flex-col gap-3 rounded-xl border p-4"
      aria-busy={pending}
    >
      <h2 id="marks-import" className="font-semibold">
        {m("title")}
      </h2>
      <p className="text-muted-foreground text-sm">{m("intro")}</p>
      <div className="flex flex-wrap items-end gap-3">
        <Button type="button" variant="outline" onClick={template}>
          <Download aria-hidden="true" />
          {m("template")}
        </Button>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="marks-file">{m("file")}</Label>
          <Input
            id="marks-file"
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={(e) => read(e.target.files?.[0])}
          />
        </div>
      </div>
      {rows ? (
        <>
          <h3 className="text-sm font-medium">{m("preview")}</h3>
          <ul
            className="flex flex-col gap-1 text-sm"
            data-testid="marks-import-preview"
          >
            {rows.map((r) => (
              <li key={r.line} className="flex flex-wrap gap-2">
                <span className="text-muted-foreground">
                  {m("line")} {n(r.line)}
                </span>
                {r.problems.length ? (
                  <span className="text-destructive">
                    {r.problems.map((p) => tr(p)).join(" ")}
                  </span>
                ) : (
                  <span className="text-primary">{m("ready")}</span>
                )}
              </li>
            ))}
          </ul>
          {!allReady ? <p className="text-sm">{m("fix")}</p> : null}
          <Button
            type="button"
            className="w-fit"
            disabled={!allReady || pending}
            onClick={apply}
          >
            {m("apply", { count: n(ready.length) })}
          </Button>
        </>
      ) : null}
    </section>
  );
}
