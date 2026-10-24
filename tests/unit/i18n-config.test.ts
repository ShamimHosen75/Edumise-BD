import { describe, expect, it } from "vitest";

import bn from "@/dictionaries/bn.json";
import en from "@/dictionaries/en.json";
import { defaultLocale, isLocale, locales } from "@/i18n/config";

function keyPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value).flatMap(([k, v]) =>
    keyPaths(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe("locale config", () => {
  it("supports exactly en and bn, defaulting to en", () => {
    expect(locales).toEqual(["en", "bn"]);
    expect(defaultLocale).toBe("en");
  });

  it.each(["en", "bn"])("accepts %s", (value) => {
    expect(isLocale(value)).toBe(true);
  });

  it.each(["", "EN", "fr", "bn-BD", "dashboard", undefined, null])(
    "rejects %s",
    (value) => {
      expect(isLocale(value)).toBe(false);
    },
  );
});

describe("dictionaries", () => {
  it("en and bn have the same keys", () => {
    expect(keyPaths(bn).sort()).toEqual(keyPaths(en).sort());
  });

  it("have no empty strings", () => {
    for (const dict of [en, bn]) {
      const values = JSON.stringify(dict).match(/""/g);
      expect(values).toBeNull();
    }
  });
});
