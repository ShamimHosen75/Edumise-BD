"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import bn from "@/dictionaries/bn.json";
import en from "@/dictionaries/en.json";
import { defaultLocale, isLocale } from "@/i18n/config";

const STRINGS = { en: en.errorPage, bn: bn.errorPage };

/** A dashboard page failed to load: the sidebar stays, with a way to try again. */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ lang?: string }>();
  const lang = isLocale(params?.lang) ? params.lang : defaultLocale;
  const s = STRINGS[lang];
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex max-w-2xl flex-col items-start gap-4" role="alert">
      <h1 className="text-2xl font-semibold">{s.title}</h1>
      <p className="text-muted-foreground">{s.body}</p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={reset}>{s.retry}</Button>
        <Button asChild variant="outline">
          <Link href={`/${lang}/dashboard`}>{s.dashboard}</Link>
        </Button>
      </div>
    </div>
  );
}
