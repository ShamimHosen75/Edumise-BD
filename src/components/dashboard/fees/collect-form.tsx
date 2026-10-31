"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { recordPayment } from "@/app/[lang]/dashboard/fees/collect/actions";
import { translator } from "@/components/dashboard/academic/labels";
import { DueItemList } from "@/components/dashboard/fees/due-item-list";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import {
  allocate,
  inPlay,
  needsTxn,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/collection";
import type { CollectItem } from "@/lib/collection-data";
import { toPoisha, toTakaText } from "@/lib/fees";
import { formatCurrency } from "@/lib/format";

const select = "bg-background h-10 rounded-md border px-3 text-sm";

/** Tick what is paid, type the amount and method: preview where it goes, then save. */
export function CollectForm({
  lang,
  studentId,
  items,
  messages,
}: {
  lang: Locale;
  studentId: number;
  items: CollectItem[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ticked, setTicked] = useState<Set<number>>(
    () => new Set(items.filter((i) => !i.isFine).map((i) => i.id)),
  );
  const chosen = useMemo(() => inPlay(items, ticked), [items, ticked]);
  const owed = chosen.reduce((s, i) => s + i.outstanding, 0);
  const [amount, setAmount] = useState(toTakaText(owed));
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [txn, setTxn] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const money = (p: number) => formatCurrency(p, lang);
  const poisha = toPoisha(amount);
  const plan = poisha === null ? null : allocate(poisha, chosen);
  const amountError =
    errors.amount ??
    (amount.trim() && (poisha === null || poisha === 0)
      ? tr("errors.money")
      : plan && !plan.ok && plan.reason === "over"
        ? tr("fees.collect.errors.over")
        : undefined);

  function tick(id: number, on: boolean) {
    const next = new Set(ticked);
    if (on) next.add(id);
    else next.delete(id);
    setTicked(next);
    setAmount(
      toTakaText(inPlay(items, next).reduce((s, i) => s + i.outstanding, 0)),
    );
    setErrors({});
  }

  const byId = new Map(items.map((i) => [i.id, i]));
  return (
    <form
      className="flex flex-col gap-4"
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        if (!chosen.length)
          return toast.error(tr("fees.collect.errors.noItems"));
        if (amountError) return;
        if (
          !window.confirm(
            tr("fees.collect.confirm", { amount: money(poisha ?? 0) }),
          )
        )
          return;
        start(async () => {
          const r = await recordPayment(lang, {
            student_id: studentId,
            item_ids: chosen.filter((i) => !i.live).map((i) => i.id),
            amount,
            method,
            txn_id: txn,
            expected: owed,
            note,
          }).catch(() => ({
            ok: false as const,
            error: "auth.unexpected" as const,
            fieldErrors: undefined,
          }));
          if (!r.ok) {
            const fields = Object.entries(r.fieldErrors ?? {});
            setErrors(Object.fromEntries(fields.map(([k, v]) => [k, tr(v)])));
            if (!fields.length) toast.error(tr(r.error));
            if (r.error === "fees.collect.errors.changed") router.refresh();
            return;
          }
          toast.success(tr("fees.collect.saved"));
          router.push(`/${lang}/dashboard/receipts/${r.id}`);
        });
      }}
    >
      <DueItemList
        lang={lang}
        items={items}
        ticked={ticked}
        chosen={chosen}
        onTick={tick}
        tr={tr}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormField
          id="pay-amount"
          label={tr("fees.collect.amount")}
          hint={tr("fees.collect.owed", { amount: money(owed) })}
          error={amountError}
        >
          {(aria) => (
            <Input
              {...aria}
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setErrors({});
              }}
            />
          )}
        </FormField>
        <FormField id="pay-method" label={tr("fees.collect.method")}>
          {(aria) => (
            <select
              {...aria}
              className={select}
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {tr(`fees.methods.${m}`)}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField
          id="pay-txn"
          label={tr(
            needsTxn(method) ? "fees.collect.txnRequired" : "fees.collect.txn",
          )}
          error={errors.txn_id}
        >
          {(aria) => (
            <Input
              {...aria}
              autoComplete="off"
              aria-required={needsTxn(method)}
              value={txn}
              onChange={(e) => setTxn(e.target.value)}
            />
          )}
        </FormField>
        <FormField
          id="pay-note"
          label={tr("fees.collect.note")}
          error={errors.note}
        >
          {(aria) => (
            <Input
              {...aria}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </FormField>
      </div>
      {plan?.ok ? (
        <div
          className="rounded-lg border p-3 text-sm"
          data-testid="allocation-preview"
          aria-live="polite"
        >
          <p className="font-medium">{tr("fees.collect.goesTo")}</p>
          <ul className="mt-1 list-disc ps-5">
            {plan.lines.map((l) => {
              const item = byId.get(l.id)!;
              return (
                <li key={l.id}>
                  {item.invoiceNo} · {item.head}
                  {item.period ? ` (${item.period})` : ""}: {money(l.amount)}
                </li>
              );
            })}
          </ul>
          <p className="text-muted-foreground mt-1">
            {tr("fees.collect.leftDue", {
              amount: money(owed - (poisha ?? 0)),
            })}
          </p>
        </div>
      ) : null}
      <Button
        type="submit"
        className="w-fit"
        disabled={
          pending || !chosen.length || Boolean(amountError) || !plan?.ok
        }
      >
        {pending ? tr("fees.collect.saving") : tr("fees.collect.save")}
      </Button>
    </form>
  );
}
