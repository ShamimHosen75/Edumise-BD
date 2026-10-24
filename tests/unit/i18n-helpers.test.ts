import { describe, expect, it } from "vitest";

import en from "@/dictionaries/en.json";
import { parseAcceptLanguage, pickLocale } from "@/i18n/negotiate";
import { stripLocale, switchLocalePath } from "@/i18n/path";
import { t } from "@/i18n/t";

describe("parseAcceptLanguage", () => {
  it("orders by quality, then by position", () => {
    expect(parseAcceptLanguage("en-US,en;q=0.8,bn;q=0.9")).toEqual([
      "en",
      "bn",
      "en",
    ]);
  });
  it("ignores wildcards, q=0 and junk", () => {
    expect(parseAcceptLanguage("*;q=0.5, bn;q=0, fr;q=abc")).toEqual([]);
    expect(parseAcceptLanguage("")).toEqual([]);
    expect(parseAcceptLanguage(null)).toEqual([]);
  });
});

describe("pickLocale", () => {
  it("prefers the saved cookie", () => {
    expect(pickLocale("bn", "en-US,en;q=0.9")).toBe("bn");
  });
  it("then the browser language", () => {
    expect(pickLocale(undefined, "bn-BD,bn;q=0.9,en;q=0.8")).toBe("bn");
    expect(pickLocale(undefined, "fr-FR,en;q=0.5,bn;q=0.4")).toBe("en");
  });
  it("ignores an invalid cookie", () => {
    expect(pickLocale("xx", "bn")).toBe("bn");
  });
  it("defaults to English", () => {
    expect(pickLocale(null, null)).toBe("en");
    expect(pickLocale(undefined, "fr,de")).toBe("en");
  });
});

describe("switchLocalePath", () => {
  it("keeps the rest of the path", () => {
    expect(switchLocalePath("/en/notices/5", "bn")).toBe("/bn/notices/5");
    expect(switchLocalePath("/bn/dashboard/settings", "en")).toBe(
      "/en/dashboard/settings",
    );
  });
  it("handles the home page with or without a trailing slash", () => {
    expect(switchLocalePath("/en", "bn")).toBe("/bn");
    expect(switchLocalePath("/en/", "bn")).toBe("/bn");
  });
  it("adds a language to a path without one", () => {
    expect(switchLocalePath("/notices", "bn")).toBe("/bn/notices");
    expect(switchLocalePath("/", "en")).toBe("/en");
  });
  it("only strips a real language segment", () => {
    expect(stripLocale("/english/page")).toBe("/english/page");
    expect(stripLocale("/en")).toBe("/");
  });
});

describe("t", () => {
  it("looks up nested keys", () => {
    expect(t(en, "notFound.title")).toBe("Page not found");
  });
  it("fills placeholders", () => {
    expect(t(en, "home.heading", { school: "Sunrise High School" })).toBe(
      "Welcome to Sunrise High School",
    );
    expect(t(en, "home.established", { year: 1975 })).toBe("Established 1975");
  });
  it("leaves unknown placeholders visible", () => {
    expect(t(en, "home.heading", {})).toBe("Welcome to {school}");
  });
  it("returns the key for a missing entry instead of crashing", () => {
    // @ts-expect-error unknown keys are a type error; at runtime the key is shown.
    expect(t(en, "home.missing")).toBe("home.missing");
  });
});
