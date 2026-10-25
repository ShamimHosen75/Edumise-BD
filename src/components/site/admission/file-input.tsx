"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** A labelled file picker that reports the chosen file. */
export function FileInput({
  id,
  label,
  hint,
  accept,
  error,
  fileName,
  onFile,
}: {
  id: string;
  label: string;
  hint?: string;
  accept: string;
  error?: string;
  fileName?: string;
  onFile: (file: File) => void;
}) {
  const described = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="file"
        accept={accept}
        aria-invalid={Boolean(error)}
        aria-describedby={described || undefined}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (file) onFile(file);
        }}
      />
      {fileName ? <p className="text-xs font-medium">✓ {fileName}</p> : null}
      {hint ? (
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
