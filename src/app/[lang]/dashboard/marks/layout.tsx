import { notFound } from "next/navigation";

import { isLocale } from "@/i18n/config";
import { requireRole } from "@/lib/auth/session";

/** Marks entry: teachers (their own subjects and sections) and admins. */
export default async function MarksLayout({
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
