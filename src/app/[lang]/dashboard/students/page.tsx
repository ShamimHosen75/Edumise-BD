import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  ClassListTable,
  type ClassListRow,
} from "@/components/dashboard/students/class-list-table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { admissionMessages } from "@/lib/admission-messages";
import { pickLocalized } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ section?: string }>;
};

type Named = { name_en: string; name_bn: string };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).students.title }
    : {};
}

export default async function StudentsPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const s = dict.students;
  const db = await createClient();
  const [{ data: session }, { data: sectionRows }] = await Promise.all([
    db
      .from("academic_sessions")
      .select("id, name")
      .eq("is_current", true)
      .maybeSingle(),
    db
      .from("sections")
      .select("id, name_en, name_bn, class:classes(level, name_en, name_bn)"),
  ]);
  const sections = (sectionRows ?? [])
    .map((x) => {
      const c = x.class as unknown as Named & { level: number };
      return {
        id: x.id,
        level: c.level,
        name: `${pickLocalized(c, "name", lang)} ${pickLocalized(x, "name", lang)}`,
      };
    })
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  const wanted = (await searchParams).section;
  const chosen = sections.find((x) => String(x.id) === wanted) ?? sections[0];

  let rows: ClassListRow[] = [];
  if (session && chosen) {
    const { data, error } = await db
      .from("enrollments")
      .select(
        "roll, student:students(id, student_code, full_name_en, full_name_bn, student_guardians(is_primary, guardian:guardians(phone)))",
      )
      .eq("session_id", session.id)
      .eq("section_id", chosen.id);
    if (error) throw new Error(error.message);
    rows = (data ?? []).map((e) => {
      const st = e.student as unknown as {
        id: number;
        student_code: string;
        full_name_en: string;
        full_name_bn: string;
        student_guardians: {
          is_primary: boolean;
          guardian: { phone: string };
        }[];
      };
      return {
        id: st.id,
        roll: e.roll,
        name: pickLocalized(st, "full_name", lang),
        code: st.student_code,
        phone:
          st.student_guardians.find((g) => g.is_primary)?.guardian.phone ?? "",
      };
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{s.classList}</h1>
        <p className="text-muted-foreground text-sm">
          {s.intro} {session ? `(${session.name})` : ""}
        </p>
      </div>
      <form
        action={`/${lang}/dashboard/students`}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="class-list-section">{s.section}</Label>
          <select
            id="class-list-section"
            name="section"
            defaultValue={chosen?.id}
            className="bg-background h-10 rounded-md border px-3 text-sm"
          >
            {sections.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          {dict.admissionsAdmin.filter}
        </Button>
      </form>
      <ClassListTable
        lang={lang}
        title={chosen?.name ?? s.classList}
        rows={rows}
        messages={{
          ...admissionMessages(dict),
          "students.roll": s.roll,
          "students.name": s.name,
          "students.code": s.code,
          "students.guardianPhone": s.guardianPhone,
          "students.none": s.none,
        }}
      />
    </div>
  );
}
