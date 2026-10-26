"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";

import type { TranslationKey } from "@/i18n/t";
import { requireAdmin } from "@/lib/actions";
import { TAGS } from "@/lib/site/cache";
import { fetchAll } from "@/lib/supabase/fetch-all";
import {
  checkImportRows,
  IMPORT_MAX_ROWS,
  type CheckedRow,
} from "@/lib/student-import";
import { assertId } from "@/lib/validation/ids";

type Db = Awaited<ReturnType<typeof requireAdmin>>;
export type ImportResult =
  | { ok: true; rows: CheckedRow[]; imported?: number }
  | { ok: false; error: TranslationKey };

// Rows as read from the file: plain cells only, a bounded number of each.
const rawRows = z
  .array(
    z.record(
      z.string().max(60),
      z.union([z.string().max(300), z.number(), z.boolean(), z.null()]),
    ),
  )
  .max(IMPORT_MAX_ROWS);

/** Checks the rows against the school's sections, rolls and students in that session. */
async function check(db: Db, sessionId: number, rows: unknown) {
  const parsed = rawRows.safeParse(rows);
  if (!parsed.success) return null;
  const [{ data: sections }, enrolled, regs] = await Promise.all([
    db.from("sections").select("id, name_en, class:classes(level)"),
    fetchAll((from, to) =>
      db
        .from("enrollments")
        .select("section_id, roll")
        .eq("session_id", sessionId)
        .order("id")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      db
        .from("students")
        .select("birth_reg_no")
        .not("birth_reg_no", "is", null)
        .order("id")
        .range(from, to),
    ),
  ]);
  return checkImportRows(parsed.data, {
    sections: (sections ?? []).map((s) => ({
      id: s.id,
      name: s.name_en,
      level: (s.class as unknown as { level: number }).level,
    })),
    usedRolls: new Set(
      (enrolled ?? []).map((e) => `${e.section_id}:${e.roll}`),
    ),
    usedBirthRegs: new Set(regs.map((r) => r.birth_reg_no!)),
  });
}

/** Preview: every row with its problems. Nothing is saved. */
export async function previewImport(
  lang: string,
  sessionId: number,
  rows: unknown,
): Promise<ImportResult> {
  assertId(sessionId);
  const db = await requireAdmin(lang);
  const checked = await check(db, sessionId, rows);
  if (!checked) return { ok: false, error: "errors.fileRows" };
  if (checked.length === 0) return { ok: false, error: "errors.fileRows" };
  return { ok: true, rows: checked };
}

/** Saves all rows in one transaction, only when every row is ready. */
export async function commitImport(
  lang: string,
  sessionId: number,
  rows: unknown,
): Promise<ImportResult> {
  assertId(sessionId);
  const db = await requireAdmin(lang);
  const checked = await check(db, sessionId, rows);
  if (!checked || checked.length === 0)
    return { ok: false, error: "errors.fileRows" };
  if (checked.some((r) => !r.row)) return { ok: true, rows: checked };
  const { data, error } = await db.rpc("import_students", {
    p_session_id: sessionId,
    p_rows: checked.map((r) => r.row!),
  });
  // Someone saved a student a moment ago with the same roll or birth registration number.
  if (error?.code === "23505")
    return {
      ok: false,
      error: /birth_reg/.test(error.message)
        ? "errors.birthRegTaken"
        : /roll/.test(error.message)
          ? "errors.rollTaken"
          : "errors.duplicate",
    };
  if (error) return { ok: false, error: "auth.unexpected" };
  revalidateTag(TAGS.stats);
  return { ok: true, rows: checked, imported: data };
}
