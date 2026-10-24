"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createMenuItem,
  deleteMenuItem,
  moveMenuItem,
  updateMenuItem,
} from "@/app/[lang]/dashboard/menu/actions";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import { msg, type Messages } from "@/i18n/messages";
import type { MenuItemInput } from "@/lib/validation/page";

import { MenuItemForm, type PageOption } from "./menu-item-form";

export type BuilderItem = {
  id: number;
  parent_id: number | null;
  label: string;
  values: MenuItemInput;
  linkText: string;
  hidden: boolean;
  shown: boolean;
};

type Props = {
  lang: Locale;
  items: BuilderItem[];
  pages: PageOption[];
  messages: Messages;
};

const fill = (s: string, name: string) => s.replace("{name}", name);
const blank = (parent_id: number | null): MenuItemInput => ({
  parent_id,
  label_en: "",
  label_bn: "",
  link_type: parent_id === null ? "none" : "page",
  page_id: null,
  url: "",
  is_hidden: false,
});

/** Tree editor for the two-level website menu. */
export function MenuBuilder({ lang, items, pages, messages }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const m = (key: string) => msg(messages, key)!;

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const result = await fn();
      setStatus(
        result.ok ? m("cms.menuSaved") : m(result.error ?? "auth.unexpected"),
      );
      if (result.ok) router.refresh();
    });
  const save =
    (
      fn: () => Promise<{
        ok: boolean;
        error?: string;
        fieldErrors?: Record<string, string>;
      }>,
    ) =>
    async () => {
      const result = await fn();
      if (result.ok) {
        setEditing(null);
        setStatus(m("cms.menuSaved"));
        router.refresh();
      }
      return result;
    };

  const tops = items.filter((i) => i.parent_id === null);

  const row = (item: BuilderItem, siblings: BuilderItem[], index: number) => (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <div className="min-w-0 flex-1">
        <p
          className="font-medium"
          data-menu-level={item.parent_id === null ? "top" : "child"}
        >
          {item.label}
        </p>
        <p className="text-muted-foreground truncate text-xs">
          {item.linkText}
        </p>
      </div>
      {item.hidden ? (
        <span className="bg-muted rounded-full px-2 py-0.5 text-xs">
          {m("cms.hidden")}
        </span>
      ) : null}
      {!item.hidden && !item.shown ? (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
          {m("cms.notShown")}
        </span>
      ) : null}
      <div className="flex gap-1">
        <Button
          size="icon"
          variant="ghost"
          aria-label={fill(m("cms.editItem"), item.label)}
          onClick={() => setEditing(`edit-${item.id}`)}
        >
          <Pencil aria-hidden="true" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          disabled={pending || index === 0}
          aria-label={fill(m("cms.moveUp"), item.label)}
          onClick={() => act(() => moveMenuItem(lang, item.id, "up"))}
        >
          <ArrowUp aria-hidden="true" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          disabled={pending || index === siblings.length - 1}
          aria-label={fill(m("cms.moveDown"), item.label)}
          onClick={() => act(() => moveMenuItem(lang, item.id, "down"))}
        >
          <ArrowDown aria-hidden="true" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="text-destructive"
          disabled={pending}
          aria-label={fill(m("cms.deleteItem"), item.label)}
          onClick={() =>
            window.confirm(m("cms.deleteItemConfirm")) &&
            act(() => deleteMenuItem(lang, item.id))
          }
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
      {editing === `edit-${item.id}` ? (
        <div className="w-full">
          <MenuItemForm
            idPrefix={`edit-${item.id}`}
            defaults={item.values}
            pages={pages}
            messages={messages}
            onCancel={() => setEditing(null)}
            onSubmit={(values) =>
              save(() => updateMenuItem(lang, item.id, values))()
            }
          />
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="flex max-w-3xl flex-col gap-4" aria-busy={pending}>
      <ol className="flex flex-col gap-3">
        {tops.map((top, i) => {
          const children = items.filter((c) => c.parent_id === top.id);
          return (
            <li key={top.id} className="bg-card rounded-xl border px-4">
              {row(top, tops, i)}
              {children.length > 0 ? (
                <ol className="ml-4 border-l pl-4">
                  {children.map((child, j) => (
                    <li key={child.id} className="border-t first:border-t-0">
                      {row(child, children, j)}
                    </li>
                  ))}
                </ol>
              ) : null}
              <div className="pb-3">
                {editing === `add-${top.id}` ? (
                  <MenuItemForm
                    idPrefix={`add-${top.id}`}
                    defaults={blank(top.id)}
                    pages={pages}
                    messages={messages}
                    onCancel={() => setEditing(null)}
                    onSubmit={(values) =>
                      save(() => createMenuItem(lang, values))()
                    }
                  />
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(`add-${top.id}`)}
                  >
                    <Plus aria-hidden="true" />
                    {m("cms.addChild")}
                    <span className="sr-only">: {top.label}</span>
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {editing === "add-top" ? (
        <MenuItemForm
          idPrefix="add-top"
          defaults={blank(null)}
          pages={pages}
          messages={messages}
          onCancel={() => setEditing(null)}
          onSubmit={(values) => save(() => createMenuItem(lang, values))()}
        />
      ) : (
        <div>
          <Button variant="outline" onClick={() => setEditing("add-top")}>
            <Plus aria-hidden="true" />
            {m("cms.addTopLevel")}
          </Button>
        </div>
      )}
      <p role="status" aria-live="polite" className="text-sm">
        {status}
      </p>
    </div>
  );
}
