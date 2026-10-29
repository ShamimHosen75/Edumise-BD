"use server";

import type { TranslationKey } from "@/i18n/t";
import { requireAdmin } from "@/lib/actions";
import { buildResults } from "@/lib/results-build";
import { loadExamInput } from "@/lib/results-input";
import { assertId } from "@/lib/validation/ids";
import { resultRowsSchema } from "@/lib/validation/results";

export type ProcessResult =
  | { ok: true; count: number }
  | { ok: false; error: TranslationKey; count?: number };

/**
 * "Process results": grades every student of the exam with src/lib/grading.ts and saves
 * the rows in one transaction (save_exam_results). Needs the exam in review and every
 * mark entered (or the student marked absent).
 */
export async function processResults(
  lang: string,
  examId: number,
): Promise<ProcessResult> {
  assertId(examId);
  const db = await requireAdmin(lang);
  // Changes made while we read and grade stay "after" this time (results show as stale).
  const asOf = new Date().toISOString();
  const input = await loadExamInput(db, examId);
  if (!input) return { ok: false, error: "errors.notAllowed" };
  if (input.status !== "review")
    return { ok: false, error: "results.processHint" };
  const { rows, missing, needsFourth } = buildResults(input);
  if (missing.length)
    return { ok: false, error: "results.missing", count: missing.length };
  if (needsFourth.length)
    return {
      ok: false,
      error: "results.needsFourth",
      count: needsFourth.length,
    };
  if (!rows.length) return { ok: false, error: "results.none" };
  const parsed = resultRowsSchema.parse(rows);
  const { data, error } = await db.rpc("save_exam_results", {
    p_exam_id: examId,
    p_rows: parsed,
    p_as_of: asOf,
  });
  if (error) return { ok: false, error: "auth.unexpected" };
  return { ok: true, count: data };
}
