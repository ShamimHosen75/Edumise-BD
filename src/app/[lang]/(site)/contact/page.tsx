import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock, Mail, MapPin, Phone } from "lucide-react";

import { ContactForm } from "@/components/site/contact-form";
import { ContentHeader } from "@/components/site/content/content-header";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { errorKeys, pickMessages } from "@/i18n/messages";
import { t, type TranslationKey } from "@/i18n/t";
import { localizeDigits, pickLocalized } from "@/lib/format";
import { schoolName } from "@/lib/school";
import { getSchoolSettings } from "@/lib/settings";
import { isMapEmbedUrl } from "@/lib/validation/school-settings";

type Props = { params: Promise<{ lang: string }> };

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.contact.title, description: dict.contact.intro };
}

export default async function ContactPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const [dict, settings] = await Promise.all([
    getDictionary(lang),
    getSchoolSettings(),
  ]);
  const c = dict.contact;
  const name = schoolName(settings, lang, dict);
  const map =
    settings?.map_embed_url && isMapEmbedUrl(settings.map_embed_url)
      ? settings.map_embed_url
      : null;
  const address = settings ? pickLocalized(settings, "address", lang) : "";
  const hours = settings ? pickLocalized(settings, "office_hours", lang) : "";
  const messages = pickMessages(dict, [
    ...Object.keys(c).map((k) => `contact.${k}` as TranslationKey),
    "auth.unexpected",
    ...errorKeys(dict),
  ]);
  const row = "flex gap-3";
  const icon = "text-primary mt-0.5 size-5 shrink-0";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <ContentHeader title={c.title} intro={c.intro} />
      <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
        <section
          aria-labelledby="form-title"
          className="flex flex-col gap-4 rounded-xl border p-4 sm:p-6"
        >
          <h2 id="form-title" className="text-lg font-semibold">
            {c.formTitle}
          </h2>
          <ContactForm lang={lang} messages={messages} />
        </section>
        <section
          aria-labelledby="details-title"
          className="flex flex-col gap-4"
        >
          <h2 id="details-title" className="text-lg font-semibold">
            {c.details}
          </h2>
          <ul className="flex flex-col gap-3 text-sm">
            {address ? (
              <li className={row}>
                <MapPin className={icon} aria-hidden="true" />
                <span className="sr-only">{c.address}:</span>
                <span>{address}</span>
              </li>
            ) : null}
            {settings?.phone ? (
              <li className={row}>
                <Phone className={icon} aria-hidden="true" />
                <span className="sr-only">{dict.site.footer.phone}:</span>
                <a
                  href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`}
                  className="hover:underline"
                >
                  {localizeDigits(settings.phone, lang)}
                </a>
              </li>
            ) : null}
            {settings?.email ? (
              <li className={row}>
                <Mail className={icon} aria-hidden="true" />
                <span className="sr-only">{dict.site.footer.email}:</span>
                <a
                  href={`mailto:${settings.email}`}
                  className="break-all hover:underline"
                >
                  {settings.email}
                </a>
              </li>
            ) : null}
            {hours ? (
              <li className={row}>
                <Clock className={icon} aria-hidden="true" />
                <span className="sr-only">{dict.site.footer.officeHours}:</span>
                <span>{localizeDigits(hours, lang)}</span>
              </li>
            ) : null}
          </ul>
          {map ? (
            <iframe
              src={map}
              title={t(dict, "contact.map", { school: name })}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="aspect-[4/3] w-full rounded-xl border"
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}
