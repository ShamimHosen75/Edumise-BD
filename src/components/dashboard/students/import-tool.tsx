"use client";

import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  commitImport,
  previewImport,
  type ImportResult,
} from "@/app/[lang]/dashboard/students/import-actions";
import { translator } from "@/components/dashboard/academic/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { toCsv } from "@/lib/csv";
import { csvRecords } from "@/lib/csv-parse";
import { localizeDigits } from "@/lib/format";
import {
  IMPORT_COLUMNS,
  IMPORT_EXAMPLE,
  IMPORT_MAX_ROWS,
  type CheckedRow,
} from "@/lib/student-import";

const failed = (): ImportResult => ({ ok: false, error: "auth.unexpected" });

/** Template download, file upload, row-by-row preview, then import in one go. */
export function ImportTool({
  lang,
  sessionId,
  messages,
}: {
  lang: Locale;
  sessionId: number;
  messages: Messages;
}) {
  const tr = translator(messages);
  const m = (key: string, vars?: Record<string, string>) =>
    tr(`importStudents.${key}`, vars);
  const n = (v: number) => localizeDigits(v, lang);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [raw, setRaw] = useState<Record<string, string>[] | null>(null);
  const [checked, setChecked] = useState<CheckedRow[] | null>(null);
  const valid = checked?.filter((r) => r.row).length ?? 0;
  const ready = checked !== null && valid === checked.length;

  const template = () => {
    const csv = toCsv(
      [...IMPORT_COLUMNS],
      [IMPORT_COLUMNS.map((c) => IMPORT_EXAMPLE[c])],
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "students-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const read = (file: File | undefined) => {
    setChecked(null);
    setRaw(null);
    if (!file) return;
    start(async () => {
      const rows = csvRecords(await file.text());
      if (rows.length === 0 || rows.length > IMPORT_MAX_ROWS)
        return void toast.error(tr("errors.fileRows"));
      const result = await previewImport(lang, sessionId, rows).catch(failed);
      if (!result.ok) return void toast.error(tr(result.error));
      setRaw(rows);
      setChecked(result.rows);
    });
  };

  const commit = () =>
    start(async () => {
      if (!raw) return;
      const result = await commitImport(lang, sessionId, raw).catch(failed);
      if (!result.ok) return void toast.error(tr(result.error));
      setChecked(result.rows);
      if (result.imported === undefined) return void toast.error(m("fix"));
      toast.success(m("done", { count: n(result.imported) }));
      setRaw(null);
      setChecked(null);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      <div className="flex flex-wrap items-end gap-3">
        <Button type="button" variant="outline" onClick={template}>
          <Download aria-hidden="true" />
          {m("template")}
        </Button>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="import-file">{m("file")}</Label>
          <Input
            id="import-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => read(e.target.files?.[0])}
          />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">{m("hint")}</p>
      {pending && !checked ? (
        <p role="status" className="text-sm">
          {m("reading")}
        </p>
      ) : null}
      {checked ? (
        <section
          className="flex flex-col gap-3"
          aria-labelledby="preview-title"
        >
          <h2 id="preview-title" className="font-semibold">
            {m("preview")}
          </h2>
          <p role="status" className="text-sm" data-testid="import-summary">
            {m("validCount", { valid: n(valid), total: n(checked.length) })}{" "}
            {ready ? "" : m("fix")}
          </p>
          <div className="max-h-[28rem] overflow-auto rounded-xl border">
            <table className="w-full text-sm">
              <caption className="sr-only">{m("preview")}</caption>
              <thead className="bg-muted sticky top-0 text-left">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    {m("line")}
                  </th>
                  <th scope="col" className="px-3 py-2">
                    {tr("students.name")}
                  </th>
                  <th scope="col" className="px-3 py-2">
                    {tr("students.roll")}
                  </th>
                  <th scope="col" className="px-3 py-2">
                    {m("problems")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {checked.map((r) => (
                  <tr key={r.line} className="border-t align-top">
                    <td className="px-3 py-2">{n(r.line)}</td>
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2">
                      {r.row?.roll ? n(r.row.roll) : ""}
                    </td>
                    <td className="px-3 py-2">
                      {r.issues.length === 0 ? (
                        <span className="text-primary">{m("ok")}</span>
                      ) : (
                        <ul className="text-destructive list-disc ps-4">
                          {r.issues.map((i) => (
                            <li key={i.field}>
                              <span className="font-mono text-xs">
                                {i.field}
                              </span>
                              : {tr(i.message)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            type="button"
            className="w-fit"
            disabled={!ready || pending}
            onClick={commit}
          >
            {pending ? m("committing") : m("commit", { count: n(valid) })}
          </Button>
        </section>
      ) : null}
    </div>
  );
}
