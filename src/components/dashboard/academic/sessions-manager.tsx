"use client";

import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { setCurrentSession } from "@/app/[lang]/dashboard/academic/actions";
import { TextField } from "@/components/dashboard/content/form-controls";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { formatDate } from "@/lib/format";

import { CrudTable } from "./crud-table";
import { translator } from "./labels";

export type SessionRow = {
  id: number;
  name: string;
  starts_on: string;
  ends_on: string;
  is_current: boolean;
};

export function SessionsManager({
  lang,
  rows,
  messages,
}: {
  lang: Locale;
  rows: SessionRow[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const router = useRouter();
  const [pending, start] = useTransition();
  const status = (r: SessionRow) =>
    r.is_current ? tr("academic.current") : tr("academic.notCurrent");

  return (
    <CrudTable
      lang={lang}
      entity="sessions"
      tr={tr}
      title={tr("academic.sessions")}
      item={tr("academic.item.session")}
      rows={rows}
      rowName={(r) => r.name}
      initialSort={{ id: "starts_on", desc: true }}
      columns={[
        { id: "name", header: tr("academic.name"), value: (r) => r.name },
        {
          id: "starts_on",
          header: tr("academic.startsOn"),
          value: (r) => r.starts_on,
          cell: (r) => formatDate(r.starts_on, lang, "medium"),
        },
        {
          id: "ends_on",
          header: tr("academic.endsOn"),
          value: (r) => r.ends_on,
          cell: (r) => formatDate(r.ends_on, lang, "medium"),
        },
        {
          id: "status",
          header: tr("academic.status"),
          value: status,
          filter: [
            { value: tr("academic.current"), label: tr("academic.current") },
            {
              value: tr("academic.notCurrent"),
              label: tr("academic.notCurrent"),
            },
          ],
          cell: (r) =>
            r.is_current ? (
              <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                {tr("academic.current")}
              </span>
            ) : (
              <span className="text-muted-foreground text-xs">{status(r)}</span>
            ),
        },
      ]}
      defaults={(r) => ({
        name: r?.name ?? "",
        starts_on: r?.starts_on ?? "",
        ends_on: r?.ends_on ?? "",
      })}
      fields={(form) => (
        <>
          <TextField
            form={form}
            t={tr}
            name="name"
            label={tr("academic.name")}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              form={form}
              t={tr}
              type="date"
              name="starts_on"
              label={tr("academic.startsOn")}
            />
            <TextField
              form={form}
              t={tr}
              type="date"
              name="ends_on"
              label={tr("academic.endsOn")}
            />
          </div>
        </>
      )}
      extraActions={(r) =>
        r.is_current ? null : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            aria-label={tr("academic.makeCurrentNamed", { name: r.name })}
            onClick={() =>
              start(async () => {
                const result = await setCurrentSession(lang, r.id).catch(
                  () => ({
                    ok: false as const,
                    error: "auth.unexpected" as const,
                  }),
                );
                if (!result.ok) return void toast.error(tr(result.error));
                toast.success(tr("academic.nowCurrent", { name: r.name }));
                router.refresh();
              })
            }
          >
            <CheckCircle2 aria-hidden="true" />
            <span className="hidden sm:inline">
              {tr("academic.makeCurrent")}
            </span>
          </Button>
        )
      }
    />
  );
}
