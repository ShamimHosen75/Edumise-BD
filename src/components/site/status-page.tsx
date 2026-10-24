"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";

type Strings = { title: string; body: string; action: string };

/**
 * Body of the 404 / 403 pages. It picks the language from the URL in the browser, so
 * the server pages do not read request headers (which would make every page dynamic).
 */
export function StatusPage({
  strings,
  href,
}: {
  strings: Record<Locale, Strings>;
  href: "" | "/dashboard";
}) {
  const params = useParams<{ lang?: string }>();
  const lang = isLocale(params?.lang) ? params.lang : defaultLocale;
  const s = strings[lang];
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-start gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold">{s.title}</h1>
      <p className="text-muted-foreground">{s.body}</p>
      <Button asChild>
        <Link href={`/${lang}${href}`}>{s.action}</Link>
      </Button>
    </main>
  );
}
