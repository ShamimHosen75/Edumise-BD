import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { NewPasswordForm } from "@/components/auth/new-password-form";
import { errorKeys, pickMessages } from "@/i18n/messages";
import { getCurrentUser } from "@/lib/auth/session";

import { loadAuthPage } from "./load";

/** Shared page body for /change-password (forced) and /reset-password (email link). */
export async function PasswordPage({
  params,
  mode,
}: {
  params: Promise<{ lang: string }>;
  mode: "change" | "reset";
}) {
  const { lang, dict, school } = await loadAuthPage(params);
  const user = await getCurrentUser();
  // The reset link signs the user in; without a session the link was invalid or expired.
  if (!user)
    redirect(mode === "reset" ? `/${lang}/login?error=link` : `/${lang}/login`);

  const messages = pickMessages(dict, [
    "auth.newPassword",
    "auth.confirmPassword",
    "auth.passwordHint",
    "auth.savePassword",
    "auth.saving",
    "auth.unexpected",
    ...errorKeys(dict),
  ]);
  return (
    <AuthCard
      lang={lang}
      school={school}
      changeLanguage={dict.common.changeLanguage}
      title={mode === "reset" ? dict.auth.resetTitle : dict.auth.changeTitle}
      intro={mode === "change" ? dict.auth.changeIntro : undefined}
    >
      <NewPasswordForm lang={lang} messages={messages} />
    </AuthCard>
  );
}
