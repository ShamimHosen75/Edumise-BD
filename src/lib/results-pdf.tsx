import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";

import {
  MarkSheetsPdf,
  type PdfSheet,
} from "@/components/results/mark-sheet-pdf";
import { getDictionary } from "@/i18n/get-dictionary";
import type { ResultRecord } from "@/lib/results-data";
import { sheetHeader } from "@/lib/school";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Mark sheets as one PDF (English), photos included. */
export async function markSheetsPdf(
  db: Client,
  rows: ResultRecord[],
  filename: string,
): Promise<Response> {
  const dict = await getDictionary("en");
  const school = await sheetHeader("en", dict);
  const sheets: PdfSheet[] = await Promise.all(
    rows.map(async (r) => {
      const file = r.photoPath
        ? (await db.storage.from("private-docs").download(r.photoPath)).data
        : null;
      const data = file ? Buffer.from(await file.arrayBuffer()) : null;
      return {
        ...r,
        photo: data
          ? {
              data,
              format: data[0] === 0x89 ? ("png" as const) : ("jpg" as const),
            }
          : null,
      };
    }),
  );
  const pdf = await renderToBuffer(
    <MarkSheetsPdf
      sheets={sheets}
      school={school}
      t={{ ...dict.results, studentId: dict.students.code }}
    />,
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
