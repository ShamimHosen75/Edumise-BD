"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  generateInvoices,
  previewInvoices,
  type PreviewResult,
} from "@/app/[lang]/dashboard/fees/generate-actions";
import { translator } from "@/components/dashboard/academic/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { formatCurrency, localizeDigits } from "@/lib/format";

type Option = { id: number; name: string };
const select = "bg-background h-10 rounded-md border px-3 text-sm";

/** Session, period and classes -> preview -> make the invoices. */
export function GenerateForm({
  lang,
  sessions,
  heads,
  exams,
  classes,
  defaults,
  messages,
}: {
  lang: Locale;
  sessions: Option[];
  /** One-time fee heads. */
  heads: Option[];
  exams: (Option & { sessionId: number })[];
  classes: Option[];
  defaults: { sessionId: number; month: string; dueOn: string };
  messages: Messages;
}) {
  const tr = translator(messages);
  const g = (k: string, vars?: Record<string, string>) =>
    tr(`fees.generate.${k}`, vars);
  const money = (v: number) => formatCurrency(v, lang);
  const n = (v: number) => localizeDigits(v, lang);
  const [pending, start] = useTransition();
  const [sessionId, setSessionId] = useState(defaults.sessionId);
  const [kind, setKind] = useState<"monthly" | "one_time">("monthly");
  const [month, setMonth] = useState(defaults.month);
  const [headId, setHeadId] = useState<number | null>(heads[0]?.id ?? null);
  const [examId, setExamId] = useState<number | null>(null);
  const [classIds, setClassIds] = useState<number[]>(classes.map((c) => c.id));
  const [dueOn, setDueOn] = useState(defaults.dueOn);
  const [preview, setPreview] = useState<Extract<
    PreviewResult,
    { ok: true }
  > | null>(null);
  const [made, setMade] = useState(false);

  const input = {
    session_id: sessionId,
    kind,
    month: kind === "monthly" ? month : undefined,
    fee_head_id: kind === "one_time" ? headId : null,
    exam_id: kind === "one_time" ? examId : null,
    class_ids: classIds,
    due_on: dueOn,
  };
  // Any change needs a new preview.
  const change =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPreview(null);
      setMade(false);
    };

  const check = () =>
    start(async () => {
      const r = await previewInvoices(lang, input).catch(() => ({
        ok: false as const,
        error: "auth.unexpected" as const,
      }));
      if (!r.ok) return void toast.error(tr(r.error));
      setPreview(r);
    });

  const make = () => {
    if (!preview) return;
    if (
      !window.confirm(
        g("confirm", {
          count: n(preview.invoices),
          total: money(preview.total),
        }),
      )
    )
      return;
    start(async () => {
      const r = await generateInvoices(lang, input).catch(() => ({
        ok: false as const,
        error: "auth.unexpected" as const,
      }));
      if (!r.ok) return void toast.error(tr(r.error));
      toast.success(
        g("made", { created: n(r.created), skipped: n(r.skipped) }),
      );
      setPreview(null);
      setMade(true);
    });
  };

  return (
    <form
      className="flex flex-col gap-4 rounded-xl border p-4"
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        check();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gen-session">{g("session")}</Label>
          <select
            id="gen-session"
            className={select}
            value={sessionId}
            onChange={(e) => change(setSessionId)(Number(e.target.value))}
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">{g("kind")}</legend>
          {(["monthly", "one_time"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="gen-kind"
                className="size-4"
                checked={kind === k}
                onChange={() => change(setKind)(k)}
              />
              {g(`kinds.${k}`)}
            </label>
          ))}
        </fieldset>
        {kind === "monthly" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gen-month">{g("month")}</Label>
            <Input
              id="gen-month"
              type="month"
              value={month}
              required
              onChange={(e) => change(setMonth)(e.target.value)}
            />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gen-head">{g("head")}</Label>
              <select
                id="gen-head"
                className={select}
                value={headId ?? ""}
                onChange={(e) => change(setHeadId)(Number(e.target.value))}
              >
                {heads.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gen-exam">{g("exam")}</Label>
              <select
                id="gen-exam"
                className={select}
                value={examId ?? ""}
                onChange={(e) =>
                  change(setExamId)(
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
              >
                <option value="">{g("noExam")}</option>
                {exams
                  .filter((x) => x.sessionId === sessionId)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
            </div>
          </>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gen-due">{g("dueOn")}</Label>
          <Input
            id="gen-due"
            type="date"
            value={dueOn}
            required
            onChange={(e) => change(setDueOn)(e.target.value)}
          />
        </div>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">{g("classes")}</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {classes.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={classIds.includes(c.id)}
                onChange={(e) =>
                  change(setClassIds)(
                    e.target.checked
                      ? [...classIds, c.id]
                      : classIds.filter((x) => x !== c.id),
                  )
                }
              />
              {c.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant="outline"
          disabled={pending || !classIds.length}
        >
          {pending && !preview ? g("previewing") : g("preview")}
        </Button>
        {preview && preview.invoices > 0 ? (
          <Button type="button" onClick={make} disabled={pending}>
            {pending ? g("making") : g("make", { count: n(preview.invoices) })}
          </Button>
        ) : null}
      </div>
      <div aria-live="polite" data-testid="generate-preview">
        {preview ? (
          <p className="rounded-lg border p-3 text-sm">
            {preview.invoices
              ? g("summary", {
                  invoices: n(preview.invoices),
                  total: money(preview.total),
                  waived: money(preview.waived),
                  skipped: n(preview.skipped),
                })
              : g("none")}
          </p>
        ) : null}
        {made ? (
          <Link
            href={`/${lang}/dashboard/fees`}
            className="text-primary text-sm font-medium hover:underline"
          >
            {g("seeInvoices")}
          </Link>
        ) : null}
      </div>
    </form>
  );
}
