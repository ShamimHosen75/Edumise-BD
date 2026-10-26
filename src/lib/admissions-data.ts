import "server-only";

import type { Locale } from "@/i18n/config";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { pickLocalized } from "@/lib/format";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type Named = { name_en: string; name_bn: string };
const one = <T>(v: unknown) => v as T;

export type QueueRow = {
  id: number;
  tracking_no: string;
  student: string;
  class_name: string;
  level: number;
  status: string;
  phone: string;
  submitted_at: string;
  test_marks: number | null;
};

/** Applications for the queue, newest first, optionally between two dates (Dhaka). */
export async function admissionQueue(
  db: Client,
  lang: Locale,
  range: { from?: string; to?: string; classId?: number; sessionId?: number },
): Promise<QueueRow[]> {
  const data = await fetchAll((from, to) => {
    let query = db
      .from("admission_applications")
      .select(
        "id, tracking_no, student_name_en, student_name_bn, status, guardian_phone, submitted_at, test_marks, class:classes(level, name_en, name_bn)",
      );
    if (range.classId) query = query.eq("class_id", range.classId);
    if (range.sessionId) query = query.eq("session_id", range.sessionId);
    if (range.from)
      query = query.gte("submitted_at", `${range.from}T00:00:00+06:00`);
    if (range.to)
      query = query.lte("submitted_at", `${range.to}T23:59:59.999+06:00`);
    return query
      .order("submitted_at", { ascending: false })
      .order("id")
      .range(from, to);
  }, 5000);
  return data.map((a) => {
    const cls = one<Named & { level: number }>(a.class);
    return {
      id: a.id,
      tracking_no: a.tracking_no,
      student: pickLocalized(
        { name_en: a.student_name_en, name_bn: a.student_name_bn },
        "name",
        lang,
      ),
      class_name: pickLocalized(cls, "name", lang),
      level: cls.level,
      status: a.status,
      phone: a.guardian_phone,
      submitted_at: a.submitted_at,
      test_marks: a.test_marks === null ? null : Number(a.test_marks),
    };
  });
}

/** One application with its documents (as short-lived links), sections and result. */
export async function admissionDetail(db: Client, id: number, lang: Locale) {
  const { data: app } = await db
    .from("admission_applications")
    .select(
      "*, class:classes(id, level, name_en, name_bn), group:groups(name_en, name_bn), session:academic_sessions(name), documents:admission_documents(kind, file_path, mime_type, file_size)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!app) return null;
  const cls = one<Named & { id: number; level: number }>(app.class);
  const store = db.storage.from("private-docs");
  // Private files: links valid for 10 minutes, made for this admin's request only.
  const link = async (path: string | null) =>
    path
      ? ((await store.createSignedUrl(path, 600)).data?.signedUrl ?? null)
      : null;
  const documents = await Promise.all(
    one<
      {
        kind: string;
        file_path: string;
        mime_type: string;
        file_size: number;
      }[]
    >(app.documents).map(async (d) => ({ ...d, url: await link(d.file_path) })),
  );
  const [{ data: sections }, { data: enrollment }] = await Promise.all([
    db
      .from("sections")
      .select("id, name_en, name_bn")
      .eq("class_id", cls.id)
      .order("name_en"),
    app.student_id
      ? db
          .from("students")
          .select(
            "student_code, enrollments(roll, section:sections(name_en, name_bn))",
          )
          .eq("id", app.student_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    app,
    className: pickLocalized(cls, "name", lang),
    groupName: app.group
      ? pickLocalized(one<Named>(app.group), "name", lang)
      : "",
    sessionName: one<{ name: string }>(app.session).name,
    photoUrl: await link(app.photo_path),
    documents,
    sections: (sections ?? []).map((s) => ({
      id: s.id,
      name: `${pickLocalized(cls, "name", lang)} ${pickLocalized(s, "name", lang)}`,
    })),
    studentCode:
      (enrollment as { student_code: string } | null)?.student_code ?? null,
  };
}

/** Classes for the merit list choice. */
export async function classOptions(db: Client, lang: Locale) {
  const { data } = await db
    .from("classes")
    .select("id, name_en, name_bn")
    .order("level");
  return (data ?? []).map((c) => ({
    id: c.id,
    name: pickLocalized(c, "name", lang),
  }));
}
