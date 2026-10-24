import type { Locale } from "@/i18n/config";

const BANGLA_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
export const SCHOOL_TIME_ZONE = "Asia/Dhaka";

/** Replaces 0-9 with Bangla digits; everything else is unchanged. */
export function toBanglaDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => BANGLA_DIGITS[Number(d)] ?? d);
}

/** Digits in the reader's language (Bangla digits for bn). */
export function localizeDigits(value: string | number, lang: Locale): string {
  return lang === "bn" ? toBanglaDigits(value) : String(value);
}

/** Number with South Asian grouping (1,23,456). Set grouping: false for years and rolls. */
export function formatNumber(
  value: number,
  lang: Locale,
  options: { grouping?: boolean; decimals?: number } = {},
) {
  const { grouping = true, decimals } = options;
  return new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-IN", {
    useGrouping: grouping,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

type DateInput = Date | string | number;

/** Date in Bangladesh time, e.g. "24 October 2026" / "২৪ অক্টোবর, ২০২৬". */
export function formatDate(
  value: DateInput,
  lang: Locale,
  style: "long" | "medium" | "short" = "long",
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new RangeError(`Invalid date: ${String(value)}`);
  return new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", {
    dateStyle: style,
    timeZone: SCHOOL_TIME_ZONE,
  }).format(date);
}

/**
 * Money stored as integer poisha (BDT x 100), shown in taka with two decimals.
 * en: "৳1,23,456.50"   bn: "১,২৩,৪৫৬.৫০৳"
 */
export function formatCurrency(poisha: number, lang: Locale): string {
  if (!Number.isSafeInteger(poisha))
    throw new RangeError("Amount must be a whole number of poisha");
  const taka = poisha / 100;
  if (lang === "bn") {
    return new Intl.NumberFormat("bn-BD", {
      style: "currency",
      currency: "BDT",
    }).format(taka);
  }
  const sign = taka < 0 ? "-" : "";
  return `${sign}৳${formatNumber(Math.abs(taka), "en", { decimals: 2 })}`;
}

/**
 * Picks the Bangla column when the reader is in bn and it is filled in; otherwise English.
 * pickLocalized(row, "title", "bn") reads row.title_bn, falling back to row.title_en.
 */
export function pickLocalized<F extends string>(
  row: { [K in `${F}_en`]: string | null } & {
    [K in `${F}_bn`]?: string | null;
  },
  field: F,
  lang: Locale,
): string {
  const en =
    (row as Record<string, string | null | undefined>)[`${field}_en`] ?? "";
  if (lang !== "bn") return en;
  const bn = (row as Record<string, string | null | undefined>)[`${field}_bn`];
  return bn && bn.trim() !== "" ? bn : en;
}

/**
 * Weekday and time in Bangladesh time, 24-hour clock in both languages (bn would otherwise
 * show "AM"/"PM" in English letters): "Thursday 09:00" / "বৃহস্পতিবার ৯:০০".
 */
export function formatWeekdayTime(value: DateInput, lang: Locale): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new RangeError(`Invalid date: ${String(value)}`);
  return new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", {
    timeZone: SCHOOL_TIME_ZONE,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** File size for people: "820 KB", "2.3 MB" / "৮২০ কেবি", "২.৩ এমবি". */
export function formatBytes(bytes: number, lang: Locale): string {
  const units =
    lang === "bn" ? ["বাইট", "কেবি", "এমবি", "জিবি"] : ["B", "KB", "MB", "GB"];
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const decimals = unit === 0 || value >= 10 ? 0 : 1;
  return `${formatNumber(Number(value.toFixed(decimals)), lang, { decimals })} ${units[unit]}`;
}

/** Date and 24-hour time in Bangladesh time: "24 October 2026, 09:00" / "২৪ অক্টোবর, ২০২৬ ৯:০০". */
export function formatDateTime(value: DateInput, lang: Locale): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new RangeError(`Invalid date: ${String(value)}`);
  return new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", {
    timeZone: SCHOOL_TIME_ZONE,
    dateStyle: "long",
    timeStyle: "short",
    hourCycle: "h23",
  }).format(date);
}
