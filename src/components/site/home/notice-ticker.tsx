"use client";

import Link from "next/link";
import { Megaphone, Pause, Play } from "lucide-react";
import { useState } from "react";

export type TickerItem = { id: number; title: string; href: string | null };

/**
 * Scrolling notice strip. Has a pause button, stops on hover/focus, and does not move at
 * all for readers who prefer reduced motion (see .ticker-track in globals.css).
 */
export function NoticeTicker({
  items,
  labels,
}: {
  items: TickerItem[];
  labels: { title: string; pause: string; play: string };
}) {
  const [paused, setPaused] = useState(false);
  const renderItems = (copy: number) =>
    items.map((item) => (
      <li
        key={`${copy}-${item.id}`}
        className="flex items-center gap-3 whitespace-nowrap"
      >
        <span aria-hidden="true" className="bg-primary size-1.5 rounded-full" />
        {item.href && copy === 0 ? (
          <Link href={item.href} className="hover:underline">
            {item.title}
          </Link>
        ) : (
          <span>{item.title}</span>
        )}
      </li>
    ));

  return (
    <section aria-label={labels.title} className="bg-muted/60 border-b">
      <div className="mx-auto flex max-w-6xl items-stretch gap-3 px-4">
        <p className="bg-primary text-primary-foreground flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-semibold">
          <Megaphone className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">{labels.title}</span>
        </p>
        <div
          className="ticker relative min-w-0 flex-1 overflow-hidden py-2 text-sm"
          data-paused={paused}
        >
          <div className="ticker-track flex w-max gap-10">
            <ul className="flex gap-10">{renderItems(0)}</ul>
            {/* Second copy makes the loop seamless; screen readers skip it. */}
            <ul className="flex gap-10" aria-hidden="true">
              {renderItems(1)}
            </ul>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? labels.play : labels.pause}
          aria-pressed={paused}
          className="hover:bg-accent focus-visible:ring-ring/50 my-1 flex size-8 shrink-0 items-center justify-center self-center rounded-md outline-none focus-visible:ring-[3px]"
        >
          {paused ? (
            <Play className="size-4" aria-hidden="true" />
          ) : (
            <Pause className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </section>
  );
}
