import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  removeStaffPhoto,
  uploadStaffPhoto,
} from "@/app/[lang]/dashboard/staff/actions";
import { ContentFile } from "@/components/dashboard/content/content-file";
import { StaffAssignments } from "@/components/dashboard/staff/staff-assignments";
import { StaffForm } from "@/components/dashboard/staff/staff-form";
import { StaffLogin } from "@/components/dashboard/staff/staff-login";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { requireRole } from "@/lib/auth/session";
import { pickLocalized } from "@/lib/format";
import { designations, staffDetail } from "@/lib/staff-data";
import { staffMessages } from "@/lib/staff-messages";
import { createClient } from "@/lib/supabase/server";
import { publicMediaUrl } from "@/lib/supabase/public";
import { staffFormValues } from "@/lib/validation/staff";

type Props = { params: Promise<{ lang: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).staff.title }
    : {};
}

export default async function EditStaffPage({ params }: Props) {
  const { lang, id: raw } = await params;
  const id = /^[1-9][0-9]{0,15}$/.test(raw) ? Number(raw) : null;
  if (!isLocale(lang) || id === null) notFound();
  const me = await requireRole(lang, ["super_admin", "admin"]);
  const dict = await getDictionary(lang);
  const db = await createClient();
  const [detail, designationList] = await Promise.all([
    staffDetail(db, id, lang),
    designations(db),
  ]);
  if (!detail) notFound();
  const { staff } = detail;
  const name = pickLocalized(staff, "full_name", lang);
  const messages = staffMessages(dict);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">
        {t(dict, "staff.editTitle", { name })}
      </h1>
      <StaffForm
        lang={lang}
        id={id}
        defaults={staffFormValues(staff, detail.private)}
        designations={designationList}
        messages={messages}
      />
      <ContentFile
        title={dict.staff.photo}
        kind="image"
        url={publicMediaUrl(staff.photo_path)}
        messages={messages}
        upload={uploadStaffPhoto.bind(null, lang, id)}
        remove={removeStaffPhoto.bind(null, lang, id)}
      />
      <StaffLogin
        lang={lang}
        staffId={id}
        name={name}
        login={
          detail.login
            ? {
                email: detail.login.email,
                role: detail.login.role,
                isActive: detail.login.is_active,
              }
            : null
        }
        canGrantAdmin={me.role === "super_admin"}
        messages={messages}
      />
      <StaffAssignments
        lang={lang}
        staffId={id}
        rows={detail.assignments}
        sessions={detail.sessions}
        currentSessionId={detail.sessions.find((s) => s.current)?.id ?? null}
        sections={detail.sections}
        subjects={detail.subjects}
        messages={messages}
      />
    </div>
  );
}
