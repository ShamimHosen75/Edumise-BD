"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, Menu, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { MenuEntry } from "@/lib/site/menu";

import { NavLink } from "./desktop-nav";

type Props = {
  entries: MenuEntry[];
  labels: { main: string; open: string; close: string };
};

/** Phone and tablet menu: a side sheet (focus stays inside while open) with collapsible groups. */
export function MobileNav({ entries, labels }: Props) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const linkClass = "block rounded-md px-3 py-2.5 text-base hover:bg-accent";

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden">
          <Menu aria-hidden="true" />
          {labels.open}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="bg-background fixed inset-y-0 right-0 z-50 flex w-[min(20rem,90vw)] flex-col shadow-xl outline-none">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <Dialog.Title className="font-semibold">{labels.main}</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label={labels.close}>
                <X aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            {labels.main}
          </Dialog.Description>
          <nav aria-label={labels.main} className="flex-1 overflow-y-auto p-3">
            <ul className="flex flex-col gap-1">
              {entries.map((entry) =>
                entry.children.length === 0 ? (
                  <li key={entry.id}>
                    <NavLink
                      link={entry}
                      className={linkClass}
                      onNavigate={close}
                    />
                  </li>
                ) : (
                  <li key={entry.id}>
                    <details className="group">
                      <summary className="hover:bg-accent flex cursor-pointer list-none items-center justify-between rounded-md px-3 py-2.5 text-base font-medium">
                        {entry.label}
                        <ChevronDown
                          className="size-4 transition-transform group-open:rotate-180"
                          aria-hidden="true"
                        />
                      </summary>
                      <ul className="ml-3 border-l pl-2">
                        {entry.href ? (
                          <li>
                            <NavLink
                              link={entry}
                              className={linkClass}
                              onNavigate={close}
                            />
                          </li>
                        ) : null}
                        {entry.children.map((child) => (
                          <li key={child.id}>
                            <NavLink
                              link={child}
                              className={linkClass}
                              onNavigate={close}
                            />
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                ),
              )}
            </ul>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
