import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { listHref, Pagination } from "@/components/site/content/pagination";
import { TabLinks } from "@/components/site/content/tab-links";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { requireRole } from "@/lib/auth/session";
import { contentLabels } from "@/lib/content/labels";
import { pageRange, parsePage, totalPages } from "@/lib/content/pagination";
import { formatDate, localizeDigits } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ show?: string; page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).inbox.title }
    : {};
}

export default async function InboxPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requireRole(lang, ["super_admin", "admin"]);
  const dict = await getDictionary(lang);
  const m = dict.inbox;
  const sp = await searchParams;
  const unreadOnly = sp.show === "unread";
  const page = parsePage(sp.page);
  const { from, to } = pageRange(page);
  const supabase = await createClient();

  let query = supabase
    .from("contact_messages")
    .select("id, name, subject, is_read, created_at", { count: "exact" });
  if (unreadOnly) query = query.eq("is_read", false);
  const [{ data, count }, { count: unread }] = await Promise.all([
    query.order("created_at", { ascending: false }).range(from, to),
    supabase
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false),
  ]);
  const rows = data ?? [];
  const base = `/${lang}/dashboard/messages`;
  const labels = contentLabels(dict, lang);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{m.title}</h1>
        <p className="text-muted-foreground text-sm">
          {m.intro}{" "}
          {t(dict, "inbox.unreadCount", {
            count: localizeDigits(unread ?? 0, lang),
          })}
        </p>
      </div>
      <TabLinks
        label={m.show}
        tabs={[
          { href: base, label: m.all, active: !unreadOnly },
          {
            href: listHref(base, { show: "unread" }),
            label: m.unread,
            active: unreadOnly,
          },
        ]}
      />
      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border p-6 text-center text-sm">
          {m.empty}
        </p>
      ) : (
        <ul className="bg-card divide-y rounded-xl border">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`${base}/${r.id}`}
                className="hover:bg-accent flex flex-wrap items-center gap-x-4 gap-y-1 p-3"
              >
                <span
                  className={cn(
                    "min-w-0 flex-1",
                    !r.is_read && "font-semibold",
                  )}
                >
                  {r.subject}
                  <span className="text-muted-foreground block text-xs font-normal">
                    {m.from}: {r.name}
                  </span>
                </span>
                {!r.is_read ? (
                  <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                    {m.new}
                  </span>
                ) : null}
                <time
                  dateTime={r.created_at}
                  className="text-muted-foreground text-xs"
                >
                  {formatDate(r.created_at, lang, "medium")}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        page={page}
        total={totalPages(count ?? 0)}
        href={(n) =>
          listHref(base, { show: unreadOnly ? "unread" : undefined, page: n })
        }
        labels={labels.pagination}
        digits={labels.digits}
      />
    </div>
  );
}
