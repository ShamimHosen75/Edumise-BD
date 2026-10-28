import Link from "next/link";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { localizeDigits } from "@/lib/format";
import type { PortalStudent } from "@/lib/portal-data";

/** A student's school details for their guardian or themselves. */
export function PortalCard({
  lang,
  dict,
  student,
  attendanceHref,
}: {
  lang: Locale;
  dict: Dictionary;
  student: PortalStudent;
  /** Link to the child's (or own) attendance calendar. */
  attendanceHref?: string;
}) {
  const p = dict.portal;
  const e = student.enrollment;
  const statuses = dict.students.statuses as Record<string, string>;
  const relations = dict.studentProfile.relations as Record<string, string>;
  return (
    <article
      className="bg-card flex flex-col gap-2 rounded-xl border p-4 shadow-xs"
      data-testid="portal-student"
    >
      <h2 className="text-lg font-semibold">{student.name}</h2>
      <p className="text-sm">
        {t(dict, "portal.studentId", {
          code: localizeDigits(student.code, lang),
        })}{" "}
        · {statuses[student.status] ?? student.status}
      </p>
      {e ? (
        <p className="text-sm">
          {t(dict, "portal.classSection", {
            class: e.className,
            section: e.section,
          })}{" "}
          · {t(dict, "portal.roll", { roll: localizeDigits(e.roll, lang) })}
          {e.group ? ` · ${e.group}` : ""} ({localizeDigits(e.session, lang)})
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">{p.notEnrolled}</p>
      )}
      {student.guardians.length ? (
        <p className="text-muted-foreground text-sm">
          {dict.studentProfile.guardians}:{" "}
          {student.guardians
            .map((g) => `${g.name} (${relations[g.relation] ?? g.relation})`)
            .join(", ")}
        </p>
      ) : null}
      {attendanceHref ? (
        <Link
          href={attendanceHref}
          className="text-primary w-fit text-sm font-medium hover:underline"
        >
          {dict.attendance.viewSheet}
        </Link>
      ) : null}
    </article>
  );
}
