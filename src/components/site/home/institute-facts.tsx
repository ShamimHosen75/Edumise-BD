import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { formatNumber, localizeDigits } from "@/lib/format";
import type { SchoolSettings } from "@/lib/settings";

import { Section } from "./section";

/** EIIN, institution and centre codes, year established. Empty facts are left out. */
export function InstituteFacts({
  lang,
  dict,
  settings,
}: {
  lang: Locale;
  dict: Dictionary;
  settings: SchoolSettings | null;
}) {
  if (!settings) return null;
  const h = dict.site.home;
  const facts = [
    {
      label: h.eiin,
      value: settings.eiin && localizeDigits(settings.eiin, lang),
    },
    {
      label: h.institutionCode,
      value:
        settings.institution_code &&
        localizeDigits(settings.institution_code, lang),
    },
    {
      label: h.centerCode,
      value: settings.center_code && localizeDigits(settings.center_code, lang),
    },
    {
      label: h.established,
      value: settings.established_year
        ? formatNumber(settings.established_year, lang, { grouping: false })
        : "",
    },
  ].filter((f) => f.value);
  if (facts.length === 0) return null;

  return (
    <Section id="facts" title={h.facts}>
      <dl className="grid grid-cols-2 gap-3">
        {facts.map((f) => (
          <div key={f.label} className="bg-card rounded-xl border p-3">
            <dt className="text-muted-foreground text-xs">{f.label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{f.value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
