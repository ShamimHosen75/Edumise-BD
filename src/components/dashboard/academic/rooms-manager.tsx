"use client";

import { TextField } from "@/components/dashboard/content/form-controls";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";

import { CrudTable } from "./crud-table";
import { translator } from "./labels";

export type RoomRow = { id: number; name: string };

export function RoomsManager({
  lang,
  rows,
  messages,
}: {
  lang: Locale;
  rows: RoomRow[];
  messages: Messages;
}) {
  const tr = translator(messages);
  return (
    <CrudTable
      lang={lang}
      entity="rooms"
      tr={tr}
      title={tr("academic.rooms")}
      item={tr("academic.item.room")}
      rows={rows}
      rowName={(r) => r.name}
      initialSort={{ id: "name" }}
      columns={[
        { id: "name", header: tr("academic.roomName"), value: (r) => r.name },
      ]}
      defaults={(r) => ({ name: r?.name ?? "" })}
      fields={(form) => (
        <TextField
          form={form}
          t={tr}
          name="name"
          label={tr("academic.roomName")}
        />
      )}
    />
  );
}
