import type { Dictionary } from "./get-dictionary";

type Join<K extends string, P extends string> = `${K}.${P}`;

/** All dot paths to string values, e.g. "home.heading". */
export type DotPath<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : T[K] extends object
      ? Join<K, DotPath<T[K]>>
      : never;
}[keyof T & string];

export type TranslationKey = DotPath<Dictionary>;

/**
 * Looks up a dictionary string by key and fills {placeholders}.
 * Unknown placeholders are left as-is so missing values are visible, not silent.
 */
export function t(
  dict: Dictionary,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const value = key.split(".").reduce<unknown>((node, part) => {
    return node && typeof node === "object"
      ? (node as Record<string, unknown>)[part]
      : undefined;
  }, dict);
  if (typeof value !== "string") return key;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
