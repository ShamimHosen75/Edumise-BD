import "server-only";

import QRCode from "qrcode";

import { getSiteUrl } from "@/lib/site-url";

/** The public verify address of a certificate and its QR code (data URL). */
export async function verifyLink(reference: string, lang: string) {
  const url = `${getSiteUrl()}/${lang}/verify/${reference}`;
  const qr = await QRCode.toDataURL(url, {
    margin: 1,
    errorCorrectionLevel: "M",
  });
  return { url, qr };
}
