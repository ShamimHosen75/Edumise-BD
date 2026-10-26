"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidateTag } from "next/cache";

import { ACADEMIC, duplicateField, isAcademicEntity } from "@/lib/academic";
import {
  dbError,
  invalid,
  requireAdmin,
  type ActionResult,
} from "@/lib/actions";
import { TAGS } from "@/lib/site/cache";
import {
  classSubjectsSchema,
  classUsesGroups,
} from "@/lib/validation/academic";
import { assertId, assertOptionalId } from "@/lib/validation/ids";
import { workingDaysSchema } from "@/lib/validation/routine";

import { checkAcademicSave } from "./checks";

// Class and section counts appear on the public home page; designations on the staff
// directory.
// The routine, exam routine and calendar pages show periods, rooms, holidays and papers.
const refresh = () => {
  revalidateTag(TAGS.stats);
  revalidateTag(TAGS.staff);
  revalidateTag(TAGS.routine);
  revalidateTag(TAGS.calendar);
};

/** Creates (id = null) or updates a session, class, section, group or subject. */
export async function saveAcademic(
  lang: string,
  entity: string,
  id: number | null,
  input: unknown,
): Promise<ActionResult> {
  assertOptionalId(id);
  if (!isAcademicEntity(entity)) throw new Error("Invalid request");
  const supabase = (await requireAdmin(lang)) as unknown as SupabaseClient;
  const { table, schema, unique } = ACADEMIC[entity];
  const parsed = schema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const row = parsed.data as Record<string, unknown>;
  const check = await checkAcademicSave(supabase, entity, id, row);
  if (check) return check;

  const { data, error } =
    id === null
      ? await supabase.from(table).insert(row).select("id").single()
      : await supabase
          .from(table)
          .update(row)
          .eq("id", id)
          .select("id")
          .maybeSingle();
  if (error)
    return dbError(
      error,
      duplicateField(error.message, Object.keys(row), unique),
    );
  if (!data) return { ok: false, error: "errors.notAllowed" };
  refresh();
  return { ok: true, id: data.id as number };
}

export async function deleteAcademic(
  lang: string,
  entity: string,
  id: number,
): Promise<ActionResult> {
  assertId(id);
  if (!isAcademicEntity(entity)) throw new Error("Invalid request");
  const supabase = (await requireAdmin(lang)) as unknown as SupabaseClient;
  if (entity === "sessions") {
    // The current session is in use by definition.
    const { data } = await supabase
      .from("academic_sessions")
      .select("is_current")
      .eq("id", id)
      .maybeSingle();
    if (data?.is_current) return { ok: false, error: "errors.inUse" };
  }
  if (entity === "periods") {
    // Deleting a period would silently take its classes out of every routine.
    const { count } = await supabase
      .from("routine")
      .select("id", { count: "exact", head: true })
      .eq("period_id", id);
    if (count) return { ok: false, error: "errors.inUse" };
  }
  const { data, error } = await supabase
    .from(ACADEMIC[entity].table)
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return dbError(error);
  if (!data.length) return { ok: false, error: "errors.notAllowed" };
  refresh();
  return { ok: true };
}

export async function setCurrentSession(
  lang: string,
  id: number,
): Promise<ActionResult> {
  assertId(id);
  const supabase = await requireAdmin(lang);
  const { data, error } = await supabase.rpc("set_current_session", {
    p_session_id: id,
  });
  if (error) return dbError(error);
  if (data !== true) return { ok: false, error: "errors.notAllowed" };
  // The admission form offers the current session.
  refresh();
  return { ok: true };
}

/** Replaces the subjects of one class (and group, for Classes 9 and 10). */
export async function saveClassSubjects(
  lang: string,
  input: unknown,
): Promise<ActionResult> {
  const supabase = await requireAdmin(lang);
  const parsed = classSubjectsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { class_id, group_id, subject_ids } = parsed.data;

  const { data: cls } = await supabase
    .from("classes")
    .select("level")
    .eq("id", class_id)
    .maybeSingle();
  if (!cls) return { ok: false, error: "errors.notAllowed" };
  if (classUsesGroups(cls.level) !== (group_id !== null))
    return {
      ok: false,
      error: "errors.groupRequired",
      fieldErrors: { group_id: "errors.groupRequired" },
    };

  const scope = () => {
    const q = supabase
      .from("class_subjects")
      .select("id, subject_id")
      .eq("class_id", class_id);
    return group_id === null
      ? q.is("group_id", null)
      : q.eq("group_id", group_id);
  };
  const { data: current, error: readError } = await scope();
  if (readError) return dbError(readError);
  const keep = new Set(subject_ids);
  const have = new Set(current.map((r) => r.subject_id));
  const remove = current
    .filter((r) => !keep.has(r.subject_id))
    .map((r) => r.id);
  const add = subject_ids
    .filter((s) => !have.has(s))
    .map((subject_id) => ({ class_id, group_id, subject_id }));

  // Add first: if adding fails, nothing has been removed.
  if (add.length) {
    const { error } = await supabase.from("class_subjects").insert(add);
    if (error) return dbError(error);
  }
  if (remove.length) {
    const { error } = await supabase
      .from("class_subjects")
      .delete()
      .in("id", remove);
    if (error) return dbError(error);
  }
  return { ok: true };
}

/** The days the school is open (0 = Sunday ... 6 = Saturday). */
export async function saveWorkingDays(
  lang: string,
  input: unknown,
): Promise<ActionResult> {
  const supabase = await requireAdmin(lang);
  const parsed = workingDaysSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { data, error } = await supabase
    .from("school_settings")
    .update({ working_days: [...parsed.data].sort() })
    .eq("id", 1)
    .select("id");
  if (error) return dbError(error);
  if (!data.length) return { ok: false, error: "errors.notAllowed" };
  revalidateTag(TAGS.settings);
  refresh();
  return { ok: true };
}
