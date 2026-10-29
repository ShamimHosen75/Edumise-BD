import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/image", () => ({ default: () => null }));

import { AtAGlance } from "@/components/site/home/at-a-glance";
import { GalleryPreview } from "@/components/site/home/gallery-preview";
import { HeadMessage } from "@/components/site/home/head-message";
import { InstituteFacts } from "@/components/site/home/institute-facts";
import { LatestNotices } from "@/components/site/home/latest-notices";
import { QuickLinks } from "@/components/site/home/quick-links";
import { TeacherHighlights } from "@/components/site/home/teacher-highlights";
import { UpcomingEvents } from "@/components/site/home/upcoming-events";
import en from "@/dictionaries/en.json";
import type { SchoolSettings } from "@/lib/settings";

const base = { lang: "en" as const, dict: en };
const emptySettings = {
  eiin: "",
  institution_code: "",
  center_code: "",
  established_year: null,
  head_message_en: "",
  head_message_bn: "",
} as unknown as SchoolSettings;

describe("home sections hide themselves when empty", () => {
  it.each([
    ["latest notices", () => LatestNotices({ ...base, notices: [] })],
    ["upcoming events", () => UpcomingEvents({ ...base, events: [] })],
    ["gallery", () => GalleryPreview({ ...base, images: [] })],
    [
      "gallery with unusable paths",
      () =>
        GalleryPreview({
          ...base,
          images: [{ id: 1, image_path: "", caption_en: "", caption_bn: "" }],
        }),
    ],
    ["teachers", () => TeacherHighlights({ ...base, staff: [] })],
    ["quick links", () => QuickLinks({ ...base, links: [] })],
    [
      "quick links that point to unbuilt pages",
      () =>
        QuickLinks({
          ...base,
          links: [
            {
              id: 1,
              label_en: "Results",
              label_bn: "",
              url: "/verify",
              icon: "link",
            },
          ],
        }),
    ],
    [
      "institute facts without settings",
      () => InstituteFacts({ ...base, settings: null }),
    ],
    [
      "institute facts with every fact blank",
      () => InstituteFacts({ ...base, settings: emptySettings }),
    ],
    [
      "head message without a message",
      () =>
        HeadMessage({
          ...base,
          settings: emptySettings,
          fullMessageHref: null,
        }),
    ],
    ["counters without stats", () => AtAGlance({ ...base, stats: null })],
  ])("%s", (_, render) => {
    expect(render()).toBeNull();
  });

  it("renders when there is content", () => {
    const notices = [
      {
        id: 1,
        slug: "a",
        title_en: "Exam routine",
        title_bn: "",
        is_pinned: false,
        published_at: null,
      },
    ];
    expect(LatestNotices({ ...base, notices })).not.toBeNull();
  });
});
