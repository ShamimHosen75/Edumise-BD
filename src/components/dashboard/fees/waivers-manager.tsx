"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  approveWaiver,
  deleteWaiver,
  saveWaiver,
} from "@/app/[lang]/dashboard/fees/actions";
import { CrudTable } from "@/components/dashboard/academic/crud-table";
import { translator } from "@/components/dashboard/academic/labels";
import {
  SelectField,
  TextField,
} from "@/components/dashboard/content/form-controls";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { toTakaText } from "@/lib/fees";
import type { WaiverRow } from "@/lib/fees-data";
import { formatCurrency, localizeDigits } from "@/lib/format";
import { WAIVER_KINDS, waiverSchema } from "@/lib/validation/fees";

/** Waivers of the current session; admins approve the accountant's. */
export function WaiversManager({
  lang,
  rows,
  heads,
  canApprove,
  messages,
}: {
  lang: Locale;
  rows: WaiverRow[];
  heads: { id: number; name: string }[];
  canApprove: boolean;
  messages: Messages;
}) {
  const tr = translator(messages);
  const w = (key: string, vars?: Record<string, string>) =>
    tr(`fees.waivers.${key}`, vars);
  const router = useRouter();
  const [pending, start] = useTransition();
  const amount = (r: WaiverRow) =>
    r.kind === "percent"
      ? `${localizeDigits(r.value, lang)}%`
      : formatCurrency(r.value, lang);
  const approve = (r: WaiverRow) =>
    start(async () => {
      const result = await approveWaiver(lang, r.id).catch(() => ({
        ok: false as const,
        error: "auth.unexpected" as const,
      }));
      if (!result.ok) return void toast.error(tr(result.error));
      toast.success(w("approvedDone"));
      router.refresh();
    });

  return (
    <CrudTable
      lang={lang}
      entity="fee-waivers"
      tr={tr}
      title={w("title")}
      item={w("item")}
      rows={rows}
      schema={waiverSchema}
      submitRaw
      actions={{
        save: (id, values) => saveWaiver(lang, id, values),
        remove: (id) => deleteWaiver(lang, id),
      }}
      rowName={(r) => r.student}
      initialSort={{ id: "student" }}
      columns={[
        {
          id: "student",
          header: w("student"),
          value: (r) => r.student,
          cell: (r) => (
            <span>
              {r.student}
              <span className="text-muted-foreground block text-xs">
                {localizeDigits(r.studentCode, lang)}
              </span>
            </span>
          ),
        },
        { id: "head", header: w("head"), value: (r) => r.head },
        {
          id: "value",
          header: w("value"),
          value: (r) => r.value,
          cell: amount,
        },
        { id: "reason", header: w("reason"), value: (r) => r.reason },
        {
          id: "status",
          header: w("status"),
          value: (r) => (r.approved ? w("approved") : w("pending")),
          cell: (r) =>
            r.approved ? (
              w("approved")
            ) : (
              <span className="font-medium text-amber-700 dark:text-amber-400">
                {w("pending")}
              </span>
            ),
        },
      ]}
      extraActions={(r) =>
        canApprove && !r.approved ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => approve(r)}
            aria-label={w("approveNamed", { name: r.student })}
          >
            <Check aria-hidden="true" />
            <span className="hidden sm:inline">{w("approve")}</span>
          </Button>
        ) : null
      }
      defaults={(r) => ({
        student_code: r?.studentCode ?? "",
        fee_head_id: r?.feeHeadId ?? heads[0]?.id ?? "",
        kind: r?.kind ?? "percent",
        value: r
          ? r.kind === "percent"
            ? String(r.value)
            : toTakaText(r.value)
          : "",
        reason: r?.reason ?? "",
      })}
      fields={(form) => (
        <>
          <TextField
            form={form}
            t={tr}
            name="student_code"
            label={w("studentCode")}
          />
          <SelectField
            form={form}
            t={tr}
            name="fee_head_id"
            label={w("head")}
            numeric
            options={heads.map((h) => ({ value: h.id, label: h.name }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              form={form}
              t={tr}
              name="kind"
              label={w("kind")}
              options={WAIVER_KINDS.map((k) => ({
                value: k,
                label: w(`kinds.${k}`),
              }))}
            />
            <TextField
              form={form}
              t={tr}
              name="value"
              label={w("value")}
              hint={w("valueHint")}
            />
          </div>
          <TextField form={form} t={tr} name="reason" label={w("reason")} />
        </>
      )}
    />
  );
}
