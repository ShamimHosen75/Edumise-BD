"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  deleteMessage,
  setMessageRead,
} from "@/app/[lang]/dashboard/messages/actions";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";

type Labels = {
  markRead: string;
  markUnread: string;
  delete: string;
  deleteConfirm: string;
  failed: string;
};

/** Mark as read / unread and delete, for one message. */
export function MessageActions({
  lang,
  id,
  isRead,
  labels,
}: {
  lang: Locale;
  id: number;
  isRead: boolean;
  labels: Labels;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  const run = (action: () => Promise<{ ok: boolean }>, after: () => void) =>
    start(async () => {
      const result = await action().catch(() => ({ ok: false }));
      setError(!result.ok);
      if (result.ok) after();
    });

  return (
    <div className="flex flex-wrap items-center gap-3" aria-busy={pending}>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          run(
            () => setMessageRead(lang, id, !isRead),
            // Opening a message marks it read, so after "unread" go back to the list.
            () =>
              isRead
                ? router.replace(`/${lang}/dashboard/messages`)
                : router.refresh(),
          )
        }
      >
        {isRead ? labels.markUnread : labels.markRead}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="text-destructive"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(labels.deleteConfirm)) return;
          run(
            () => deleteMessage(lang, id),
            () => router.replace(`/${lang}/dashboard/messages`),
          );
        }}
      >
        {labels.delete}
      </Button>
      <p role="status" aria-live="polite" className="text-destructive text-sm">
        {error ? labels.failed : ""}
      </p>
    </div>
  );
}
