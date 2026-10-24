import type { Dictionary } from "./get-dictionary";
import { t, type TranslationKey } from "./t";

export type Messages = Partial<Record<TranslationKey, string>>;

/** A small set of strings to hand to a client component (instead of the whole dictionary). */
export function pickMessages(
  dict: Dictionary,
  keys: readonly TranslationKey[],
): Messages {
  return Object.fromEntries(keys.map((key) => [key, t(dict, key)]));
}

/** Every errors.* key, for forms that show validation messages. */
export function errorKeys(dict: Dictionary): TranslationKey[] {
  return Object.keys(dict.errors).map((k) => `errors.${k}` as TranslationKey);
}

/** Client-side lookup; shows the key itself if a string was not passed down. */
export function msg(
  messages: Messages,
  key: string | undefined,
): string | undefined {
  if (!key) return undefined;
  return messages[key as TranslationKey] ?? key;
}
