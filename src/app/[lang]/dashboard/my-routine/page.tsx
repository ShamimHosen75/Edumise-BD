import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TeacherRoutine } from "@/components/routine/teacher-routine";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireRole } from "@/lib/auth/session";
import { pickLocalized } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).routine.myRoutine }
    : {};
}

export default async function MyRoutinePage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const me = await requireRole(lang, ["teacher"]);
  const dict = await getDictionary(lang);
  const db = await createClient();
  const { data: staff } = await db
    .from("staff")
    .select("id, full_name_en, full_name_bn")
    .eq("profile_id", me.id)
    .maybeSingle();
  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-2xl font-semibold">{dict.routine.myRoutine}</h1>
        <p className="text-muted-foreground text-sm">
          {dict.routine.myRoutineIntro}
        </p>
      </div>
      {staff ? (
        <TeacherRoutine
          db={db}
          lang={lang}
          dict={dict}
          staffId={staff.id}
          name={pickLocalized(staff, "full_name", lang)}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          {dict.routine.notTeacher}
        </p>
      )}
    </div>
  );
}
