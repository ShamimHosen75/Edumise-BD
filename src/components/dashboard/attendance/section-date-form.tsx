import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** GET form: section and a date (or month). Works without JavaScript. */
export function SectionDateForm({
  action,
  sections,
  section,
  dateName,
  dateType,
  dateLabel,
  dateValue,
  max,
  labels,
}: {
  action: string;
  sections: { id: number; name: string }[];
  section: number | undefined;
  dateName: "date" | "month";
  dateType: "date" | "month";
  dateLabel: string;
  dateValue: string;
  max: string;
  labels: { section: string; show: string };
}) {
  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-3 print:hidden"
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="attendance-section">{labels.section}</Label>
        <select
          id="attendance-section"
          name="section"
          defaultValue={section}
          className="bg-background h-10 max-w-full rounded-md border px-3 text-sm"
        >
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="attendance-date">{dateLabel}</Label>
        <Input
          id="attendance-date"
          name={dateName}
          type={dateType}
          defaultValue={dateValue}
          max={max}
          className="w-auto"
        />
      </div>
      <Button type="submit" variant="outline">
        {labels.show}
      </Button>
    </form>
  );
}
