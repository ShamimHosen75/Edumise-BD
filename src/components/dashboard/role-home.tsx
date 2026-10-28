import { notFound } from "next/navigation";

import { AttendanceToday } from "@/components/dashboard/attendance/attendance-today";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import type { Role } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { attendanceToday } from "@/lib/attendance-data";
import { ROLE_WIDGETS } from "@/lib/dashboard-widgets";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ lang: string }>; role: Role };

/** Home page for one role. Any other role gets a 403. */
export async function RoleHome({ params, role }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const user = await requireRole(lang, [role]);
  const dict = await getDictionary(lang);
  const name = (lang === "bn" && user.fullNameBn) || user.fullNameEn;
  const today =
    role === "admin" || role === "super_admin"
      ? await attendanceToday(await createClient(), lang)
      : null;

  return (
    <div className="flex flex-col gap-6" data-testid={`home-${role}`}>
      <div>
        <h1 className="text-2xl font-semibold">
          {t(dict, "dashboard.welcome", { name })}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t(dict, "dashboard.signedInAs", { role: t(dict, `roles.${role}`) })}
        </p>
      </div>
      {today ? <AttendanceToday lang={lang} dict={dict} data={today} /> : null}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ROLE_WIDGETS[role].map((key) => (
          <li key={key} className="bg-card rounded-xl border p-4 shadow-xs">
            <p className="text-sm font-medium">{t(dict, key)}</p>
            <p
              className="text-muted-foreground mt-2 text-2xl font-semibold"
              aria-hidden="true"
            >
              —
            </p>
            <p className="text-muted-foreground text-xs">
              {dict.dashboard.comingSoon}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
