import { TabLinks } from "@/components/site/content/tab-links";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

/** Title and the Take attendance | Monthly sheet tabs (hidden when printing). */
export function AttendanceHeader({
  lang,
  dict,
  active,
  query,
}: {
  lang: Locale;
  dict: Dictionary;
  active: "take" | "sheet";
  /** Keeps the chosen section when switching tabs. */
  query: string;
}) {
  const a = dict.attendance;
  const base = `/${lang}/dashboard/attendance`;
  return (
    <div className="flex flex-col gap-4 print:hidden">
      <div>
        <h1 className="text-2xl font-semibold">{a.title}</h1>
        <p className="text-muted-foreground text-sm">{a.intro}</p>
      </div>
      <TabLinks
        label={a.tabs}
        tabs={[
          { href: `${base}${query}`, label: a.take, active: active === "take" },
          {
            href: `${base}/sheet${query}`,
            label: a.sheet,
            active: active === "sheet",
          },
        ]}
      />
    </div>
  );
}
