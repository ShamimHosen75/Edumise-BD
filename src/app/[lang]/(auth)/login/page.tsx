import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { errorKeys, pickMessages } from "@/i18n/messages";

import { loadAuthPage } from "../load";

const LOGIN_ERRORS: Record<string, string> = {
  link: "auth.linkExpired",
  noaccess: "auth.noAccess",
};

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ next?: string; error?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { dict } = await loadAuthPage(params);
  return { title: dict.auth.loginTitle, robots: { index: false } };
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { lang, dict, school } = await loadAuthPage(params);
  const { next, error } = await searchParams;
  const messages = pickMessages(dict, [
    "auth.identifier",
    "auth.password",
    "auth.submit",
    "auth.submitting",
    "auth.forgot",
    "auth.invalidCredentials",
    "auth.noAccess",
    "auth.tooMany",
    "auth.linkExpired",
    "auth.unexpected",
    ...errorKeys(dict),
  ]);

  return (
    <AuthCard
      lang={lang}
      school={school}
      changeLanguage={dict.common.changeLanguage}
      title={dict.auth.loginTitle}
      intro={dict.auth.loginIntro}
    >
      <LoginForm
        lang={lang}
        next={next}
        initialError={LOGIN_ERRORS[error ?? ""]}
        messages={messages}
      />
    </AuthCard>
  );
}
