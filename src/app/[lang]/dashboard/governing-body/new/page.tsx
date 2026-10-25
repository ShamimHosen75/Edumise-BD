import type { Metadata } from "next";

import { PersonEditPage } from "@/components/dashboard/people/people-pages";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).peopleAdmin.governingTitle }
    : {};
}

export default function Page({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  return <PersonEditPage params={params} kind="governing-body" />;
}
