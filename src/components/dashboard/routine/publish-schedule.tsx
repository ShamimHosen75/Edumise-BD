"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { setSchedulePublished } from "@/app/[lang]/dashboard/routine/actions";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";

/** Publish or hide an exam's schedule on the website. */
export function PublishSchedule({
  lang,
  examId,
  published,
  labels,
}: {
  lang: Locale;
  examId: number;
  published: boolean;
  labels: {
    published: string;
    notPublished: string;
    publish: string;
    unpublish: string;
    failed: string;
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3" aria-busy={pending}>
      <span
        data-testid="schedule-status"
        className={
          published
            ? "bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs"
            : "bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs"
        }
      >
        {published ? labels.published : labels.notPublished}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await setSchedulePublished(
              lang,
              examId,
              !published,
            ).catch(() => ({ ok: false as const }));
            if (!result.ok) return void toast.error(labels.failed);
            router.refresh();
          })
        }
      >
        {published ? labels.unpublish : labels.publish}
      </Button>
    </div>
  );
}
