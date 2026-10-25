"use server";

import {
  dbError,
  invalid,
  requireAdmin,
  type ActionResult,
} from "@/lib/actions";
import { assertId } from "@/lib/validation/ids";
import { assignmentSchema } from "@/lib/validation/staff";

/** Assigns a teacher to teach a subject in a section for a session. */
export async function addAssignment(
  lang: string,
  staffId: number,
  input: unknown,
): Promise<ActionResult> {
  assertId(staffId);
  const supabase = await requireAdmin(lang);
  const parsed = assignmentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { session_id, section_id, subject_id } = parsed.data;

  // The subject must be taught in the section's class (in any group).
  const { data: section } = await supabase
    .from("sections")
    .select("class_id")
    .eq("id", section_id)
    .maybeSingle();
  if (!section) return { ok: false, error: "errors.notAllowed" };
  const { count } = await supabase
    .from("class_subjects")
    .select("id", { count: "exact", head: true })
    .eq("class_id", section.class_id)
    .eq("subject_id", subject_id);
  if (!count)
    return {
      ok: false,
      error: "errors.notTaught",
      fieldErrors: { subject_id: "errors.notTaught" },
    };

  const { error } = await supabase
    .from("teacher_assignments")
    .insert({ staff_id: staffId, session_id, section_id, subject_id });
  if (error?.code === "23505")
    return {
      ok: false,
      error: "errors.assignmentTaken",
      fieldErrors: { subject_id: "errors.assignmentTaken" },
    };
  if (error) return dbError(error);
  return { ok: true };
}

export async function removeAssignment(
  lang: string,
  id: number,
): Promise<ActionResult> {
  assertId(id);
  const supabase = await requireAdmin(lang);
  const { data, error } = await supabase
    .from("teacher_assignments")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return dbError(error);
  if (!data.length) return { ok: false, error: "errors.notAllowed" };
  return { ok: true };
}
