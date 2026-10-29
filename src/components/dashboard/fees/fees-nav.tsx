import { TabLinks } from "@/components/site/content/tab-links";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

const PAGES = [
  "invoices",
  "collect",
  "reports",
  "generate",
  "structure",
  "waivers",
  "heads",
  "settings",
] as const;
export type FeesPage = (typeof PAGES)[number];

/** Title and the links between the fee pages. */
export function FeesNav({
  lang,
  dict,
  active,
}: {
  lang: Locale;
  dict: Dictionary;
  active: FeesPage;
}) {
  const f = dict.fees;
  return (
    <div className="flex flex-col gap-3 print:hidden">
      <div>
        <h1 className="text-2xl font-semibold">{f.title}</h1>
        <p className="text-muted-foreground text-sm">{f.intro}</p>
      </div>
      <TabLinks
        label={f.tabs}
        tabs={PAGES.map((p) => ({
          href: `/${lang}/dashboard/fees${p === "invoices" ? "" : `/${p}`}`,
          label: f.nav[p],
          active: p === active,
        }))}
      />
    </div>
  );
}
