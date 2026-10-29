"use server";

import { randomInt } from "node:crypto";

import { z } from "zod";

import { isLocale } from "@/i18n/config";
import type { TranslationKey } from "@/i18n/t";
import {
  dbError,
  invalid,
  requireAdmin,
  type ActionResult,
} from "@/lib/actions";
import {
  CERTIFICATE_TYPES,
  issueSchema,
  makeReference,
  revokeSchema,
} from "@/lib/certificates";
import {
  draftCertificate,
  type CertificateStudent,
} from "@/lib/certificates-data";
import { toAsciiDigits } from "@/lib/format";
import { assertId } from "@/lib/validation/ids";

const findSchema = z.object({
  code: z
    .string()
    .transform((v) => toAsciiDigits(v).trim())
    .pipe(z.string().regex(/^\d{10}$/, "errors.studentCode")),
  type: z.enum(CERTIFICATE_TYPES),
});

export type DraftResult =
  | {
      ok: true;
      student: CertificateStudent;
      body_en: string;
      body_bn: string;
    }
  | { ok: false; error: TranslationKey };

/** Finds a student by student ID and drafts the certificate text in both languages. */
export async function findStudentForCertificate(
  lang: string,
  input: unknown,
): Promise<DraftResult> {
  const db = await requireAdmin(lang);
  if (!isLocale(lang)) throw new Error("Invalid language");
  const parsed = findSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "errors.studentCode" };
  const draft = await draftCertificate(
    db,
    parsed.data.code,
    parsed.data.type,
    lang,
  );
  return draft
    ? { ok: true, ...draft }
    : { ok: false, error: "certificates.notFound" };
}

/**
 * Issues a certificate with a new random reference (a clash with an existing one, about
 * 1 in 10^14, is retried). A transfer certificate marks the student as transferred.
 */
export async function issueCertificate(
  lang: string,
  input: unknown,
): Promise<ActionResult & { reference?: string }> {
  const db = await requireAdmin(lang);
  const parsed = issueSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  for (let attempt = 0; attempt < 3; attempt++) {
    const reference = makeReference(v.type, randomInt);
    const { data, error } = await db.rpc("issue_certificate", {
      p_student_id: v.student_id,
      p_type: v.type,
      p_reference: reference,
      p_body_en: v.body_en,
      p_body_bn: v.body_bn,
    });
    if (!error) return { ok: true, id: data, reference };
    if (error.code === "23505") continue;
    if (error.code === "22023")
      return { ok: false, error: "certificates.notFound" };
    return dbError(error);
  }
  return { ok: false, error: "auth.unexpected" };
}

/** Revokes a certificate with a reason; the verify page then shows it as revoked. */
export async function revokeCertificate(
  lang: string,
  id: number,
  input: unknown,
): Promise<ActionResult> {
  assertId(id);
  const db = await requireAdmin(lang);
  const parsed = revokeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { data, error } = await db.rpc("revoke_certificate", {
    p_id: id,
    p_reason: parsed.data.reason,
  });
  if (error) return dbError(error);
  return data ? { ok: true } : { ok: false, error: "errors.notAllowed" };
}
