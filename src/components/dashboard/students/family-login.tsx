"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  familyLogin,
  setFamilyLoginActive,
  type FamilyKind,
  type FamilyLoginResult,
} from "@/app/[lang]/dashboard/students/login-actions";
import { translator } from "@/components/dashboard/academic/labels";
import { OneTimePassword } from "@/components/dashboard/one-time-password";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import type { LoginState } from "@/lib/student-detail";

const failed = (): FamilyLoginResult => ({
  ok: false,
  error: "auth.unexpected",
});

/** Login of a student or guardian: create, new one-time password, switch off or on. */
export function FamilyLogin({
  lang,
  kind,
  id,
  name,
  state,
  messages,
}: {
  lang: Locale;
  kind: FamilyKind;
  id: number;
  name: string;
  state: LoginState;
  messages: Messages;
}) {
  const tr = translator(messages);
  const p = (key: string, vars?: Record<string, string>) =>
    tr(`studentProfile.${key}`, vars);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [password, setPassword] = useState<string | null>(null);

  const run = (op: "create" | "reset") =>
    start(async () => {
      const result = await familyLogin(lang, kind, id, op).catch(failed);
      if (!result.ok) return void toast.error(tr(result.error));
      setPassword(result.password);
      if (!result.password) toast.success(p("done"));
      router.refresh();
    });
  const toggle = () =>
    start(async () => {
      const result = await setFamilyLoginActive(
        lang,
        kind,
        id,
        state !== "active",
      ).catch(() => ({
        ok: false as const,
        error: "auth.unexpected" as const,
      }));
      if (!result.ok) return void toast.error(tr(result.error));
      toast.success(p("done"));
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-2" aria-busy={pending}>
      <p className="text-sm">
        {p("login")}:{" "}
        <span className="font-medium" data-testid={`login-${kind}-${id}`}>
          {state === "none"
            ? p("noLogin")
            : state === "active"
              ? p("loginActive")
              : p("loginOff")}
        </span>
      </p>
      {password ? (
        <OneTimePassword
          password={password}
          labels={{
            title: p("oneTime"),
            hint: p("oneTimeHint"),
            copy: p("copy"),
            copied: p("copied"),
          }}
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        {state === "none" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run("create")}
          >
            {p("createLogin")}
          </Button>
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                if (window.confirm(p("resetConfirm", { name }))) run("reset");
              }}
            >
              {p("newPassword")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={toggle}
            >
              {state === "active" ? p("switchOff") : p("switchOn")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
