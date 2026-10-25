"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveWorkingDays } from "@/app/[lang]/dashboard/academic/actions";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { weekDays } from "@/lib/routine";

import { translator } from "./labels";

const ALL_DAYS = weekDays([0, 1, 2, 3, 4, 5, 6]);

/** Seven tick boxes, Saturday first. */
export function WorkingDaysForm({
  lang,
  value,
  messages,
}: {
  lang: Locale;
  value: number[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const router = useRouter();
  const [days, setDays] = useState(new Set(value));
  const [pending, start] = useTransition();
  const toggle = (d: number) =>
    setDays((cur) => {
      const next = new Set(cur);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  const save = () =>
    start(async () => {
      const result = await saveWorkingDays(lang, [...days]).catch(() => ({
        ok: false as const,
        error: "auth.unexpected" as const,
      }));
      if (!result.ok) return void toast.error(tr(result.error));
      toast.success(tr("academic.saved"));
      router.refresh();
    });

  return (
    <fieldset
      className="flex flex-col gap-3 rounded-xl border p-4"
      aria-busy={pending}
    >
      <legend className="px-1 font-semibold">
        {tr("academic.workingDays")}
      </legend>
      <p className="text-muted-foreground text-xs">
        {tr("academic.workingDaysHint")}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {ALL_DAYS.map((d) => (
          <label key={d} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={days.has(d)}
              onChange={() => toggle(d)}
            />
            {tr(`days.${d}`)}
          </label>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        onClick={save}
        disabled={pending}
      >
        {tr("academic.saveDays")}
      </Button>
    </fieldset>
  );
}
