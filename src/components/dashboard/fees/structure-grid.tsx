"use client";

import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  copyStructure,
  saveStructure,
} from "@/app/[lang]/dashboard/fees/actions";
import { translator } from "@/components/dashboard/academic/labels";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { toPoisha, toTakaText, type Structure } from "@/lib/fees";
import type { FeeHeadRow, GridRow } from "@/lib/fees-data";
import { pickLocalized } from "@/lib/format";
import { cn } from "@/lib/utils";

const key = (classId: number, groupId: number | null, headId: number) =>
  `${classId}:${groupId ?? ""}:${headId}`;

/** Class (and group) × fee head amounts in taka for one session. */
export function StructureGrid({
  lang,
  session,
  previous,
  rows,
  heads,
  cells,
  messages,
}: {
  lang: Locale;
  session: { id: number; name: string };
  /** The session before this one, to copy from. */
  previous: { id: number; name: string } | null;
  rows: GridRow[];
  heads: FeeHeadRow[];
  cells: Structure[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const s = (k: string, vars?: Record<string, string>) =>
    tr(`fees.structure.${k}`, vars);
  const router = useRouter();
  const [pending, start] = useTransition();
  const initial = useMemo(
    () =>
      new Map(
        cells.map((c) => [
          key(c.classId, c.groupId, c.feeHeadId),
          toTakaText(c.amount),
        ]),
      ),
    [cells],
  );
  const [values, setValues] = useState<Map<string, string>>(
    () => new Map(initial),
  );
  const changed = [...values].filter(([k, v]) => (initial.get(k) ?? "") !== v);
  const bad = (v: string) => v.trim() !== "" && toPoisha(v) === null;

  const save = () =>
    start(async () => {
      const result = await saveStructure(lang, {
        session_id: session.id,
        cells: changed.map(([k, v]) => {
          const [classId, groupId, headId] = k.split(":");
          return {
            class_id: Number(classId),
            group_id: groupId ? Number(groupId) : null,
            fee_head_id: Number(headId),
            amount: v.trim(),
          };
        }),
      }).catch(() => ({
        ok: false as const,
        error: "auth.unexpected" as const,
      }));
      if (!result.ok) return void toast.error(tr(result.error));
      toast.success(s("saved"));
      router.refresh();
    });

  const copy = () => {
    if (!previous) return;
    if (
      !window.confirm(
        s("copyConfirm", { from: previous.name, to: session.name }),
      )
    )
      return;
    start(async () => {
      const result = await copyStructure(lang, previous.id, session.id).catch(
        () => ({
          ok: false as const,
          error: "auth.unexpected" as const,
          copied: 0,
        }),
      );
      if (!result.ok) return void toast.error(tr(result.error));
      toast.success(s("copied", { count: String(result.copied ?? 0) }));
      router.refresh();
    });
  };

  if (!heads.length)
    return <p className="rounded-xl border p-4 text-sm">{s("noHeads")}</p>;
  const cell = "border-t px-2 py-1.5";
  return (
    <div className="flex flex-col gap-3" aria-busy={pending}>
      {previous ? (
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={copy}
          disabled={pending}
        >
          <Copy aria-hidden="true" />
          {s("copy", { session: previous.name })}
        </Button>
      ) : null}
      <div
        role="region"
        tabIndex={0}
        aria-label={`${s("title")} ${session.name}`}
        className="focus-visible:ring-ring overflow-x-auto rounded-xl border outline-none focus-visible:ring-2"
      >
        <table className="w-full text-sm" data-testid="fee-structure">
          <caption className="sr-only">{`${s("title")} ${session.name}`}</caption>
          <thead className="bg-muted text-left">
            <tr>
              <th scope="col" className="bg-muted sticky left-0 px-2 py-2">
                {s("class")}
              </th>
              {heads.map((h) => (
                <th
                  key={h.id}
                  scope="col"
                  className="px-2 py-2 whitespace-nowrap"
                >
                  {pickLocalized(h, "name", lang)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.classId}-${r.groupId ?? ""}`}>
                <th
                  scope="row"
                  className={cn(
                    cell,
                    "bg-background sticky left-0 text-left font-normal whitespace-nowrap",
                    r.groupId !== null && "text-muted-foreground pl-5",
                  )}
                >
                  {r.label}
                </th>
                {heads.map((h) => {
                  const k = key(r.classId, r.groupId, h.id);
                  const v = values.get(k) ?? "";
                  return (
                    <td key={h.id} className={cell}>
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={v}
                        aria-label={s("cellLabel", {
                          head: pickLocalized(h, "name", lang),
                          row: r.label,
                        })}
                        aria-invalid={bad(v) ? true : undefined}
                        onChange={(e) =>
                          setValues((cur) =>
                            new Map(cur).set(k, e.target.value),
                          )
                        }
                        className={cn(
                          "bg-background h-9 w-24 rounded-md border px-2 text-right",
                          bad(v) &&
                            "border-destructive ring-destructive/30 ring-2",
                        )}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground text-xs">{s("groupHint")}</p>
      <div className="bg-background sticky bottom-0 flex items-center gap-3 border-t py-3">
        <Button
          type="button"
          onClick={save}
          disabled={
            pending || !changed.length || changed.some(([, v]) => bad(v))
          }
        >
          {pending ? s("saving") : s("save")}
        </Button>
        {changed.length ? (
          <span className="text-muted-foreground text-sm" role="status">
            {s("unsaved")}
          </span>
        ) : null}
      </div>
    </div>
  );
}
