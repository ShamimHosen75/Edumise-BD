"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

export type Photo = {
  id: number;
  src: string;
  caption: string;
  openLabel: string;
  positionLabel: string;
};
type Labels = { close: string; previous: string; next: string };

/**
 * Photo grid with a lightbox: arrow keys move between photos, Escape closes, focus stays in
 * the dialog and returns to the photo that opened it.
 */
export function PhotoGallery({
  photos,
  labels,
}: {
  photos: Photo[];
  labels: Labels;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  // The photo last shown gets focus back when the lightbox closes.
  const last = useRef(0);
  const count = photos.length;
  const go = (step: number) =>
    setIndex((i) => (i === null ? null : (i + step + count) % count));
  const current = index === null ? null : photos[index];
  const control =
    "flex size-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 focus-visible:ring-[3px] focus-visible:ring-white outline-none";

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((p, i) => (
          <li key={p.id}>
            <button
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={p.openLabel}
              className="group bg-card focus-visible:ring-ring/50 block w-full overflow-hidden rounded-xl border text-left outline-none focus-visible:ring-[3px]"
            >
              <Image
                src={p.src}
                alt=""
                width={400}
                height={300}
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-105"
              />
              {p.caption ? (
                <span className="block truncate px-3 py-2 text-xs">
                  {p.caption}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      <Dialog.Root
        open={index !== null}
        onOpenChange={(open) => {
          if (open) return;
          if (index !== null) last.current = index;
          setIndex(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/90" />
          <Dialog.Content
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 p-4 outline-none"
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              buttons.current[last.current]?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") go(1);
              if (e.key === "ArrowLeft") go(-1);
            }}
          >
            {current ? (
              <>
                <Dialog.Title className="sr-only">
                  {current.positionLabel}
                </Dialog.Title>
                <Dialog.Description className="sr-only">
                  {current.caption}
                </Dialog.Description>
                <figure className="flex max-h-full w-full max-w-5xl flex-col items-center gap-3">
                  <Image
                    src={current.src}
                    alt={current.caption}
                    width={1600}
                    height={1200}
                    sizes="100vw"
                    className="max-h-[75vh] w-auto rounded-lg object-contain"
                  />
                  <figcaption className="text-center text-sm text-white">
                    {current.caption}
                    <span className="ml-2 text-white/70">
                      {current.positionLabel}
                    </span>
                  </figcaption>
                </figure>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className={control}
                    onClick={() => go(-1)}
                    aria-label={labels.previous}
                  >
                    <ChevronLeft aria-hidden="true" />
                  </button>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className={control}
                      aria-label={labels.close}
                    >
                      <X aria-hidden="true" />
                    </button>
                  </Dialog.Close>
                  <button
                    type="button"
                    className={control}
                    onClick={() => go(1)}
                    aria-label={labels.next}
                  >
                    <ChevronRight aria-hidden="true" />
                  </button>
                </div>
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
