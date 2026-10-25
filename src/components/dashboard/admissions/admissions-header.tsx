import { TabLinks } from "@/components/site/content/tab-links";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

export function AdmissionsHeader({
  lang,
  dict,
  active,
}: {
  lang: Locale;
  dict: Dictionary;
  active: "queue" | "merit";
}) {
  const a = dict.admissionsAdmin;
  const base = `/${lang}/dashboard/admissions`;
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">{a.title}</h1>
        <p className="text-muted-foreground text-sm">{a.intro}</p>
      </div>
      <TabLinks
        label={a.tabs}
        tabs={[
          { href: base, label: a.queue, active: active === "queue" },
          { href: `${base}/merit`, label: a.merit, active: active === "merit" },
        ]}
      />
    </>
  );
}
