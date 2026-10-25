"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  promoteClass,
  type PromotionResult,
} from "@/app/[lang]/dashboard/students/promotion-actions";
import { translator } from "@/components/dashboard/academic/labels";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { localizeDigits } from "@/lib/format";

type Row = {
  id: number;
  name: string;
  code: string;
  section: string;
  roll: number;
};

/** Mark each student promoted or retained, then create next session's enrolments. */
export function PromotionTool({
  lang,
  fromSession,
  classId,
  isLastClass,
  rows,
  sessions,
  defaultTo,
  messages,
}: {
  lang: Locale;
  fromSession: number;
  classId: number;
  isLastClass: boolean;
  rows: Row[];
  sessions: { id: number; name: string }[];
  defaultTo: number | undefined;
  messages: Messages;
}) {
  const tr = translator(messages);
  const p = (key: string, vars?: Record<string, string>) =>
    tr(`promotion.${key}`, vars);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [promote, setPromote] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, true])),
  );
  const [to, setTo] = useState(defaultTo ?? sessions[0]?.id ?? 0);
  const setAll = (value: boolean) =>
    setPromote(Object.fromEntries(rows.map((r) => [r.id, value])));

  if (rows.length === 0)
    return <p className="text-muted-foreground text-sm">{p("empty")}</p>;
  const toName = sessions.find((s) => s.id === to)?.name ?? "";
  const enrolments = rows.filter((r) => !(isLastClass && promote[r.id])).length;

  const run = () => {
    if (to === fromSession) return void toast.error(p("sameSession"));
    if (
      !window.confirm(
        p("confirm", {
          count: localizeDigits(enrolments, lang),
          session: toName,
        }),
      )
    )
      return;
    start(async () => {
      const result: PromotionResult = await promoteClass(lang, {
        from_session: fromSession,
        to_session: to,
        class_id: classId,
        decisions: rows.map((r) => ({
          student_id: r.id,
          promote: !!promote[r.id],
        })),
      }).catch(() => ({ ok: false, error: "auth.unexpected" }));
      if (!result.ok) return void toast.error(tr(result.error));
      toast.success(
        p("done", {
          count: localizeDigits(result.count, lang),
          session: toName,
        }),
      );
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      <p className="text-muted-foreground text-sm">
        {p("rule")} {isLastClass ? p("lastClass") : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAll(true)}
        >
          {p("all")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAll(false)}
        >
          {p("none")}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <caption className="sr-only">{p("title")}</caption>
          <thead className="bg-muted text-left">
            <tr>
              <th scope="col" className="px-3 py-2">
                {tr("students.section")}
              </th>
              <th scope="col" className="px-3 py-2">
                {tr("students.roll")}
              </th>
              <th scope="col" className="px-3 py-2">
                {tr("students.name")}
              </th>
              <th scope="col" className="px-3 py-2">
                {p("decision")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{r.section}</td>
                <td className="px-3 py-2">{localizeDigits(r.roll, lang)}</td>
                <td className="px-3 py-2">
                  {r.name}
                  <span className="text-muted-foreground block text-xs">
                    {localizeDigits(r.code, lang)}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <fieldset className="flex flex-wrap gap-3">
                    <legend className="sr-only">{r.name}</legend>
                    {[true, false].map((value) => (
                      <label
                        key={String(value)}
                        className="flex items-center gap-1.5"
                      >
                        <input
                          type="radio"
                          name={`decision-${r.id}`}
                          checked={promote[r.id] === value}
                          onChange={() =>
                            setPromote((d) => ({ ...d, [r.id]: value }))
                          }
                        />
                        {value ? p("promote") : p("retain")}
                      </label>
                    ))}
                  </fieldset>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="promotion-to">{p("to")}</Label>
          <select
            id="promotion-to"
            value={to}
            onChange={(e) => setTo(Number(e.target.value))}
            className="bg-background h-10 rounded-md border px-3 text-sm"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" onClick={run} disabled={pending}>
          {pending ? p("running") : p("run")}
        </Button>
      </div>
    </div>
  );
}
