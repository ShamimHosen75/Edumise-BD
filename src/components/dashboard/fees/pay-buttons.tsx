"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  sandboxPay,
  startOnlinePayment,
} from "@/app/[lang]/dashboard/payments/actions";
import { translator } from "@/components/dashboard/academic/labels";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";

const failed = { ok: false as const, error: "auth.unexpected" as const };

/** "Pay now": starts an online payment and goes to the gateway. */
export function PayNowButton({
  lang,
  studentId,
  messages,
}: {
  lang: Locale;
  studentId: number;
  messages: Messages;
}) {
  const tr = translator(messages);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        className="w-fit"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await startOnlinePayment(lang, studentId).catch(
              () => failed,
            );
            if (!r.ok) return void toast.error(tr(r.error));
            if ("url" in r) return router.push(r.url);
            setNote(tr("fees.online.payAtOffice"));
          })
        }
      >
        {pending ? tr("fees.online.starting") : tr("fees.online.payNow")}
      </Button>
      {note ? (
        <p role="status" className="text-sm">
          {note}
        </p>
      ) : null}
    </div>
  );
}

/** The sandbox gateway's buttons (test only). */
export function SandboxButtons({
  lang,
  intentId,
  messages,
}: {
  lang: Locale;
  intentId: string;
  messages: Messages;
}) {
  const tr = translator(messages);
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (outcome: "paid" | "failed") =>
    start(async () => {
      const r = await sandboxPay(lang, intentId, outcome).catch(() => failed);
      if (!r.ok) return void toast.error(tr(r.error));
      if ("url" in r) router.push(r.url);
    });
  return (
    <div className="flex flex-wrap gap-3">
      <Button type="button" disabled={pending} onClick={() => go("paid")}>
        {tr("fees.online.sandboxPay")}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => go("failed")}
      >
        {tr("fees.online.sandboxFail")}
      </Button>
    </div>
  );
}
