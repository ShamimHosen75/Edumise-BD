import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";

import {
  IdCardPdf,
  type IdCardData,
} from "@/components/dashboard/students/id-card-pdf";
import { isLocale } from "@/i18n/config";
import { requireRole } from "@/lib/auth/session";
import { studentDetail } from "@/lib/student-detail";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ lang: string; id: string }> };

/** The student's ID card as a PDF (admins only; layouts do not cover route handlers). */
export async function GET(_request: Request, { params }: Context) {
  const { lang, id: raw } = await params;
  if (!isLocale(lang) || !/^[1-9][0-9]{0,15}$/.test(raw))
    return new Response("Not found", { status: 404 });
  await requireRole(lang, ["super_admin", "admin"]);
  const db = await createClient();
  const detail = await studentDetail(db, Number(raw), "en");
  if (!detail) return new Response("Not found", { status: 404 });
  const { student, current } = detail;
  const [{ data: school }, photo] = await Promise.all([
    db
      .from("school_settings")
      .select("name_en, address_en, phone, primary_color")
      .maybeSingle(),
    student.photo_path
      ? db.storage.from("private-docs").download(student.photo_path)
      : Promise.resolve({ data: null }),
  ]);
  const photoBytes = photo.data
    ? Buffer.from(await photo.data.arrayBuffer())
    : null;
  const card: IdCardData = {
    school: school?.name_en ?? "",
    schoolAddress: school?.address_en ?? "",
    schoolPhone: school?.phone ?? "",
    color: school?.primary_color ?? "#0f766e",
    name: student.full_name_en,
    code: student.student_code,
    className: current?.className ?? "",
    section: current?.section ?? "",
    roll: current ? String(current.roll) : "",
    session: current?.session ?? "",
    bloodGroup: student.blood_group ?? "",
    photo: photoBytes
      ? {
          data: photoBytes,
          format: photoBytes[0] === 0x89 ? "png" : "jpg",
        }
      : null,
    qr: await QRCode.toDataURL(student.student_code, {
      margin: 0,
      errorCorrectionLevel: "M",
    }),
  };
  const pdf = await renderToBuffer(<IdCardPdf card={card} />);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="id-card-${student.student_code}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
