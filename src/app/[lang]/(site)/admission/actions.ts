"use server";

import { randomUUID } from "node:crypto";

import { headers } from "next/headers";
import { z } from "zod";

import { isLocale } from "@/i18n/config";
import type { TranslationKey } from "@/i18n/t";
import { normalizeTrackingNo } from "@/lib/admission";
import { createUploadToken, verifyUploadToken } from "@/lib/admission-token";
import { zodFieldErrors, type FieldErrors } from "@/lib/actions";
import {
  detectDocumentType,
  detectImageType,
  imageExtension,
} from "@/lib/files";
import { hitRateLimit } from "@/lib/rate-limit";
import { clientIp, rateKey } from "@/lib/rate-limit-keys";
import { createAdminClient } from "@/lib/supabase/admin";
import { readUpload } from "@/lib/uploads";
import { classUsesGroups } from "@/lib/validation/academic";
import {
  APPLY_LIMIT,
  applicationSchema,
  DOCUMENT_MAX_BYTES,
  PHOTO_MAX_BYTES,
  STATUS_LIMIT,
  statusLookupSchema,
} from "@/lib/validation/admission";

type Failure = { ok: false; error: TranslationKey; fieldErrors?: FieldErrors };
export type SubmitResult =
  | { ok: true; trackingNo: string; submittedAt: string; uploadToken: string }
  | Failure;
export type UploadResult = { ok: true } | Failure;
export type StatusResult =
  | {
      ok: true;
      trackingNo: string;
      status: string;
      class_en: string;
      class_bn: string;
      testAt: string | null;
      testVenue: string;
    }
  | Failure;

// Applicants cannot write the admission tables: this server does it with the service
// role, after validating everything and checking the per-address limit.
const service = () => createAdminClient();
/**
 * Key for signing upload tokens. A separate ADMISSION_TOKEN_SECRET is preferred (it can be
 * rotated on its own); the service-role key is the fallback for existing setups.
 */
const secret = () =>
  z
    .string()
    .min(1)
    .parse(
      process.env.ADMISSION_TOKEN_SECRET ||
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

const UPLOADS_PER_APPLICATION = { max: 8, windowSeconds: 60 * 60 };

async function limited(
  scope: string,
  limit: { max: number; windowSeconds: number },
) {
  return hitRateLimit(rateKey(scope, clientIp(await headers())), limit);
}

/** Saves an application (with the photo) and returns its tracking number. */
export async function submitApplication(
  lang: string,
  formData: FormData,
): Promise<SubmitResult> {
  if (!isLocale(lang)) throw new Error("Invalid language");
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("data") ?? ""));
  } catch {
    return { ok: false, error: "auth.unexpected" };
  }
  const parsed = applicationSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      error: "contact.failed",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  const { website, declaration, ...v } = parsed.data;
  void declaration; // checked by the schema (must be ticked); not stored

  // Honeypot filled in: a bot. Answer like a success and store nothing.
  if (website)
    return {
      ok: true,
      trackingNo: "ADM-0000-00000",
      submittedAt: new Date().toISOString(),
      uploadToken: "",
    };

  const photo = await readUpload(formData, PHOTO_MAX_BYTES, "photo");
  if ("error" in photo)
    return {
      ok: false,
      error: photo.error,
      fieldErrors: { photo: photo.error },
    };
  const photoType = detectImageType(photo.bytes);
  if (photoType !== "image/jpeg" && photoType !== "image/png")
    return {
      ok: false,
      error: "errors.photoType",
      fieldErrors: { photo: "errors.photoType" },
    };

  if (await limited("admission-ip", APPLY_LIMIT))
    return { ok: false, error: "errors.tooManyRequests" };

  const db = service();
  const [{ data: session }, { data: cls }] = await Promise.all([
    db
      .from("academic_sessions")
      .select("id")
      .eq("is_current", true)
      .maybeSingle(),
    db.from("classes").select("id, level").eq("id", v.class_id).maybeSingle(),
  ]);
  if (!session) return { ok: false, error: "admission.closed" };
  if (!cls)
    return {
      ok: false,
      error: "errors.required",
      fieldErrors: { class_id: "errors.required" },
    };
  if (classUsesGroups(cls.level) !== (v.group_id !== null))
    return {
      ok: false,
      error: "errors.groupRequired",
      fieldErrors: { group_id: "errors.groupRequired" },
    };

  const { data: trackingNo, error: counterError } =
    await db.rpc("next_tracking_no");
  if (counterError || !trackingNo)
    return { ok: false, error: "auth.unexpected" };
  const { data: created, error } = await db
    .from("admission_applications")
    .insert({
      ...v,
      tracking_no: trackingNo,
      session_id: session.id,
      religion: v.religion || null,
      blood_group: v.blood_group || null,
      guardian_email: v.guardian_email || null,
    })
    .select("id, submitted_at")
    .single();
  if (error || !created) return { ok: false, error: "auth.unexpected" };

  const photoPath = `admissions/${created.id}/photo-${randomUUID()}.${imageExtension(photoType)}`;
  const { error: uploadError } = await db.storage
    .from("private-docs")
    .upload(photoPath, photo.bytes, { contentType: photoType });
  if (!uploadError)
    await db
      .from("admission_applications")
      .update({ photo_path: photoPath })
      .eq("id", created.id);

  return {
    ok: true,
    trackingNo,
    submittedAt: created.submitted_at,
    uploadToken: createUploadToken(secret(), created.id),
  };
}

const kindSchema = z.enum(["birth_certificate", "transcript"]);

/** Uploads one document for an application just submitted (proved by the token). */
export async function uploadApplicationDocument(
  lang: string,
  token: string,
  kind: string,
  formData: FormData,
): Promise<UploadResult> {
  if (!isLocale(lang)) throw new Error("Invalid language");
  const applicationId = verifyUploadToken(secret(), token);
  const parsedKind = kindSchema.safeParse(kind);
  if (!applicationId || !parsedKind.success)
    return { ok: false, error: "errors.notAllowed" };
  const read = await readUpload(formData, DOCUMENT_MAX_BYTES);
  if ("error" in read) return { ok: false, error: read.error };
  const type = detectDocumentType(read.bytes);
  if (type !== "application/pdf" && type !== "image/jpeg")
    return { ok: false, error: "errors.documentType" };

  // A valid token allows a few uploads per application (two documents, a few retries),
  // and only while the application waits for review.
  if (
    await hitRateLimit(
      rateKey("admission-upload", String(applicationId)),
      UPLOADS_PER_APPLICATION,
    )
  )
    return { ok: false, error: "errors.tooManyRequests" };
  const db = service();
  const { data: application } = await db
    .from("admission_applications")
    .select("status, photo_path")
    .eq("id", applicationId)
    .maybeSingle();
  if (application?.status !== "submitted")
    return { ok: false, error: "errors.notAllowed" };
  const folder = `admissions/${applicationId}/`;
  const path = `${folder}${randomUUID()}.${imageExtension(type)}`;
  const { error: uploadError } = await db.storage
    .from("private-docs")
    .upload(path, read.bytes, { contentType: type });
  if (uploadError) return { ok: false, error: "errors.uploadFailed" };
  const { error } = await db.from("admission_documents").upsert(
    {
      application_id: applicationId,
      kind: parsedKind.data,
      file_path: path,
      mime_type: type,
      file_size: read.bytes.byteLength,
    },
    { onConflict: "application_id,kind" },
  );
  if (error) {
    await db.storage.from("private-docs").remove([path]);
    return { ok: false, error: "auth.unexpected" };
  }
  // Remove every file in the folder that no row points to (replaced documents, and
  // uploads that raced each other).
  const [{ data: files }, { data: docs }] = await Promise.all([
    db.storage.from("private-docs").list(folder.slice(0, -1), { limit: 100 }),
    db
      .from("admission_documents")
      .select("file_path")
      .eq("application_id", applicationId),
  ]);
  const keep = new Set([
    application.photo_path,
    ...(docs ?? []).map((d) => d.file_path),
  ]);
  const orphans = (files ?? [])
    .map((f) => `${folder}${f.name}`)
    .filter((f) => !keep.has(f));
  if (orphans.length) await db.storage.from("private-docs").remove(orphans);
  return { ok: true };
}

/** Status by tracking number + the application's mobile number (both must match). */
export async function checkAdmissionStatus(
  lang: string,
  input: unknown,
): Promise<StatusResult> {
  if (!isLocale(lang)) throw new Error("Invalid language");
  const parsed = statusLookupSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: "contact.failed",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  // Limits guessing other people's applications.
  if (await limited("admission-status-ip", STATUS_LIMIT))
    return { ok: false, error: "errors.tooManyRequests" };
  const trackingNo = normalizeTrackingNo(parsed.data.tracking_no);
  if (!trackingNo) return { ok: false, error: "errors.notFound" };
  const { data } = await service()
    .from("admission_applications")
    .select(
      "tracking_no, status, test_at, test_venue, class:classes(name_en, name_bn)",
    )
    .eq("tracking_no", trackingNo)
    .eq("guardian_phone", parsed.data.phone)
    .maybeSingle();
  if (!data) return { ok: false, error: "errors.notFound" };
  const cls = data.class as unknown as { name_en: string; name_bn: string };
  return {
    ok: true,
    trackingNo: data.tracking_no,
    status: data.status,
    class_en: cls.name_en,
    class_bn: cls.name_bn,
    // The test time is only shown while the test is the next step.
    testAt: data.status === "test_scheduled" ? data.test_at : null,
    testVenue: data.status === "test_scheduled" ? data.test_venue : "",
  };
}
