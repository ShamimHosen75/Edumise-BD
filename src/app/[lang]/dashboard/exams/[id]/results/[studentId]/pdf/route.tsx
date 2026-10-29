import { isLocale } from "@/i18n/config";
import { requireRole } from "@/lib/auth/session";
import { studentResults } from "@/lib/results-data";
import { markSheetsPdf } from "@/lib/results-pdf";
import { createClient } from "@/lib/supabase/server";

type Context = {
  params: Promise<{ lang: string; id: string; studentId: string }>;
};
const ID = /^[1-9][0-9]{0,15}$/;

/** One student's mark sheet as a PDF (admins; layouts do not cover route handlers). */
export async function GET(_request: Request, { params }: Context) {
  const { lang, id, studentId } = await params;
  if (!isLocale(lang) || !ID.test(id) || !ID.test(studentId))
    return new Response("Not found", { status: 404 });
  await requireRole(lang, ["super_admin", "admin"]);
  const db = await createClient();
  const row = (await studentResults(db, Number(studentId))).find(
    (r) => r.examId === Number(id),
  );
  if (!row) return new Response("Not found", { status: 404 });
  return markSheetsPdf(db, [row], `mark-sheet-${row.studentCode}.pdf`);
}
