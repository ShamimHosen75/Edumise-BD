import type { Metadata } from "next";

import { PasswordPage } from "../password-page";

type Props = { params: Promise<{ lang: string }> };

export const metadata: Metadata = { robots: { index: false } };

export default function ChangePasswordPage({ params }: Props) {
  return <PasswordPage params={params} mode="change" />;
}
