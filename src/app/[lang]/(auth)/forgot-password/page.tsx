import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { errorKeys, pickMessages } from "@/i18n/messages";

import { loadAuthPage } from "../load";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { dict } = await loadAuthPage(params);
  return { title: dict.auth.forgotTitle, robots: { index: false } };
}

export default async function ForgotPasswordPage({ params }: Props) {
  const { lang, dict, school } = await loadAuthPage(params);
  const messages = pickMessages(dict, [
    "auth.email",
    "auth.sendLink",
    "auth.sending",
    "auth.linkSent",
    "auth.backToLogin",
    ...errorKeys(dict),
  ]);
  return (
    <AuthCard
      lang={lang}
      school={school}
      changeLanguage={dict.common.changeLanguage}
      title={dict.auth.forgotTitle}
      intro={dict.auth.forgotIntro}
    >
      <ForgotPasswordForm lang={lang} messages={messages} />
    </AuthCard>
  );
}
