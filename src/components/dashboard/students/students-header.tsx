import { TabLinks } from "@/components/site/content/tab-links";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

/** Title and the Students | Promotion | Import tabs. */
export function StudentsHeader({
  lang,
  dict,
  active,
  title,
  intro,
}: {
  lang: Locale;
  dict: Dictionary;
  active: "list" | "promotion" | "import";
  title: string;
  intro: string;
}) {
  const s = dict.students;
  const base = `/${lang}/dashboard/students`;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground text-sm">{intro}</p>
      </div>
      <TabLinks
        label={s.tabs}
        tabs={[
          { href: base, label: s.list, active: active === "list" },
          {
            href: `${base}/promotion`,
            label: s.promotion,
            active: active === "promotion",
          },
          {
            href: `${base}/import`,
            label: s.import,
            active: active === "import",
          },
        ]}
      />
    </div>
  );
}
