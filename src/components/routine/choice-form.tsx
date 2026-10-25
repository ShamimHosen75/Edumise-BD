import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/** A GET form with one select (section, teacher, exam ...); works without JavaScript. */
export function ChoiceForm({
  action,
  name,
  label,
  submit,
  options,
  value,
}: {
  action: string;
  name: string;
  label: string;
  submit: string;
  options: { id: number | string; name: string }[];
  value: number | string | undefined;
}) {
  const id = `choice-${name}`;
  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-3 print:hidden"
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        <select
          id={id}
          name={name}
          defaultValue={value}
          className="bg-background h-10 max-w-full rounded-md border px-3 text-sm"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="outline">
        {submit}
      </Button>
    </form>
  );
}
