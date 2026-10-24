"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  addAlbumPhoto,
  removeAlbumPhoto,
  savePhotoCaption,
  setAlbumCover,
} from "@/app/[lang]/dashboard/[module]/photo-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/config";
import { msg, type Messages } from "@/i18n/messages";
import { localizeDigits } from "@/lib/format";

import { resizeToWebp } from "./resize-image";

export type AlbumPhoto = {
  id: number;
  url: string;
  caption_en: string;
  caption_bn: string;
  isCover: boolean;
};

type Result = { ok: boolean; error?: string };

/** Bulk upload (resized in the browser), captions, cover choice and removal. */
export function AlbumPhotos({
  lang,
  albumId,
  photos,
  messages,
}: {
  lang: Locale;
  albumId: number;
  photos: AlbumPhoto[];
  messages: Messages;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const m = (key: string) => msg(messages, key)!;
  const n = (value: number) => String(localizeDigits(value, lang));
  const fail = (error?: string) =>
    setStatus({ ok: false, text: m(error ?? "auth.unexpected") });

  const upload = (files: File[]) =>
    start(async () => {
      let added = 0;
      let lastError: string | undefined;
      for (const [i, file] of files.entries()) {
        setStatus({
          ok: true,
          text: m("contentAdmin.uploadingN")
            .replace("{done}", n(i + 1))
            .replace("{total}", n(files.length)),
        });
        const result: Result = await resizeToWebp(file)
          .then((small) => {
            const data = new FormData();
            data.set("file", small);
            return addAlbumPhoto(lang, albumId, data);
          })
          .catch(() => ({ ok: false, error: "errors.imageType" }));
        if (result.ok) added++;
        else lastError = result.error;
      }
      setStatus(
        lastError && added === 0
          ? { ok: false, text: m(lastError) }
          : {
              ok: !lastError,
              text:
                m("contentAdmin.uploadedN").replace("{count}", n(added)) +
                (lastError ? ` ${m(lastError)}` : ""),
            },
      );
      router.refresh();
    });

  const act = (action: () => Promise<Result>) =>
    start(async () => {
      setStatus(null);
      const result = await action().catch(() => ({
        ok: false,
        error: "auth.unexpected",
      }));
      if (!result.ok) return fail(result.error);
      setStatus({ ok: true, text: m("contentAdmin.done") });
      router.refresh();
    });

  return (
    <section
      aria-labelledby="photos-title"
      aria-busy={pending}
      className="flex max-w-4xl flex-col gap-4 rounded-xl border p-4"
    >
      <h2 id="photos-title" className="font-semibold">
        {m("contentAdmin.photos")}
      </h2>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="album-photos">{m("contentAdmin.addPhotos")}</Label>
        <Input
          id="album-photos"
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          aria-describedby="album-photos-hint"
          disabled={pending}
          onChange={(e) => {
            const files = Array.from(e.currentTarget.files ?? []);
            e.currentTarget.value = "";
            if (files.length > 0) upload(files);
          }}
        />
        <p id="album-photos-hint" className="text-muted-foreground text-xs">
          {m("contentAdmin.addPhotosHint")}
        </p>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={
          status?.ok === false ? "text-destructive text-sm" : "text-sm"
        }
      >
        {status?.text}
      </p>
      {photos.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {photos.map((p, i) => (
            <li
              key={p.id}
              className="flex flex-col gap-2 rounded-lg border p-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- preview of an uploaded file */}
              <img
                src={p.url}
                alt=""
                className="aspect-[4/3] w-full rounded-md object-cover"
              />
              <form
                className="flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  act(() =>
                    savePhotoCaption(lang, p.id, {
                      caption_en: String(data.get("caption_en") ?? ""),
                      caption_bn: String(data.get("caption_bn") ?? ""),
                    }),
                  );
                }}
              >
                {(["en", "bn"] as const).map((code) => (
                  <div key={code} className="flex flex-col gap-1">
                    <Label htmlFor={`caption-${p.id}-${code}`}>
                      {m(
                        code === "en"
                          ? "contentAdmin.captionEn"
                          : "contentAdmin.captionBn",
                      )}{" "}
                      <span className="sr-only">({n(i + 1)})</span>
                    </Label>
                    <Input
                      id={`caption-${p.id}-${code}`}
                      name={`caption_${code}`}
                      lang={code}
                      maxLength={200}
                      defaultValue={code === "en" ? p.caption_en : p.caption_bn}
                    />
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                  >
                    {m("contentAdmin.saveCaption")}
                  </Button>
                  {p.isCover ? (
                    <span className="bg-primary/10 text-primary rounded-full px-2 py-1 text-xs">
                      {m("contentAdmin.isCover")}
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => act(() => setAlbumCover(lang, p.id))}
                    >
                      {m("contentAdmin.setCover")}
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={pending}
                    onClick={() => {
                      if (window.confirm(m("contentAdmin.deleteConfirm")))
                        act(() => removeAlbumPhoto(lang, p.id));
                    }}
                  >
                    {m("contentAdmin.removePhoto")}
                  </Button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
