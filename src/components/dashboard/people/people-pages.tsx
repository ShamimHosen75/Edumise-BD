import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";

import {
  removePersonPhoto,
  uploadPersonPhoto,
} from "@/app/[lang]/dashboard/people-actions";
import { ContentFile } from "@/components/dashboard/content/content-file";
import { Button } from "@/components/ui/button";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/get-dictionary";
import { pickMessages } from "@/i18n/messages";
import { requireRole } from "@/lib/auth/session";
import { contentAdminMessages, leafKeys } from "@/lib/content/admin-messages";
import { formatDate, formatNumber, pickLocalized } from "@/lib/format";
import { dhakaToday } from "@/lib/people";
import {
  PEOPLE_TABLE,
  personFormValues,
  type PeopleKind,
} from "@/lib/people-admin";
import { createClient } from "@/lib/supabase/server";
import { publicMediaUrl } from "@/lib/supabase/public";

import { PersonForm } from "./person-form";

type Params = Promise<{ lang: string; id?: string }>;

const TITLE = {
  "governing-body": "governingTitle",
  "ex-principals": "exPrincipalsTitle",
} as const;

async function load(params: Params, kind: PeopleKind) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  await requireRole(lang, ["super_admin", "admin"]);
  const dict = await getDictionary(lang);
  const db = (await createClient()) as unknown as SupabaseClient;
  return { lang, id, dict, db, title: dict.peopleAdmin[TITLE[kind]] };
}

const messages = (dict: Dictionary) => ({
  ...contentAdminMessages(dict),
  ...pickMessages(dict, leafKeys(dict.peopleAdmin, "peopleAdmin")),
});

type Row = Record<string, unknown> & {
  id: number;
  full_name_en: string;
  full_name_bn: string;
};

function detail(kind: PeopleKind, r: Row, lang: Locale, dict: Dictionary) {
  const year = (y: unknown) =>
    formatNumber(Number(y), lang, { grouping: false });
  if (kind === "ex-principals")
    return `${year(r.from_year)} – ${year(r.to_year)}`;
  const end = r.term_end
    ? formatDate(String(r.term_end), lang, "medium")
    : dict.people.present;
  return `${pickLocalized(r as unknown as { position_en: string }, "position", lang)} · ${formatDate(String(r.term_start), lang, "medium")} – ${end}`;
}

export async function PeopleListPage({
  params,
  kind,
}: {
  params: Params;
  kind: PeopleKind;
}) {
  const { lang, dict, db, title } = await load(params, kind);
  const a = dict.contentAdmin;
  const query = db.from(PEOPLE_TABLE[kind]).select("*");
  const { data } =
    kind === "governing-body"
      ? await query
          .order("term_start", { ascending: false })
          .order("sort_order")
      : await query.order("to_year", { ascending: false });
  const rows = (data ?? []) as Row[];
  const today = dhakaToday();
  const base = `/${lang}/dashboard/${kind}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <Button asChild>
          <Link href={`${base}/new`}>
            <Plus aria-hidden="true" />
            {a.addNew}
          </Link>
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border p-6 text-center text-sm">
          {a.empty}
        </p>
      ) : (
        <ul className="bg-card divide-y rounded-xl border">
          {rows.map((r) => {
            const name = pickLocalized(r, "full_name", lang);
            const current =
              kind === "governing-body" &&
              (!r.term_end || String(r.term_end) >= today);
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{name}</p>
                  <p className="text-muted-foreground text-xs">
                    {detail(kind, r, lang, dict)}
                  </p>
                </div>
                {current ? (
                  <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs">
                    {dict.peopleAdmin.current}
                  </span>
                ) : null}
                <Link
                  href={`${base}/${r.id}`}
                  className="text-primary text-sm underline-offset-4 hover:underline"
                >
                  {a.edit}
                  <span className="sr-only">: {name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export async function PersonEditPage({
  params,
  kind,
}: {
  params: Params;
  kind: PeopleKind;
}) {
  const { lang, id: rawId, dict, db, title } = await load(params, kind);
  const id = rawId && /^[1-9][0-9]{0,15}$/.test(rawId) ? Number(rawId) : null;
  let row: Row | null = null;
  if (rawId !== undefined) {
    if (id === null) notFound();
    const { data } = await db
      .from(PEOPLE_TABLE[kind])
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!data) notFound();
    row = data as Row;
  }
  const msgs = messages(dict);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">
        {title}:{" "}
        {row ? pickLocalized(row, "full_name", lang) : dict.contentAdmin.addNew}
      </h1>
      <PersonForm
        lang={lang}
        kind={kind}
        id={id}
        defaults={personFormValues(kind, row)}
        messages={msgs}
      />
      {id !== null && row ? (
        <ContentFile
          title={dict.peopleAdmin.photo}
          kind="image"
          url={publicMediaUrl(row.photo_path as string | null)}
          messages={msgs}
          upload={uploadPersonPhoto.bind(null, lang, kind, id)}
          remove={removePersonPhoto.bind(null, lang, kind, id)}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          {dict.contentAdmin.saveFirst}
        </p>
      )}
    </div>
  );
}
