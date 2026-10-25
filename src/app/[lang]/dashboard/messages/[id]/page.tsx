import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Phone } from "lucide-react";

import { MessageActions } from "@/components/dashboard/inbox/message-actions";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime, localizeDigits } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ lang: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).inbox.title }
    : {};
}

export default async function MessagePage({ params }: Props) {
  const { lang, id: rawId } = await params;
  if (!isLocale(lang) || !/^[1-9][0-9]{0,15}$/.test(rawId)) notFound();
  await requireRole(lang, ["super_admin", "admin"]);
  const id = Number(rawId);
  const dict = await getDictionary(lang);
  const m = dict.inbox;
  const supabase = await createClient();
  const { data: message } = await supabase
    .from("contact_messages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!message) notFound();
  // Opening a message marks it as read.
  if (!message.is_read)
    await supabase
      .from("contact_messages")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", id);

  return (
    <article className="flex max-w-3xl flex-col gap-5">
      <Link
        href={`/${lang}/dashboard/messages`}
        className="text-primary text-sm hover:underline"
      >
        ← {m.back}
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold break-words">
          {message.subject}
        </h1>
        <p className="text-muted-foreground text-sm">
          {m.from}: {message.name} ·{" "}
          <time dateTime={message.created_at}>
            {formatDateTime(message.created_at, lang)}
          </time>
        </p>
      </header>
      <p className="rounded-xl border p-4 break-words whitespace-pre-line">
        {message.message}
      </p>
      <div className="flex flex-wrap gap-4 text-sm">
        <a
          href={`tel:${message.phone}`}
          className="text-primary flex items-center gap-2 hover:underline"
        >
          <Phone className="size-4" aria-hidden="true" />
          {m.call}: {localizeDigits(message.phone, lang)}
        </a>
        {message.email ? (
          <a
            href={`mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.subject}`)}`}
            className="text-primary flex items-center gap-2 break-all hover:underline"
          >
            <Mail className="size-4" aria-hidden="true" />
            {m.reply}: {message.email}
          </a>
        ) : null}
      </div>
      <MessageActions
        lang={lang}
        id={id}
        isRead={true}
        labels={{
          markRead: m.markRead,
          markUnread: m.markUnread,
          delete: m.delete,
          deleteConfirm: m.deleteConfirm,
          failed: dict.errors.notAllowed,
        }}
      />
    </article>
  );
}
