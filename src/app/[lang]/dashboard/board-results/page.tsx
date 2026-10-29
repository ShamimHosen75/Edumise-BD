import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BoardResultsManager } from "@/components/dashboard/board-results-manager";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { errorKeys, pickMessages } from "@/i18n/messages";
import type { TranslationKey } from "@/i18n/t";
import { requireRole } from "@/lib/auth/session";
import { leafKeys } from "@/lib/content/admin-messages";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).boardResults.admin }
    : {};
}

/** Board exam results for the website (admins). */
export default async function BoardResultsAdminPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requireRole(lang, ["super_admin", "admin"]);
  const dict = await getDictionary(lang);
  const db = await createClient();
  const { data, error } = await db
    .from("board_results")
    .select("id, exam, year, examinees, passed, gpa5")
    .order("year", { ascending: false });
  if (error) throw new Error(error.message);
  const messages = pickMessages(dict, [
    ...leafKeys(dict.boardResults, "boardResults"),
    ...leafKeys(dict.academic, "academic"),
    ...leafKeys(dict.table, "table"),
    ...leafKeys(dict.dialog, "dialog"),
    "contentAdmin.edit",
    "contentAdmin.failed",
    "auth.unexpected",
    ...errorKeys(dict),
  ] as TranslationKey[]);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{dict.boardResults.admin}</h1>
        <p className="text-muted-foreground text-sm">
          {dict.boardResults.adminIntro}
        </p>
      </div>
      <BoardResultsManager
        lang={lang}
        rows={(data ?? []) as never}
        messages={messages}
      />
    </div>
  );
}
