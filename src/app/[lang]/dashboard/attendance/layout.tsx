import { notFound } from "next/navigation";

import { isLocale } from "@/i18n/config";
import { requireRole } from "@/lib/auth/session";

/** Taking attendance and the monthly sheet: teachers (own sections) and admins. */
export default async function AttendanceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requireRole(lang, ["super_admin", "admin", "teacher"]);
  return children;
}
