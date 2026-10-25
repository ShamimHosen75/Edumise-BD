"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/** Shows a new one-time password once, with a copy button. */
export function OneTimePassword({
  password,
  labels,
}: {
  password: string;
  labels: { title: string; hint: string; copy: string; copied: string };
}) {
  return (
    <div role="status" className="bg-muted flex flex-col gap-2 rounded-lg p-3">
      <p className="text-sm font-medium">{labels.title}</p>
      <div className="flex flex-wrap items-center gap-2">
        <code
          data-testid="one-time-password"
          className="bg-background rounded border px-3 py-1.5 font-mono text-lg"
        >
          {password}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            navigator.clipboard
              ?.writeText(password)
              .then(() => toast.success(labels.copied))
              .catch(() => undefined)
          }
        >
          <Copy aria-hidden="true" />
          {labels.copy}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">{labels.hint}</p>
    </div>
  );
}
