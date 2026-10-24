import Link from "next/link";
import { headers } from "next/headers";

import { Button } from "@/components/ui/button";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

// not-found pages receive no params; middleware passes the language in a header.
export default async function NotFound() {
  const header = (await headers()).get("x-locale");
  const lang = isLocale(header) ? header : defaultLocale;
  const dict = await getDictionary(lang);

  return (
    <main className="mx-auto flex max-w-2xl flex-col items-start gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold">{dict.notFound.title}</h1>
      <p className="text-muted-foreground">{dict.notFound.body}</p>
      <Button asChild>
        <Link href={`/${lang}`}>{dict.notFound.home}</Link>
      </Button>
    </main>
  );
}
