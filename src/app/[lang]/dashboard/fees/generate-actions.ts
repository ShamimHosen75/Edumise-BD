"use server";

import type { TranslationKey } from "@/i18n/t";
import { requireFeeStaff } from "@/lib/actions";
import { monthKey, oneTimeKey, planSummary } from "@/lib/fees";
import { loadPlan } from "@/lib/fees-data";
import { generateSchema, type GenerateInput } from "@/lib/validation/fees";

type Failure = {
  ok: false;
  error: TranslationKey;
  fieldErrors?: Record<string, TranslationKey>;
};

/** Period key and heads for the generator: every monthly head, or one one-time head. */
async function resolve(
  db: Awaited<ReturnType<typeof requireFeeStaff>>["db"],
  v: GenerateInput,
): Promise<{ periodKey: string; feeHeadIds: number[] } | Failure> {
  const { data: heads } = await db.from("fee_heads").select("id, frequency");
  if (v.kind === "monthly") {
    const { data: session } = await db
      .from("academic_sessions")
      .select("starts_on, ends_on")
      .eq("id", v.session_id)
      .maybeSingle();
    if (!session) return { ok: false, error: "errors.notAllowed" };
    // The month must fall in the session.
    if (
      `${v.month}-31` < session.starts_on ||
      `${v.month}-01` > session.ends_on
    )
      return {
        ok: false,
        error: "errors.month",
        fieldErrors: { month: "errors.month" },
      };
    return {
      periodKey: monthKey(v.month!),
      feeHeadIds: (heads ?? [])
        .filter((h) => h.frequency === "monthly")
        .map((h) => h.id),
    };
  }
  const head = (heads ?? []).find((h) => h.id === v.fee_head_id);
  if (!head || head.frequency !== "one_time")
    return {
      ok: false,
      error: "errors.notAllowed",
      fieldErrors: { fee_head_id: "errors.notAllowed" },
    };
  if (v.exam_id) {
    const { data: exam } = await db
      .from("exams")
      .select("id")
      .eq("id", v.exam_id)
      .eq("session_id", v.session_id)
      .maybeSingle();
    if (!exam) return { ok: false, error: "errors.notAllowed" };
  }
  return {
    periodKey: oneTimeKey(v.session_id, v.exam_id ?? null),
    feeHeadIds: [head.id],
  };
}

export type PreviewResult =
  | {
      ok: true;
      invoices: number;
      total: number;
      waived: number;
      skipped: number;
      /** Waivers of these students and heads still waiting for an admin (not applied). */
      pendingWaivers: number;
      periodKey: string;
    }
  | Failure;

/** How many invoices the generator would make, and their total. Nothing is saved. */
export async function previewInvoices(
  lang: string,
  input: unknown,
): Promise<PreviewResult> {
  const { db } = await requireFeeStaff(lang);
  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "contentAdmin.failed" };
  const r = await resolve(db, parsed.data);
  if ("ok" in r) return r;
  const plan = await loadPlan(db, {
    sessionId: parsed.data.session_id,
    classIds: parsed.data.class_ids,
    ...r,
  });
  return {
    ok: true,
    periodKey: r.periodKey,
    pendingWaivers: plan.pendingWaivers,
    ...planSummary(plan),
  };
}

export type GenerateResult =
  { ok: true; created: number; skipped: number } | Failure;

/** Makes the invoices (again: only what is not billed yet). */
export async function generateInvoices(
  lang: string,
  input: unknown,
): Promise<GenerateResult> {
  const { db } = await requireFeeStaff(lang);
  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "contentAdmin.failed" };
  const r = await resolve(db, parsed.data);
  if ("ok" in r) return r;
  const plan = await loadPlan(db, {
    sessionId: parsed.data.session_id,
    classIds: parsed.data.class_ids,
    ...r,
  });
  const { data, error } = await db.rpc("create_invoices", {
    p_session_id: parsed.data.session_id,
    p_period_key: r.periodKey,
    p_due_on: parsed.data.due_on,
    p_rows: plan.invoices.map((i) => ({
      student_id: i.studentId,
      items: i.items.map((x) => ({
        fee_head_id: x.feeHeadId,
        gross: x.gross,
        waiver: x.waiver,
      })),
    })),
  });
  if (error?.code === "22007") return { ok: false, error: "errors.dueDate" };
  if (error?.code === "22023")
    return { ok: false, error: "fees.generate.changed" };
  if (error) return { ok: false, error: "auth.unexpected" };
  const out = data as { created: number; skipped: number };
  return {
    ok: true,
    created: out.created,
    skipped: out.skipped + plan.skipped,
  };
}
