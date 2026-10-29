import { renderToBuffer } from "@react-pdf/renderer";

import { CertificatePdf } from "@/components/certificates/certificate-pdf";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireRole } from "@/lib/auth/session";
import { verifyLink } from "@/lib/certificate-qr";
import { certificateById } from "@/lib/certificates-data";
import { formatDate } from "@/lib/format";
import { sheetHeader } from "@/lib/school";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ lang: string; id: string }> };

/** The certificate as an English PDF (admins; layouts do not cover route handlers). */
export async function GET(_request: Request, { params }: Context) {
  const { lang, id } = await params;
  if (!isLocale(lang) || !/^[1-9][0-9]{0,15}$/.test(id))
    return new Response("Not found", { status: 404 });
  await requireRole(lang, ["super_admin", "admin"]);
  const cert = await certificateById(await createClient(), Number(id));
  if (!cert) return new Response("Not found", { status: 404 });
  const dict = await getDictionary("en");
  const [school, link] = await Promise.all([
    sheetHeader("en", dict),
    verifyLink(cert.reference, "en"),
  ]);
  const pdf = await renderToBuffer(
    <CertificatePdf
      data={{
        school: school.name,
        address: school.address,
        title: dict.certificates.types[cert.type],
        reference: cert.reference,
        date: formatDate(cert.issued_on, "en", "long"),
        body: cert.body_en,
        revoked: cert.revoked_at
          ? `${dict.certificates.revoked} · ${dict.certificates.revokedOn.replace("{date}", formatDate(cert.revoked_at, "en", "medium"))}`
          : null,
        qr: link.qr,
        verifyText: dict.certificates.verifyHint.replace("{url}", link.url),
      }}
    />,
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${cert.reference}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
