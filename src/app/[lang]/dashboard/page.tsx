import { notFound, redirect } from "next/navigation";

import { isLocale } from "@/i18n/config";
import { roleHomePath } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";

type Props = { params: Promise<{ lang: string }> };

/** /dashboard sends each user to their own role's home page. */
export default async function DashboardIndex({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const user = await requireUser(lang);
  redirect(roleHomePath(lang, user.role));
}
