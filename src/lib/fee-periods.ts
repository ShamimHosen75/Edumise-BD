import "server-only";

import type { Locale } from "@/i18n/config";
import { parsePeriod } from "@/lib/fees";
import { localizeDigits, pickLocalized } from "@/lib/format";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/** A function that names period keys: "October 2026", the session or the exam. */
export async function periodNamer(db: Client, lang: Locale) {
  const [{ data: sessions }, { data: exams }] = await Promise.all([
    db.from("academic_sessions").select("id, name"),
    db.from("exams").select("id, name_en, name_bn"),
  ]);
  const month = new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return (key: string) => {
    const p = parsePeriod(key);
    if (!p) return key;
    if (p.kind === "month")
      return month.format(new Date(`${p.month}-01T00:00:00Z`));
    if (p.kind === "session") {
      const s = (sessions ?? []).find((x) => x.id === p.id);
      return s ? localizeDigits(s.name, lang) : key;
    }
    const e = (exams ?? []).find((x) => x.id === p.id);
    return e ? pickLocalized(e, "name", lang) : key;
  };
}
