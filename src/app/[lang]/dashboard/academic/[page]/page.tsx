import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClassSubjectsEditor } from "@/components/dashboard/academic/class-subjects-editor";
import { ClassesManager } from "@/components/dashboard/academic/classes-manager";
import { GroupsManager } from "@/components/dashboard/academic/groups-manager";
import { HolidaysManager } from "@/components/dashboard/academic/holidays-manager";
import { PeriodsManager } from "@/components/dashboard/academic/periods-manager";
import { RoomsManager } from "@/components/dashboard/academic/rooms-manager";
import { SectionsManager } from "@/components/dashboard/academic/sections-manager";
import { SessionsManager } from "@/components/dashboard/academic/sessions-manager";
import { SubjectsManager } from "@/components/dashboard/academic/subjects-manager";
import { TabLinks } from "@/components/site/content/tab-links";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/get-dictionary";
import { errorKeys, pickMessages } from "@/i18n/messages";
import type { TranslationKey } from "@/i18n/t";
import { ACADEMIC_PAGES } from "@/lib/academic";
import { academicData } from "@/lib/academic-data";
import { requireRole } from "@/lib/auth/session";
import { leafKeys } from "@/lib/content/admin-messages";
import { createClient } from "@/lib/supabase/server";

type Page = (typeof ACADEMIC_PAGES)[number];
type Props = { params: Promise<{ lang: string; page: string }> };

const isPage = (v: string): v is Page =>
  (ACADEMIC_PAGES as readonly string[]).includes(v);
const titleKey = (page: Page) =>
  page === "class-subjects" ? "classSubjects" : page;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, page } = await params;
  if (!isLocale(lang) || !isPage(page)) return {};
  return { title: (await getDictionary(lang)).academic[titleKey(page)] };
}

function messages(dict: Dictionary) {
  return pickMessages(dict, [
    ...leafKeys(dict.academic, "academic"),
    ...leafKeys(dict.days, "days"),
    ...leafKeys(dict.table, "table"),
    ...leafKeys(dict.dialog, "dialog"),
    "contentAdmin.edit",
    "contentAdmin.failed",
    "auth.unexpected",
    ...errorKeys(dict),
  ] as TranslationKey[]);
}

async function body(page: Page, lang: Locale, dict: Dictionary) {
  const db = await createClient();
  const common = { lang, messages: messages(dict) };
  switch (page) {
    case "sessions":
      return (
        <SessionsManager {...common} rows={await academicData.sessions(db)} />
      );
    case "classes":
      return (
        <ClassesManager {...common} rows={await academicData.classes(db)} />
      );
    case "groups":
      return <GroupsManager {...common} rows={await academicData.groups(db)} />;
    case "subjects":
      return (
        <SubjectsManager {...common} rows={await academicData.subjects(db)} />
      );
    case "sections": {
      const [rows, classes, teachers] = await Promise.all([
        academicData.sections(db),
        academicData.classList(db),
        academicData.teachers(db, lang),
      ]);
      return (
        <SectionsManager
          {...common}
          rows={rows}
          classes={classes}
          teachers={teachers}
        />
      );
    }
    case "periods": {
      const [rows, workingDays] = await Promise.all([
        academicData.periods(db),
        academicData.workingDays(db),
      ]);
      return (
        <PeriodsManager {...common} rows={rows} workingDays={workingDays} />
      );
    }
    case "rooms":
      return <RoomsManager {...common} rows={await academicData.rooms(db)} />;
    case "holidays":
      return (
        <HolidaysManager {...common} rows={await academicData.holidays(db)} />
      );
    case "class-subjects": {
      const [classes, groups, subjects, mappings] = await Promise.all([
        academicData.classList(db),
        academicData.groups(db),
        academicData.subjects(db),
        academicData.mappings(db),
      ]);
      return (
        <ClassSubjectsEditor
          {...common}
          classes={classes}
          groups={groups}
          subjects={subjects}
          mappings={mappings}
        />
      );
    }
  }
}

export default async function AcademicPage({ params }: Props) {
  const { lang, page } = await params;
  if (!isLocale(lang) || !isPage(page)) notFound();
  await requireRole(lang, ["super_admin", "admin"]);
  const dict = await getDictionary(lang);
  const a = dict.academic;
  const base = `/${lang}/dashboard/academic`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{a[titleKey(page)]}</h1>
        <p className="text-muted-foreground text-sm">
          {a.intro[titleKey(page)]}
        </p>
      </div>
      <div className="overflow-x-auto">
        <TabLinks
          label={a.tabs}
          tabs={ACADEMIC_PAGES.map((p) => ({
            href: `${base}/${p}`,
            label: a[titleKey(p)],
            active: p === page,
          }))}
        />
      </div>
      {await body(page, lang, dict)}
    </div>
  );
}
