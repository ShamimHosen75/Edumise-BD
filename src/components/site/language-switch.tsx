"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import { LOCALE_COOKIE } from "@/i18n/negotiate";
import { switchLocalePath } from "@/i18n/path";

type Props = { current: Locale; label: string };

const NAMES: Record<Locale, string> = { en: "English", bn: "বাংলা" };

/** Links to the same page in the other language and remembers the choice for a year. */
export function LanguageSwitch({ current, label }: Props) {
  const pathname = usePathname() ?? `/${current}`;
  const target: Locale = current === "en" ? "bn" : "en";

  return (
    <Button asChild variant="outline" size="sm">
      <Link
        href={switchLocalePath(pathname, target)}
        hrefLang={target}
        lang={target}
        aria-label={`${label}: ${NAMES[target]}`}
        onClick={() => {
          document.cookie = `${LOCALE_COOKIE}=${target}; path=/; max-age=31536000; samesite=lax`;
        }}
      >
        <Languages aria-hidden="true" />
        {NAMES[target]}
      </Link>
    </Button>
  );
}
