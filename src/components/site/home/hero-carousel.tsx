"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/** label: "Slide 2 of 3"; goTo: "Go to slide 2" (prepared on the server, in the reader's language). */
export type Slide = {
  id: number;
  src: string;
  title: string;
  subtitle: string;
  label: string;
  goTo: string;
};
type Labels = {
  region: string;
  previous: string;
  next: string;
  pause: string;
  play: string;
};

/**
 * Photo slideshow. Changes every 6 seconds unless the reader paused it or prefers reduced
 * motion; pauses while hovered or focused (WCAG 2.2.2).
 */
export function HeroCarousel({
  slides,
  labels,
}: {
  slides: Slide[];
  labels: Labels;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hold, setHold] = useState(false);
  const count = slides.length;
  const go = useCallback(
    (n: number) => setIndex(((n % count) + count) % count),
    [count],
  );

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      setPlaying(false);
  }, []);
  useEffect(() => {
    if (!playing || hold || count < 2) return;
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % count),
      6000,
    );
    return () => window.clearInterval(timer);
  }, [playing, hold, count]);

  const control =
    "flex size-9 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/65 focus-visible:ring-[3px] focus-visible:ring-white outline-none";

  return (
    <section
      aria-roledescription="carousel"
      aria-label={labels.region}
      className="relative overflow-hidden bg-slate-900"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={() => setHold(false)}
    >
      <div className="relative aspect-[16/9] sm:aspect-[5/2]">
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            role="group"
            aria-roledescription="slide"
            aria-label={slide.label}
            aria-hidden={i !== index}
            className={cn(
              "absolute inset-0 transition-opacity duration-700",
              i === index ? "opacity-100" : "opacity-0",
            )}
          >
            <Image
              src={slide.src}
              alt=""
              fill
              priority={i === 0}
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-4 pb-12 text-white sm:pb-14">
              <p className="text-xl font-bold drop-shadow sm:text-4xl">
                {slide.title}
              </p>
              {slide.subtitle ? (
                <p className="mt-1 text-sm drop-shadow sm:text-lg">
                  {slide.subtitle}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {count > 1 ? (
        <div className="absolute inset-x-0 bottom-3 mx-auto flex max-w-6xl items-center gap-2 px-4">
          <button
            type="button"
            className={control}
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? labels.pause : labels.play}
          >
            {playing ? (
              <Pause className="size-4" aria-hidden="true" />
            ) : (
              <Play className="size-4" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className={control}
            onClick={() => go(index - 1)}
            aria-label={labels.previous}
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={control}
            onClick={() => go(index + 1)}
            aria-label={labels.next}
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
          <div className="ml-auto flex gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => go(i)}
                aria-label={s.goTo}
                aria-current={i === index}
                className={cn(
                  "h-2.5 rounded-full bg-white/60 transition-all hover:bg-white",
                  i === index ? "w-6 bg-white" : "w-2.5",
                )}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
