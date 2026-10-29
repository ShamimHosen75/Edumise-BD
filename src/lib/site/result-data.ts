import "server-only";

import type { Locale } from "@/i18n/config";
import { localizeDigits, pickLocalized } from "@/lib/format";
import { createPublicClient } from "@/lib/supabase/public";

import { cachedPublicQuery, TAGS } from "./cache";

type Named = { name_en: string; name_bn: string };

export type ResultChoices = {
  exams: {
    id: number;
    name: string;
    session: string;
    sessionLabel: string;
    classIds: number[];
  }[];
  classes: { id: number; level: number; name: string }[];
  sections: { id: number; classId: number; name: string }[];
  groups: { id: number; name: string }[];
};

/** Published exams (newest first) with their classes, sections and groups. */
export const getResultChoices = cachedPublicQuery(
  "result-choices",
  [TAGS.results, TAGS.stats],
  async (lang: Locale): Promise<ResultChoices> => {
    const db = createPublicClient();
    const [exams, classes, sections, groups] = await Promise.all([
      db
        .from("exams")
        .select(
          "id, name_en, name_bn, published_at, session:academic_sessions(name), exam_classes(class_id)",
        )
        .eq("status", "published")
        .order("published_at", { ascending: false }),
      db.from("classes").select("id, level, name_en, name_bn").order("level"),
      db
        .from("sections")
        .select("id, class_id, name_en, name_bn")
        .order("name_en"),
      db.from("groups").select("id, name_en, name_bn").order("id"),
    ]);
    for (const r of [exams, classes, sections, groups])
      if (r.error) throw new Error(r.error.message);
    return {
      exams: (exams.data ?? []).map((e) => ({
        id: e.id,
        name: pickLocalized(e, "name", lang),
        session: (e.session as unknown as { name: string }).name,
        sessionLabel: localizeDigits(
          (e.session as unknown as { name: string }).name,
          lang,
        ),
        classIds: (e.exam_classes as { class_id: number }[]).map(
          (c) => c.class_id,
        ),
      })),
      classes: (classes.data ?? []).map((c) => ({
        id: c.id,
        level: c.level,
        name: pickLocalized(c, "name", lang),
      })),
      sections: (sections.data ?? []).map((s) => ({
        id: s.id,
        classId: s.class_id,
        name: pickLocalized(s as Named, "name", lang),
      })),
      groups: (groups.data ?? []).map((g) => ({
        id: g.id,
        name: pickLocalized(g, "name", lang),
      })),
    };
  },
  { exams: [], classes: [], sections: [], groups: [] },
);

export type BoardResult = {
  id: number;
  exam: "ssc" | "jsc";
  year: number;
  examinees: number;
  passed: number;
  gpa5: number;
};

/** Board exam results, oldest year first. */
export const getBoardResults = cachedPublicQuery(
  "board-results",
  [TAGS.boardResults],
  async (): Promise<BoardResult[]> => {
    const { data, error } = await createPublicClient()
      .from("board_results")
      .select("id, exam, year, examinees, passed, gpa5")
      .order("year");
    if (error) throw new Error(error.message);
    return (data ?? []) as BoardResult[];
  },
  [],
);
