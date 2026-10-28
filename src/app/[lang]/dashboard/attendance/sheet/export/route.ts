import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { sheetTable } from "@/lib/attendance-sheet";
import { requireRole } from "@/lib/auth/session";
import { csvFileName } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";
import { toXlsx } from "@/lib/xlsx";

import { loadSheet } from "../data";

/** The monthly sheet as an Excel file (layouts do not cover route handlers). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ lang: string }> },
) {
  const { lang } = await params;
  if (!isLocale(lang)) return new Response("Not found", { status: 404 });
  const me = await requireRole(lang, ["super_admin", "admin", "teacher"]);
  const url = new URL(request.url);
  const dict = await getDictionary(lang);
  const { section, month, sheet } = await loadSheet(
    await createClient(),
    me,
    lang,
    {
      section: url.searchParams.get("section") ?? undefined,
      month: url.searchParams.get("month") ?? undefined,
    },
  );
  if (!section || !sheet) return new Response("Not found", { status: 404 });
  const a = dict.attendance;
  const file = toXlsx(
    `${section.name} ${month}`,
    sheetTable(sheet, {
      roll: a.roll,
      name: a.name,
      codes: a.codes,
      percent: a.percent,
    }),
  );
  const name = csvFileName(`attendance ${section.name} ${month}`).replace(
    /\.csv$/,
    ".xlsx",
  );
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
