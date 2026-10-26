"use server";

import { randomUUID } from "node:crypto";

import { revalidateTag } from "next/cache";

import {
  dbError,
  invalid,
  requireAdmin,
  type ActionResult,
} from "@/lib/actions";
import { detectImageType, IMAGE_MAX_BYTES, imageExtension } from "@/lib/files";
import { TAGS } from "@/lib/site/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeFiles } from "@/lib/storage-files";
import { readUpload } from "@/lib/uploads";
import { assertId, assertOptionalId } from "@/lib/validation/ids";
import {
  enrollmentSchema,
  newStudentSchema,
  studentSchema,
} from "@/lib/validation/student";

// Student counts on the home page.
const refresh = () => revalidateTag(TAGS.stats);
const folder = (id: number) => `students/${id}/`;
const nul = (v: string) => (v === "" ? null : v);

/** Database errors on student and enrolment rows, with the field they belong to. */
function studentError(error: { code?: string; message?: string } | null) {
  if (error?.code === "23505")
    return /birth_reg/.test(error.message ?? "")
      ? {
          ok: false as const,
          error: "errors.birthRegTaken" as const,
          fieldErrors: { birth_reg_no: "errors.birthRegTaken" as const },
        }
      : /student_id, session_id|enrollments_student_id_session_id/.test(
            error.message ?? "",
          )
        ? { ok: false as const, error: "errors.enrolled" as const }
        : {
            ok: false as const,
            error: "errors.rollTaken" as const,
            fieldErrors: { roll: "errors.rollTaken" as const },
          };
  if (error?.code === "23514")
    return {
      ok: false as const,
      error: "errors.groupClass" as const,
      fieldErrors: { group_id: "errors.groupClass" as const },
    };
  return dbError(error);
}

/**
 * Creates a student and enrols them in the current session (id = null), or updates a
 * student's own record.
 */
export async function saveStudent(
  lang: string,
  id: number | null,
  input: unknown,
): Promise<ActionResult> {
  assertOptionalId(id);
  const supabase = await requireAdmin(lang);
  if (id === null) {
    const parsed = newStudentSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { section_id, roll, group_id, ...student } = parsed.data;
    const { data: session } = await supabase
      .from("academic_sessions")
      .select("id")
      .eq("is_current", true)
      .maybeSingle();
    if (!session) return { ok: false, error: "errors.notAllowed" };
    const { data, error } = await supabase
      .rpc("add_student", {
        p_student: student,
        p_session_id: session.id,
        p_section_id: section_id,
        // The generated types mark these as required numbers; null means "none / next".
        p_group_id: group_id as number,
        p_roll: roll as number,
      })
      .single();
    if (error || !data) return studentError(error);
    refresh();
    return { ok: true, id: data.student_id };
  }
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const { data, error } = await supabase
    .from("students")
    .update({
      ...v,
      religion: v.religion || null,
      blood_group: v.blood_group || null,
      admitted_on: nul(v.admitted_on),
      birth_date: nul(v.birth_date),
      birth_reg_no: nul(v.birth_reg_no),
      address: nul(v.address),
      personal_phone: nul(v.personal_phone),
    })
    .eq("id", id)
    .select("id");
  if (error) return studentError(error);
  if (!data.length) return { ok: false, error: "errors.notAllowed" };
  refresh();
  return { ok: true, id };
}

/**
 * Deletes a student with their enrolments, files and login. A student still referenced
 * elsewhere (fees) is not deleted ("in use"), and then nothing changes.
 */
export async function deleteStudent(
  lang: string,
  id: number,
): Promise<ActionResult> {
  assertId(id);
  const supabase = await requireAdmin(lang);
  const { data: student } = await supabase
    .from("students")
    .select("profile_id, photo_path, student_documents(file_path)")
    .eq("id", id)
    .maybeSingle();
  if (!student) return { ok: false, error: "errors.notAllowed" };
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) return dbError(error);
  // The login goes too, so a new student can never sign in to it (service role, after
  // the admin check; only a student account is removed).
  if (student.profile_id) {
    const service = createAdminClient();
    const { data: profile } = await service
      .from("profiles")
      .select("role")
      .eq("id", student.profile_id)
      .maybeSingle();
    if (profile?.role === "student")
      await service.auth.admin.deleteUser(student.profile_id);
  }
  await removeFiles(
    supabase,
    [student.photo_path, ...student.student_documents.map((d) => d.file_path)],
    [folder(id)],
    "private-docs",
  );
  refresh();
  return { ok: true };
}

/** Enrols the student in a session, or changes the section, group and roll there. */
export async function saveEnrollment(
  lang: string,
  studentId: number,
  input: unknown,
): Promise<ActionResult> {
  assertId(studentId);
  const supabase = await requireAdmin(lang);
  const parsed = enrollmentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const { error } = await supabase
    .from("enrollments")
    .upsert(
      { student_id: studentId, ...v },
      { onConflict: "student_id,session_id" },
    );
  if (error) return studentError(error);
  refresh();
  return { ok: true };
}

/** Student photos are private (children): kept in private-docs, shown by short links. */
export async function uploadStudentPhoto(
  lang: string,
  id: number,
  formData: FormData,
): Promise<ActionResult> {
  assertId(id);
  const supabase = await requireAdmin(lang);
  const read = await readUpload(formData, IMAGE_MAX_BYTES);
  if ("error" in read) return { ok: false, error: read.error };
  const type = detectImageType(read.bytes);
  if (type !== "image/jpeg" && type !== "image/png")
    return { ok: false, error: "errors.photoType" };
  const { data: current } = await supabase
    .from("students")
    .select("photo_path")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { ok: false, error: "errors.notAllowed" };
  const path = `${folder(id)}photo/${randomUUID()}.${imageExtension(type)}`;
  const store = supabase.storage.from("private-docs");
  const { error: uploadError } = await store.upload(path, read.bytes, {
    contentType: type,
  });
  if (uploadError) return { ok: false, error: "errors.uploadFailed" };
  const { error } = await supabase
    .from("students")
    .update({ photo_path: path })
    .eq("id", id);
  if (error) {
    await removeFiles(supabase, [path], [folder(id)], "private-docs");
    return dbError(error);
  }
  // The admission photo stays with the application; only our own uploads are removed.
  await removeFiles(
    supabase,
    [current.photo_path],
    [`${folder(id)}photo/`],
    "private-docs",
  );
  return { ok: true };
}

export async function removeStudentPhoto(
  lang: string,
  id: number,
): Promise<ActionResult> {
  assertId(id);
  const supabase = await requireAdmin(lang);
  const { data: current } = await supabase
    .from("students")
    .select("photo_path")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { ok: false, error: "errors.notAllowed" };
  const { error } = await supabase
    .from("students")
    .update({ photo_path: null })
    .eq("id", id);
  if (error) return dbError(error);
  await removeFiles(
    supabase,
    [current.photo_path],
    [`${folder(id)}photo/`],
    "private-docs",
  );
  return { ok: true };
}
