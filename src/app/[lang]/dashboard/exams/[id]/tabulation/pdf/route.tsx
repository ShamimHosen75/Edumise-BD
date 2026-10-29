import type { NextRequest } from "next/server";

import { isLocale } from "@/i18n/config";
import { requireRole } from "@/lib/auth/session";
import { examResults } from "@/lib/results-data";
import { markSheetsPdf } from "@/lib/results-pdf";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ lang: string; id: string }> };
const ID = /^[1-9][0-9]{0,15}$/;

/** Every mark sheet of one section in one PDF, by roll (admins). */
export async function GET(request: NextRequest, { params }: Context) {
  const { lang, id } = await params;
  const section = request.nextUrl.searchParams.get("section") ?? "";
  if (!isLocale(lang) || !ID.test(id) || !ID.test(section))
    return new Response("Not found", { status: 404 });
  await requireRole(lang, ["super_admin", "admin"]);
  const db = await createClient();
  const rows = (await examResults(db, Number(id), Number(section))).sort(
    (a, b) => a.roll - b.roll,
  );
  if (!rows.length) return new Response("Not found", { status: 404 });
  return markSheetsPdf(db, rows, `mark-sheets-${id}-${section}.pdf`);
}
