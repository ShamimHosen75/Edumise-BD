import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

type PageProps = { params: Promise<{ lang: string }> };

export default async function HomePage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const other = lang === "en" ? "bn" : "en";

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold sm:text-3xl">
        {dict.home.heading}
      </h1>
      <p className="text-muted-foreground">{dict.home.intro}</p>
      <div>
        <Button asChild variant="outline">
          <Link href={`/${other}`} hrefLang={other} lang={other}>
            {dict.home.otherLanguage}
          </Link>
        </Button>
      </div>
    </main>
  );
}
