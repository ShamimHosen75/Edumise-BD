"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, type FieldValues, type Resolver } from "react-hook-form";
import { toast } from "sonner";

import {
  createStaffLogin,
  resetStaffPassword,
  setStaffLoginActive,
  type PasswordResult,
} from "@/app/[lang]/dashboard/staff/login-actions";
import { translator } from "@/components/dashboard/academic/labels";
import {
  SelectField,
  TextField,
} from "@/components/dashboard/content/form-controls";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { STAFF_ROLES, staffLoginSchema } from "@/lib/validation/staff";

export type StaffLoginInfo = {
  email: string | null;
  role: string | null;
  isActive: boolean;
} | null;

const failed = (): PasswordResult => ({ ok: false, error: "auth.unexpected" });

/** Create a login (with a one-time password), switch it off/on, or reset the password. */
export function StaffLogin({
  lang,
  staffId,
  name,
  login,
  canGrantAdmin,
  messages,
}: {
  lang: Locale;
  staffId: number;
  name: string;
  login: StaffLoginInfo;
  /** Only a super admin may give the admin role. */
  canGrantAdmin: boolean;
  messages: Messages;
}) {
  const tr = translator(messages);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [password, setPassword] = useState<string | null>(null);
  const form = useForm<FieldValues>({
    resolver: zodResolver(staffLoginSchema) as unknown as Resolver<FieldValues>,
    defaultValues: { email: "", phone: "", role: "teacher" },
  });
  const roles = STAFF_ROLES.filter((r) => r !== "admin" || canGrantAdmin);

  const showPassword = (result: PasswordResult) => {
    if (!result.ok) {
      for (const [field, key] of Object.entries(result.fieldErrors ?? {}))
        form.setError(field, { message: key });
      toast.error(tr(result.error));
      return;
    }
    setPassword(result.password);
    router.refresh();
  };

  const create = form.handleSubmit((values) =>
    start(async () =>
      showPassword(await createStaffLogin(lang, staffId, values).catch(failed)),
    ),
  );

  return (
    <section
      aria-labelledby="login-title"
      aria-busy={pending}
      className="flex max-w-4xl flex-col gap-4 rounded-xl border p-4"
    >
      <h2 id="login-title" className="flex items-center gap-2 font-semibold">
        <KeyRound className="size-4" aria-hidden="true" />
        {tr("staff.loginTitle")}
      </h2>

      {password ? (
        <div
          role="status"
          className="bg-muted flex flex-col gap-2 rounded-lg p-3"
        >
          <p className="text-sm font-medium">{tr("staff.oneTime")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code
              data-testid="one-time-password"
              className="bg-background rounded border px-3 py-1.5 font-mono text-lg"
            >
              {password}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                navigator.clipboard
                  ?.writeText(password)
                  .then(() => toast.success(tr("staff.copied")))
                  .catch(() => undefined)
              }
            >
              <Copy aria-hidden="true" />
              {tr("staff.copy")}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            {tr("staff.oneTimeHint")}
          </p>
        </div>
      ) : null}

      {login ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            {tr("staff.loginOf", {
              email: login.email ?? "",
              role: login.role ? tr(`staff.roles.${login.role}`) : "",
            })}{" "}
            <span className="font-medium">
              {login.isActive ? tr("staff.loginActive") : tr("staff.loginOff")}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await setStaffLoginActive(
                    lang,
                    staffId,
                    !login.isActive,
                  ).catch(() => ({
                    ok: false as const,
                    error: "auth.unexpected" as const,
                  }));
                  if (!result.ok) return void toast.error(tr(result.error));
                  toast.success(tr("staff.done"));
                  router.refresh();
                })
              }
            >
              {login.isActive ? tr("staff.switchOff") : tr("staff.switchOn")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                if (!window.confirm(tr("staff.resetConfirm", { name }))) return;
                start(async () =>
                  showPassword(
                    await resetStaffPassword(lang, staffId).catch(failed),
                  ),
                );
              }}
            >
              {tr("staff.resetPassword")}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={create} noValidate className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            {tr("staff.loginIntro")}
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              form={form}
              t={tr}
              id="login-email"
              name="email"
              label={tr("staff.loginEmail")}
            />
            <TextField
              form={form}
              t={tr}
              id="login-phone"
              name="phone"
              label={tr("staff.loginPhone")}
            />
            <SelectField
              form={form}
              t={tr}
              id="login-role"
              name="role"
              label={tr("staff.role")}
              options={roles.map((r) => ({
                value: r,
                label: tr(`staff.roles.${r}`),
              }))}
            />
          </div>
          <Button type="submit" className="w-fit" disabled={pending}>
            {pending ? tr("staff.creating") : tr("staff.createLogin")}
          </Button>
        </form>
      )}
    </section>
  );
}
