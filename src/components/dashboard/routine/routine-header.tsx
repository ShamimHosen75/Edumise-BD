import { TabLinks } from "@/components/site/content/tab-links";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

/** Title and the By section | By teacher tabs (hidden when printing). */
export function RoutineHeader({
  lang,
  dict,
  active,
  intro,
}: {
  lang: Locale;
  dict: Dictionary;
  active: "section" | "teacher";
  intro: string;
}) {
  const r = dict.routine;
  const base = `/${lang}/dashboard/routine`;
  return (
    <div className="flex flex-col gap-4 print:hidden">
      <div>
        <h1 className="text-2xl font-semibold">{r.title}</h1>
        <p className="text-muted-foreground text-sm">{intro}</p>
      </div>
      <TabLinks
        label={r.tabs}
        tabs={[
          { href: base, label: r.bySection, active: active === "section" },
          {
            href: `${base}/teacher`,
            label: r.byTeacher,
            active: active === "teacher",
          },
        ]}
      />
    </div>
  );
}
