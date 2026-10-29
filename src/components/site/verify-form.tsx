import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** A GET form to /[lang]/verify (works without JavaScript). */
export function VerifyForm({
  lang,
  text,
  value,
  error,
  id = "verify-ref",
}: {
  lang: string;
  text: { reference: string; check: string };
  value?: string;
  error?: string | null;
  id?: string;
}) {
  return (
    <form action={`/${lang}/verify`} className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-0 flex-1 basis-full flex-col gap-1.5 sm:basis-auto">
        <Label htmlFor={id}>{text.reference}</Label>
        <Input
          id={id}
          name="ref"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="TC-7KQ2-M9XA-4P"
          defaultValue={value}
          required
          maxLength={40}
          className="font-mono uppercase"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </div>
      <Button type="submit">{text.check}</Button>
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-destructive w-full text-sm"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}
