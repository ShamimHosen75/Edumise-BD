"use client";

import { Pencil, Plus } from "lucide-react";
import Link from "next/link";

import {
  tableLabels,
  translator,
} from "@/components/dashboard/academic/labels";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { pickLocalized } from "@/lib/format";
import { cn } from "@/lib/utils";

export type StaffListRow = {
  id: number;
  full_name_en: string;
  full_name_bn: string;
  designation_en: string;
  designation_bn: string;
  rank: number;
  subject_en: string;
  subject_bn: string;
  is_current: boolean;
  login: "none" | "active" | "off";
};

/** All staff (current and former) with designation, subject and login status. */
export function StaffTable({
  lang,
  rows,
  messages,
}: {
  lang: Locale;
  rows: StaffListRow[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const base = `/${lang}/dashboard/staff`;
  const name = (r: StaffListRow) => pickLocalized(r, "full_name", lang);
  const designation = (r: StaffListRow) =>
    pickLocalized(r, "designation", lang);
  const status = (r: StaffListRow) =>
    r.is_current ? tr("staff.current") : tr("staff.former");
  const login = (r: StaffListRow) =>
    ({
      none: tr("staff.noLogin"),
      active: tr("staff.loginActive"),
      off: tr("staff.loginOff"),
    })[r.login];
  const designations = [...new Map(rows.map((r) => [r.rank, r])).values()]
    .sort((a, b) => a.rank - b.rank)
    .map((r) => ({ value: designation(r), label: designation(r) }));
  const options = (values: string[]) =>
    values.map((v) => ({ value: v, label: v }));

  return (
    <DataTable
      title={tr("staff.list")}
      csvName="staff"
      data={rows}
      getRowId={(r) => String(r.id)}
      labels={tableLabels(tr, lang)}
      initialSort={{ id: "designation" }}
      pageSize={20}
      toolbar={
        <Link href={`${base}/new`} className={buttonVariants()}>
          <Plus aria-hidden="true" />
          {tr("staff.add")}
        </Link>
      }
      columns={[
        {
          id: "name",
          header: tr("staff.name"),
          value: name,
          cell: (r) => (
            <Link
              href={`${base}/${r.id}`}
              className="font-medium hover:underline"
            >
              {name(r)}
            </Link>
          ),
        },
        {
          id: "designation",
          header: tr("staff.designation"),
          value: designation,
          sortValue: (r) => r.rank,
          filter: designations,
        },
        {
          id: "subject",
          header: tr("staff.subject"),
          value: (r) => pickLocalized(r, "subject", lang),
        },
        {
          id: "status",
          header: tr("staff.status"),
          value: status,
          filter: options([tr("staff.current"), tr("staff.former")]),
        },
        {
          id: "login",
          header: tr("staff.login"),
          value: login,
          filter: options([
            tr("staff.loginActive"),
            tr("staff.loginOff"),
            tr("staff.noLogin"),
          ]),
          cell: (r) => (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                r.login === "active"
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {login(r)}
            </span>
          ),
        },
      ]}
      rowActions={(r) => (
        <Link
          href={`${base}/${r.id}`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
          aria-label={tr("staff.editTitle", { name: name(r) })}
        >
          <Pencil aria-hidden="true" />
          <span className="hidden sm:inline">{tr("staff.edit")}</span>
        </Link>
      )}
    />
  );
}
