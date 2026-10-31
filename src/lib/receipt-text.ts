// Small text helpers shared by the receipt page and its PDF (pure, unit tested).

import type { Dictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { toTakaText } from "@/lib/fees";

/** What the receipt's QR code holds, to check a printed copy against the books. */
export const receiptQrPayload = (r: {
  receiptNo: string;
  studentCode: string;
  amount: number;
  paidOn: string;
}) => `${r.receiptNo}|${r.studentCode}|${toTakaText(r.amount)}|${r.paidOn}`;

/** Who received the money: the staff member, or the online gateway. */
export function receiverText(
  r: { collectedBy: string; gateway: string | null },
  dict: Dictionary,
  none = "—",
): string {
  if (r.gateway) {
    const providers = dict.fees.online.providers as Record<string, string>;
    return t(dict, "fees.receipt.onlineVia", {
      provider: providers[r.gateway] ?? r.gateway,
    });
  }
  return r.collectedBy || none;
}

/** Money for the English PDFs, whose fonts have no ৳ sign: "Tk 1,23,456.50". */
export function pdfMoney(poisha: number, currency: string): string {
  const v = (poisha / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${v}`;
}
