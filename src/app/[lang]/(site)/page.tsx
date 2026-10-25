import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AtAGlance } from "@/components/site/home/at-a-glance";
import { GalleryPreview } from "@/components/site/home/gallery-preview";
import { HeadMessage } from "@/components/site/home/head-message";
import { HeroCarousel } from "@/components/site/home/hero-carousel";
import { InstituteFacts } from "@/components/site/home/institute-facts";
import { LatestNotices } from "@/components/site/home/latest-notices";
import { NoticeTicker } from "@/components/site/home/notice-ticker";
import { QuickLinks } from "@/components/site/home/quick-links";
import { TeacherHighlights } from "@/components/site/home/teacher-highlights";
import { UpcomingEvents } from "@/components/site/home/upcoming-events";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { pageAlternates } from "@/lib/site/detail-metadata";
import { t } from "@/i18n/t";
import { localizeDigits, pickLocalized } from "@/lib/format";
import { isAvailableRoute, localizeHref } from "@/lib/routes";
import { getBranding } from "@/lib/school";
import {
  getGalleryPreview,
  getLatestNotices,
  getPublicStats,
  getPageLink,
  getSiteLinks,
  getSliders,
  getStaffHighlights,
  getUpcomingEvents,
} from "@/lib/site/data";
import { publicMediaUrl } from "@/lib/supabase/public";

type PageProps = { params: Promise<{ lang: string }> };

// Static page, rebuilt hourly or as soon as content changes (revalidateTag).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { alternates: pageAlternates(lang, "/") } : {};
}

// Five minutes: scheduled notices and events appear soon after their time.
export const revalidate = 300;

export default async function HomePage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const h = dict.site.home;
  const [
    { settings, name },
    sliders,
    notices,
    events,
    gallery,
    staff,
    stats,
    links,
    headPage,
  ] = await Promise.all([
    getBranding(lang, dict),
    getSliders(),
    getLatestNotices(5),
    getUpcomingEvents(3),
    getGalleryPreview(6),
    getStaffHighlights(6),
    getPublicStats(),
    getSiteLinks(),
    getPageLink("principal-message"),
  ]);

  const slides = sliders.flatMap((s, i) => {
    const src = publicMediaUrl(s.image_path);
    if (!src) return [];
    const n = localizeDigits(i + 1, lang);
    return [
      {
        id: s.id,
        src,
        title: pickLocalized(s, "title", lang),
        subtitle: pickLocalized(s, "subtitle", lang),
        label: t(dict, "site.home.slide", {
          n,
          total: localizeDigits(sliders.length, lang),
        }),
        goTo: t(dict, "site.home.goToSlide", { n }),
      },
    ];
  });
  const ticker = notices.map((n) => {
    const path = `/notices/${n.slug}`;
    return {
      id: n.id,
      title: pickLocalized(n, "title", lang),
      href: isAvailableRoute(path) ? localizeHref(path, lang) : null,
    };
  });
  const headHref =
    headPage?.has_content && isAvailableRoute(`/p/${headPage.slug}`)
      ? localizeHref(`/p/${headPage.slug}`, lang)
      : null;

  return (
    <>
      <h1 className="sr-only">{name}</h1>
      {slides.length > 0 ? (
        <HeroCarousel
          slides={slides}
          labels={{
            region: h.slideshow,
            previous: h.previous,
            next: h.next,
            pause: h.pauseSlides,
            play: h.playSlides,
          }}
        />
      ) : null}
      {ticker.length > 0 ? (
        <NoticeTicker
          items={ticker}
          labels={{ title: h.noticeBoard, pause: h.pause, play: h.play }}
        />
      ) : null}

      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-10">
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <LatestNotices lang={lang} dict={dict} notices={notices} />
          </div>
          <div className="flex flex-col gap-10">
            <InstituteFacts lang={lang} dict={dict} settings={settings} />
          </div>
        </div>
        <QuickLinks
          lang={lang}
          dict={dict}
          links={links.filter((l) => l.placement === "quick")}
        />
        <HeadMessage
          lang={lang}
          dict={dict}
          settings={settings}
          fullMessageHref={headHref}
        />
        <AtAGlance lang={lang} dict={dict} stats={stats} />
        <TeacherHighlights lang={lang} dict={dict} staff={staff} />
        <UpcomingEvents lang={lang} dict={dict} events={events} />
        <GalleryPreview lang={lang} dict={dict} images={gallery} />
      </div>
    </>
  );
}
