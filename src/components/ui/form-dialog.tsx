"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  useForm,
  type FieldValues,
  type Resolver,
  type UseFormReturn,
} from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export type FormResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

type Labels = { save: string; saving: string; cancel: string; close: string };

type Props = {
  /** The button that opens the dialog. */
  trigger: React.ReactNode;
  title: string;
  description?: string;
  schema: Parameters<typeof zodResolver>[0];
  defaultValues: FieldValues;
  /** Calls the server action with the checked values. */
  onSubmit: (values: FieldValues) => Promise<FormResult>;
  /** Shown as a toast after saving. */
  successMessage: string;
  /** Translates the dictionary keys a server action or schema returns. */
  translate: (key: string) => string;
  labels: Labels;
  children: (form: UseFormReturn<FieldValues>) => React.ReactNode;
  /**
   * Validate in the browser but send the values as typed. Use when the schema converts
   * values (e.g. taka to poisha) and the server parses them again.
   */
  submitRaw?: boolean;
};

/**
 * A form in a dialog: react-hook-form + Zod (checked here and again on the server), a
 * server action, a toast when saved, then the page data is refreshed.
 */
export function FormDialog({
  trigger,
  title,
  description,
  schema,
  defaultValues,
  onSubmit,
  successMessage,
  translate,
  labels,
  children,
  submitRaw = false,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const form = useForm<FieldValues>({
    resolver: (submitRaw
      ? zodResolver(schema, undefined, { raw: true })
      : zodResolver(schema)) as unknown as Resolver<FieldValues>,
    defaultValues,
  });
  const { isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setError("");
    const result = await onSubmit(values).catch((): FormResult => ({
      ok: false,
      error: "auth.unexpected",
    }));
    if (!result.ok) {
      for (const [field, key] of Object.entries(result.fieldErrors ?? {}))
        form.setError(field, { message: key });
      setError(translate(result.error));
      return;
    }
    toast.success(successMessage);
    setOpen(false);
    router.refresh();
  });

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          // Start from the item's current values every time the dialog opens.
          form.reset(defaultValues);
          setError("");
        }
      }}
    >
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="bg-background fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-xl border p-5 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="text-lg font-semibold">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="text-muted-foreground text-sm">
                  {description}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">
                  {title}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={labels.close}
              >
                <X aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          <form
            onSubmit={submit}
            noValidate
            aria-busy={isSubmitting}
            className="flex flex-col gap-4"
          >
            {children(form)}
            {error ? (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  {labels.cancel}
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? labels.saving : labels.save}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
