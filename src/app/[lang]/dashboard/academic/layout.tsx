import { notFound } from "next/navigation";

import { isLocale } from "@/i18n/config";
import { requireRole } from "@/lib/auth/session";

/**
 * Admins only. Checked here, before the pages' loading skeleton starts streaming, so other
 * roles get a real 403 status (the pages check again).
 */
export default async function AcademicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requireRole(lang, ["super_admin", "admin"]);
  return children;
}
