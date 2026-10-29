import type { Filters } from "@/app/[lang]/dashboard/fees/reports/load";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { localizeDigits } from "@/lib/format";

const select = "bg-background h-10 rounded-md border px-3 text-sm";
type Option = { id: number; name: string };

/** The filters of the chosen report, as a plain GET form (works without JavaScript). */
export function ReportFilters({
  lang,
  dict,
  filters: f,
  action,
  classes,
  sections,
}: {
  lang: Locale;
  dict: Dictionary;
  filters: Filters;
  action: string;
  classes: Option[];
  sections: Option[];
}) {
  const r = dict.fees.reports;
  const field = (id: string, label: string, control: React.ReactNode) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {control}
    </div>
  );
  return (
    <form
      method="get"
      action={action}
      className="flex flex-wrap items-end gap-3 print:hidden"
      aria-label={r.filters}
    >
      <input type="hidden" name="report" value={f.kind} />
      {f.kind === "daily"
        ? field(
            "rep-day",
            r.date,
            <Input
              id="rep-day"
              name="day"
              type="date"
              defaultValue={f.day}
              className="w-44"
            />,
          )
        : null}
      {f.kind === "income" ? (
        <>
          {field(
            "rep-from",
            r.from,
            <Input
              id="rep-from"
              name="from"
              type="date"
              defaultValue={f.from}
              className="w-44"
            />,
          )}
          {field(
            "rep-to",
            r.to,
            <Input
              id="rep-to"
              name="to"
              type="date"
              defaultValue={f.to}
              className="w-44"
            />,
          )}
        </>
      ) : null}
      {f.kind === "dues" ? (
        <>
          {field(
            "rep-session",
            dict.fees.generate.session,
            <select
              id="rep-session"
              name="session"
              className={select}
              defaultValue={f.sessionId}
            >
              {f.sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {localizeDigits(s.name, lang)}
                </option>
              ))}
            </select>,
          )}
          {field(
            "rep-class",
            r.class,
            <select
              id="rep-class"
              name="class"
              className={select}
              defaultValue={f.classId ?? ""}
            >
              <option value="">{dict.fees.invoices.anyClass}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>,
          )}
          {f.classId
            ? field(
                "rep-section",
                r.section,
                <select
                  id="rep-section"
                  name="section"
                  className={select}
                  defaultValue={f.sectionId ?? ""}
                >
                  <option value="">{r.anySection}</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>,
              )
            : null}
          {field(
            "rep-period",
            r.month,
            <Input
              id="rep-period"
              name="period"
              defaultValue={f.period ?? ""}
              placeholder={dict.fees.invoices.periodHint}
              className="w-36"
            />,
          )}
        </>
      ) : null}
      {f.kind === "ledger"
        ? field(
            "rep-code",
            dict.fees.waivers.studentCode,
            <Input
              id="rep-code"
              name="code"
              inputMode="numeric"
              defaultValue={f.code}
              maxLength={20}
              className="w-44"
            />,
          )
        : null}
      <Button type="submit">{r.show}</Button>
    </form>
  );
}
