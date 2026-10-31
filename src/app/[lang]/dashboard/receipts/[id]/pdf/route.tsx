import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";

import { ReceiptPdf } from "@/components/dashboard/fees/receipt-pdf";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { amountInWordsEn } from "@/lib/amount-words";
import { requireRole } from "@/lib/auth/session";
import { pdfMoney, receiptQrPayload, receiverText } from "@/lib/receipt-text";
import { receiptById } from "@/lib/receipts-data";
import { formatDate, formatDateTime } from "@/lib/format";
import { sheetHeader } from "@/lib/school";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ lang: string; id: string }> };

/** Money in the PDF: "Tk 1,200.00" (the PDF fonts have no ৳ sign). */
/** The receipt as an English PDF (staff and the family; RLS decides). */
export async function GET(_request: Request, { params }: Context) {
  const { lang, id } = await params;
  if (!isLocale(lang) || !/^[1-9][0-9]{0,15}$/.test(id))
    return new Response("Not found", { status: 404 });
  await requireRole(lang, [
    "super_admin",
    "admin",
    "accountant",
    "student",
    "guardian",
  ]);
  const r = await receiptById(await createClient(), Number(id), "en");
  if (!r) return new Response("Not found", { status: 404 });
  const dict = await getDictionary("en");
  const v = dict.fees.receipt;
  const tk = (p: number) => pdfMoney(p, v.currency);
  const i = dict.fees.invoices;
  const [school, qr] = await Promise.all([
    sheetHeader("en", dict),
    QRCode.toDataURL(receiptQrPayload(r), {
      margin: 1,
      errorCorrectionLevel: "M",
    }),
  ]);
  const pdf = await renderToBuffer(
    <ReceiptPdf
      data={{
        school: school.name,
        address: school.address,
        title: v.title,
        facts: [
          [v.receiptNo, r.receiptNo],
          [v.date, formatDate(r.paidOn, "en", "medium")],
          [i.student, `${r.student} (${r.studentCode})`],
          ...(r.section
            ? [
                [
                  v.class,
                  `${r.section}${r.roll !== null ? ` · ${i.roll} ${r.roll}` : ""}`,
                ] as [string, string],
              ]
            : []),
          [
            v.method,
            `${dict.fees.methods[r.method]}${r.txnId ? ` · ${r.txnId}` : ""}`,
          ],
          [v.collectedBy, receiverText(r, dict, "-")],
        ],
        head: [i.invoiceNo, i.head, i.period, v.amount],
        lines: r.lines.map((l) => [
          l.invoiceNo,
          l.head,
          l.period || "-",
          tk(l.amount),
        ]),
        total: [v.total, tk(r.amount)],
        due: [v.dueNow, tk(r.dueNow)],
        words: `${v.inWords}: ${amountInWordsEn(r.amount)}`,
        cancelled: r.cancelled
          ? `${v.cancelled} · ${formatDateTime(r.cancelled.at, "en")} · ${r.cancelled.reason}`
          : null,
        signature: v.signature,
        qr,
      }}
    />,
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${r.receiptNo}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
