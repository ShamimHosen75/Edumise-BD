import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/** A plain GET form to choose the session (works without JavaScript). */
export function SessionPicker({
  action,
  label,
  submit,
  sessions,
  value,
  children,
}: {
  action: string;
  label: string;
  submit: string;
  sessions: { id: number; name: string }[];
  value: number | undefined;
  children?: React.ReactNode;
}) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="session-picker">{label}</Label>
        <select
          id="session-picker"
          name="session"
          defaultValue={value}
          className="bg-background h-10 rounded-md border px-3 text-sm"
        >
          {sessions.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </div>
      {children}
      <Button type="submit" variant="outline">
        {submit}
      </Button>
    </form>
  );
}
