import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PortalCard } from "@/components/dashboard/students/portal-card";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireRole } from "@/lib/auth/session";
import { myChildren } from "@/lib/portal-data";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).portal.myChildren }
    : {};
}

export default async function MyChildrenPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const me = await requireRole(lang, ["guardian"]);
  const dict = await getDictionary(lang);
  const children = await myChildren(await createClient(), me.id, lang);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{dict.portal.myChildren}</h1>
        <p className="text-muted-foreground text-sm">
          {dict.portal.myChildrenIntro}
        </p>
      </div>
      {children.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {dict.portal.noChildren}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {children.map((c) => (
            <PortalCard
              key={c.id}
              lang={lang}
              dict={dict}
              student={c}
              attendanceHref={`/${lang}/dashboard/my-children/${c.id}/attendance`}
              resultsHref={`/${lang}/dashboard/my-children/${c.id}/results`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
