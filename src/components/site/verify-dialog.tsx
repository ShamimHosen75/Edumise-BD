"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ShieldCheck, X } from "lucide-react";

import { VerifyForm } from "@/components/site/verify-form";
import { Button } from "@/components/ui/button";

/** Header button that opens a small "verify a certificate" form. */
export function VerifyDialog({
  lang,
  text,
}: {
  lang: string;
  text: {
    button: string;
    title: string;
    intro: string;
    reference: string;
    check: string;
    close: string;
  };
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button size="sm" variant="secondary" className="h-7">
          <ShieldCheck aria-hidden="true" />
          {/* Icon only on small phones; the name stays for screen readers. */}
          <span className="sr-only sm:not-sr-only">{text.button}</span>
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="bg-background text-foreground fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border p-5 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">
              {text.title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={text.close}
              >
                <X aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-muted-foreground text-sm">
            {text.intro}
          </Dialog.Description>
          <VerifyForm lang={lang} text={text} id="verify-dialog-ref" />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
