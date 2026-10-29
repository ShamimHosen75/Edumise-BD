import { renderToBuffer } from "@react-pdf/renderer";

import { ReportPdf } from "@/components/dashboard/fees/report-pdf";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireRole } from "@/lib/auth/session";
import { csvFileName } from "@/lib/csv";
import { cellText, reportSheet } from "@/lib/report-table";
import { sheetHeader } from "@/lib/school";
import { createClient } from "@/lib/supabase/server";
import { toXlsx } from "@/lib/xlsx";

import { buildReport, readFilters } from "../load";

const tk = (p: number) =>
  `Tk ${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A fee report as Excel (in the page language) or PDF (English). Staff only. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ lang: string }> },
) {
  const { lang } = await params;
  if (!isLocale(lang)) return new Response("Not found", { status: 404 });
  await requireRole(lang, ["super_admin", "admin", "accountant"]);
  const url = new URL(request.url);
  const pdf = url.searchParams.get("format") === "pdf";
  const outLang = pdf ? "en" : lang;
  const db = await createClient();
  const dict = await getDictionary(outLang);
  const f = await readFilters(db, Object.fromEntries(url.searchParams));
  const report = await buildReport(db, f, outLang, dict);
  if (!report) return new Response("Not found", { status: 404 });
  const when =
    f.kind === "daily"
      ? f.day
      : f.kind === "income"
        ? `${f.from} ${f.to}`
        : (f.period ?? "");
  const name = csvFileName(`fees ${f.kind} ${when}`).replace(/\.csv$/, "");
  if (!pdf) {
    const file = toXlsx(report.title.slice(0, 31), reportSheet(report));
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  const school = await sheetHeader("en", dict);
  const text = (v: string | number, k: "text" | "money" | "number") =>
    cellText(v, k, tk, (n) => String(n));
  const file = await renderToBuffer(
    <ReportPdf
      data={{
        school: school.name,
        title: report.title,
        subtitle: report.subtitle,
        tables: report.tables.map((t) => ({
          caption: t.caption,
          head: t.head,
          right: t.kinds.map((k) => k !== "text"),
          rows: t.rows.map((r) => r.map((v, j) => text(v, t.kinds[j]!))),
          foot: t.foot ? t.foot.map((v, j) => text(v, t.kinds[j]!)) : null,
        })),
      }}
    />,
  );
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
