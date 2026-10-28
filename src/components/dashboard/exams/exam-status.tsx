"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { setExamStatus } from "@/app/[lang]/dashboard/exams/actions";
import { translator } from "@/components/dashboard/academic/labels";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { EXAM_STATUSES } from "@/lib/validation/marks";

/** The exam's status, what it means, and buttons to move it to another status. */
export function ExamStatus({
  lang,
  examId,
  status,
  messages,
}: {
  lang: Locale;
  examId: number;
  status: (typeof EXAM_STATUSES)[number];
  messages: Messages;
}) {
  const tr = translator(messages);
  const e = (key: string, vars?: Record<string, string>) =>
    tr(`exams.${key}`, vars);
  const router = useRouter();
  const [pending, start] = useTransition();
  const move = (next: string) => {
    if (!window.confirm(e("moveConfirm", { status: e(`statuses.${next}`) })))
      return;
    start(async () => {
      const result = await setExamStatus(lang, examId, next).catch(() => ({
        ok: false as const,
        error: "auth.unexpected" as const,
      }));
      if (!result.ok) return void toast.error(tr(result.error));
      toast.success(e("moved"));
      router.refresh();
    });
  };
  return (
    <section
      aria-labelledby="exam-status"
      className="flex flex-col gap-3 rounded-xl border p-4"
      aria-busy={pending}
    >
      <h2 id="exam-status" className="font-semibold">
        {e("status")}:{" "}
        <span className="text-primary" data-testid="exam-status">
          {e(`statuses.${status}`)}
        </span>
      </h2>
      <p className="text-muted-foreground text-sm">
        {e(`statusHint.${status}`)}
      </p>
      <div className="flex flex-wrap gap-2">
        {EXAM_STATUSES.filter((s) => s !== status).map((s) => (
          <Button
            key={s}
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => move(s)}
          >
            {e("moveTo", { status: e(`statuses.${s}`) })}
          </Button>
        ))}
      </div>
    </section>
  );
}
