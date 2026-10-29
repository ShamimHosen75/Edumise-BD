import { notFound } from "next/navigation";

import { isLocale } from "@/i18n/config";
import { requireRole } from "@/lib/auth/session";

/** Certificates: admins only. */
export default async function CertificatesLayout({
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
