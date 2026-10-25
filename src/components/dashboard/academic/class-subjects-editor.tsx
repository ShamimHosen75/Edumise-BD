"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveClassSubjects } from "@/app/[lang]/dashboard/academic/actions";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { localizeDigits, pickLocalized } from "@/lib/format";
import { classUsesGroups } from "@/lib/validation/academic";

import { tableLabels, translator } from "./labels";

type Named = { id: number; name_en: string; name_bn: string };
type Mapping = {
  class_id: number;
  group_id: number | null;
  subject_id: number;
};

/** Choose the subjects of a class (and group); below, every class at a glance. */
export function ClassSubjectsEditor({
  lang,
  classes,
  groups,
  subjects,
  mappings,
  messages,
}: {
  lang: Locale;
  classes: (Named & { level: number })[];
  groups: Named[];
  subjects: (Named & { code: string })[];
  mappings: Mapping[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const router = useRouter();
  const [pending, start] = useTransition();
  const name = (row: Named) => pickLocalized(row, "name", lang);
  const [classId, setClassId] = useState(classes[0]?.id ?? 0);
  const cls = classes.find((c) => c.id === classId);
  const usesGroups = cls ? classUsesGroups(cls.level) : false;
  const [groupId, setGroupId] = useState<number | null>(null);
  const activeGroup = usesGroups ? (groupId ?? groups[0]?.id ?? null) : null;

  const saved = useMemo(
    () =>
      new Set(
        mappings
          .filter((m) => m.class_id === classId && m.group_id === activeGroup)
          .map((m) => m.subject_id),
      ),
    [mappings, classId, activeGroup],
  );
  // Ticks start from what is saved and reset when the class or group changes.
  const key = `${classId}-${activeGroup}`;
  const [draft, setDraft] = useState<{ key: string; ids: Set<number> }>({
    key,
    ids: saved,
  });
  const chosen = draft.key === key ? draft.ids : saved;
  const toggle = (id: number) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDraft({ key, ids: next });
  };

  const save = () =>
    start(async () => {
      const result = await saveClassSubjects(lang, {
        class_id: classId,
        group_id: activeGroup,
        subject_ids: [...chosen],
      }).catch(() => ({
        ok: false as const,
        error: "auth.unexpected" as const,
      }));
      if (!result.ok) return void toast.error(tr(result.error));
      toast.success(tr("academic.saved"));
      router.refresh();
    });

  const overview = classes.flatMap((c) =>
    (classUsesGroups(c.level) ? groups : [null]).map((g) => {
      const ids = mappings
        .filter((m) => m.class_id === c.id && m.group_id === (g?.id ?? null))
        .map((m) => m.subject_id);
      return {
        id: `${c.id}-${g?.id ?? 0}`,
        level: c.level,
        className: name(c),
        group: g ? name(g) : "",
        count: ids.length,
        list: subjects
          .filter((s) => ids.includes(s.id))
          .map((s) => s.code)
          .join(", "),
      };
    }),
  );
  const select = "bg-background h-10 rounded-md border px-3 text-sm";

  return (
    <div className="flex flex-col gap-8">
      <section
        aria-labelledby="map-title"
        className="flex max-w-3xl flex-col gap-4 rounded-xl border p-4"
      >
        <h2 id="map-title" className="font-semibold">
          {tr("academic.subjectsList")}
        </h2>
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="map-class">{tr("academic.chooseClass")}</Label>
            <select
              id="map-class"
              className={select}
              value={classId}
              onChange={(e) => setClassId(Number(e.target.value))}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {name(c)}
                </option>
              ))}
            </select>
          </div>
          {usesGroups ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="map-group">{tr("academic.chooseGroup")}</Label>
              <select
                id="map-group"
                className={select}
                value={activeGroup ?? ""}
                onChange={(e) => setGroupId(Number(e.target.value))}
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {name(g)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        <p className="text-muted-foreground text-xs">
          {tr("academic.groupsNote")}
        </p>
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">{tr("academic.subjectsList")}</legend>
          {subjects.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={chosen.has(s.id)}
                onChange={() => toggle(s.id)}
              />
              <span className="font-mono text-xs">{s.code}</span>
              {name(s)}
            </label>
          ))}
        </fieldset>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? tr("dialog.saving") : tr("academic.saveSubjects")}
          </Button>
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {tr("academic.selectedCount", {
              count: localizeDigits(chosen.size, lang),
            })}
          </p>
        </div>
      </section>

      <DataTable
        title={tr("academic.classSubjects")}
        csvName="class-subjects"
        data={overview}
        getRowId={(r) => r.id}
        labels={tableLabels(tr, lang)}
        initialSort={{ id: "class" }}
        pageSize={20}
        columns={[
          {
            id: "class",
            header: tr("academic.class"),
            value: (r) => r.level,
            cell: (r) => r.className,
          },
          { id: "group", header: tr("academic.group"), value: (r) => r.group },
          {
            id: "count",
            header: tr("academic.subjectCount"),
            value: (r) => r.count,
            cell: (r) => localizeDigits(r.count, lang),
          },
          {
            id: "list",
            header: tr("academic.subjectsList"),
            value: (r) => r.list,
            sortable: false,
          },
        ]}
      />
    </div>
  );
}
