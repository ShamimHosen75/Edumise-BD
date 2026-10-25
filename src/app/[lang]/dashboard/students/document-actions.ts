"use server";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  dbError,
  invalid,
  requireAdmin,
  type ActionResult,
} from "@/lib/actions";
import {
  detectDocumentType,
  IMAGE_MAX_BYTES,
  imageExtension,
} from "@/lib/files";
import { removeFiles } from "@/lib/storage-files";
import { readUpload } from "@/lib/uploads";
import { assertId } from "@/lib/validation/ids";

const labelSchema = z.object({
  label: z.string().trim().min(1, "errors.required").max(120, "errors.tooLong"),
});

/** Uploads a private document (PDF, JPG or PNG up to 2 MB) for a student. */
export async function uploadStudentDocument(
  lang: string,
  studentId: number,
  formData: FormData,
): Promise<ActionResult> {
  assertId(studentId);
  const supabase = await requireAdmin(lang);
  const parsed = labelSchema.safeParse({ label: formData.get("label") ?? "" });
  if (!parsed.success) return invalid(parsed.error);
  const read = await readUpload(formData, IMAGE_MAX_BYTES);
  if ("error" in read)
    return { ok: false, error: read.error, fieldErrors: { file: read.error } };
  const type = detectDocumentType(read.bytes);
  if (
    type !== "application/pdf" &&
    type !== "image/jpeg" &&
    type !== "image/png"
  )
    return {
      ok: false,
      error: "errors.documentType",
      fieldErrors: { file: "errors.documentType" },
    };
  const path = `students/${studentId}/${randomUUID()}.${imageExtension(type)}`;
  const { error: uploadError } = await supabase.storage
    .from("private-docs")
    .upload(path, read.bytes, { contentType: type });
  if (uploadError) return { ok: false, error: "errors.uploadFailed" };
  const { error } = await supabase.from("student_documents").insert({
    student_id: studentId,
    label: parsed.data.label,
    file_path: path,
    mime_type: type,
    file_size: read.bytes.byteLength,
  });
  if (error) {
    await removeFiles(
      supabase,
      [path],
      [`students/${studentId}/`],
      "private-docs",
    );
    return dbError(error);
  }
  return { ok: true };
}

export async function removeStudentDocument(
  lang: string,
  studentId: number,
  documentId: number,
): Promise<ActionResult> {
  assertId(studentId);
  assertId(documentId);
  const supabase = await requireAdmin(lang);
  const { data, error } = await supabase
    .from("student_documents")
    .delete()
    .eq("id", documentId)
    .eq("student_id", studentId)
    .select("file_path");
  if (error) return dbError(error);
  const [row] = data;
  if (!row) return { ok: false, error: "errors.notAllowed" };
  await removeFiles(
    supabase,
    [row.file_path],
    [`students/${studentId}/`],
    "private-docs",
  );
  return { ok: true };
}
