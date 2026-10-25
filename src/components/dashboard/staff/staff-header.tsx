import { TabLinks } from "@/components/site/content/tab-links";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

/** Title and the Staff / Designations tabs. */
export function StaffHeader({
  lang,
  dict,
  active,
  title,
  intro,
}: {
  lang: Locale;
  dict: Dictionary;
  active: "list" | "designations";
  title: string;
  intro: string;
}) {
  const s = dict.staff;
  const base = `/${lang}/dashboard/staff`;
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground text-sm">{intro}</p>
      </div>
      <TabLinks
        label={s.tabs}
        tabs={[
          { href: base, label: s.list, active: active === "list" },
          {
            href: `${base}/designations`,
            label: s.designations,
            active: active === "designations",
          },
        ]}
      />
    </>
  );
}
