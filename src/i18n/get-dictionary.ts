import "server-only";

import type { Locale } from "./config";
import type en from "@/dictionaries/en.json";

export type Dictionary = typeof en;

const loaders: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import("@/dictionaries/en.json").then((m) => m.default),
  bn: () => import("@/dictionaries/bn.json").then((m) => m.default),
};

export function getDictionary(locale: Locale): Promise<Dictionary> {
  return loaders[locale]();
}
