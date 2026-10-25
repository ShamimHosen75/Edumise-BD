"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  setPrimaryGuardian,
  unlinkGuardian,
} from "@/app/[lang]/dashboard/students/guardian-actions";
import { translator } from "@/components/dashboard/academic/labels";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { localizeDigits } from "@/lib/format";
import type { GuardianRow } from "@/lib/student-detail";

import { FamilyLogin } from "./family-login";
import { GuardianForm } from "./guardian-form";

/** The student's guardians, their logins, and adding or removing one. */
export function StudentGuardians({
  lang,
  studentId,
  guardians,
  messages,
}: {
  lang: Locale;
  studentId: number;
  guardians: GuardianRow[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const p = (key: string, vars?: Record<string, string>) =>
    tr(`studentProfile.${key}`, vars);
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (action: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const result = await action().catch(() => ({
        ok: false,
        error: "auth.unexpected",
      }));
      if (!result.ok) return void toast.error(tr(result.error));
      toast.success(p("done"));
      router.refresh();
    });

  return (
    <div className="flex max-w-4xl flex-col gap-4" aria-busy={pending}>
      {guardians.length === 0 ? (
        <p className="text-muted-foreground text-sm">{p("noGuardians")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {guardians.map((g) => (
            <li
              key={g.id}
              className="flex flex-col gap-3 rounded-xl border p-4"
              data-testid="guardian"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {g.name}{" "}
                    <span className="text-muted-foreground text-sm">
                      ({p(`relations.${g.relation}`)})
                    </span>
                  </p>
                  <p className="text-sm">
                    {p("phone")}: {localizeDigits(g.phone, lang)}
                    {g.occupation ? ` · ${g.occupation}` : ""}
                  </p>
                  {g.children.length ? (
                    <p className="text-muted-foreground text-sm">
                      {p("otherChildren")}:{" "}
                      {g.children.map((c, i) => (
                        <span key={c.id}>
                          {i ? ", " : ""}
                          <Link
                            href={`/${lang}/dashboard/students/${c.id}`}
                            className="text-primary hover:underline"
                          >
                            {c.name}
                          </Link>
                        </span>
                      ))}
                    </p>
                  ) : null}
                </div>
                {g.isPrimary ? (
                  <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs">
                    {p("primary")}
                  </span>
                ) : null}
              </div>
              <FamilyLogin
                lang={lang}
                kind="guardian"
                id={g.id}
                name={g.name}
                state={g.login}
                messages={messages}
              />
              <div className="flex flex-wrap gap-2 border-t pt-3">
                {!g.isPrimary ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      run(() => setPrimaryGuardian(lang, studentId, g.id))
                    }
                  >
                    {p("makePrimary")}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={pending}
                  aria-label={p("unlinkNamed", { name: g.name })}
                  onClick={() => {
                    if (window.confirm(p("unlinkConfirm", { name: g.name })))
                      run(() => unlinkGuardian(lang, studentId, g.id));
                  }}
                >
                  {p("unlink")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <GuardianForm lang={lang} studentId={studentId} tr={tr} />
    </div>
  );
}
