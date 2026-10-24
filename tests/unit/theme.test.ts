import { describe, expect, it } from "vitest";

import {
  buildThemeCss,
  contrastRatio,
  DEFAULT_THEME,
  isHexColor,
  luminance,
  readableTextColor,
} from "@/lib/theme";

describe("colour helpers", () => {
  it("validates #RRGGBB only", () => {
    expect(isHexColor("#0f766e")).toBe(true);
    expect(isHexColor("#0F766E")).toBe(true);
    for (const bad of ["0f766e", "#fff", "#0f766e00", "red", "", null, 123]) {
      expect(isHexColor(bad)).toBe(false);
    }
  });
  it("computes luminance and contrast like WCAG", () => {
    expect(luminance("#000000")).toBe(0);
    expect(luminance("#ffffff")).toBeCloseTo(1);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1);
  });
  it("throws on a bad colour", () => {
    expect(() => luminance("blue")).toThrow(RangeError);
  });
  it("picks readable text for a background", () => {
    expect(readableTextColor("#0f766e")).toBe("#ffffff");
    expect(readableTextColor("#f59e0b")).toBe("#000000");
    expect(readableTextColor("#ffffff")).toBe("#000000");
    expect(readableTextColor("#000000")).toBe("#ffffff");
  });
  it("chosen text colour always meets AA (4.5:1) for typical brand colours", () => {
    for (const bg of [
      "#0f766e",
      "#1d4ed8",
      "#b91c1c",
      "#15803d",
      "#7c3aed",
      "#f59e0b",
      "#facc15",
    ]) {
      expect(contrastRatio(bg, readableTextColor(bg))).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });
});

describe("buildThemeCss", () => {
  it("uses the school colours", () => {
    const css = buildThemeCss({ primary: "#1d4ed8", secondary: "#facc15" });
    expect(css).toContain("--primary:#1d4ed8;");
    expect(css).toContain("--primary-foreground:#ffffff;");
    expect(css).toContain("--secondary-brand:#facc15;");
    expect(css).toContain("--secondary-brand-foreground:#000000;");
  });
  it("falls back to defaults when settings are missing", () => {
    expect(buildThemeCss({})).toContain(`--primary:${DEFAULT_THEME.primary};`);
  });
  it("never lets a stored value inject CSS or HTML", () => {
    const css = buildThemeCss({
      primary: "red;}</style><script>alert(1)</script>",
      secondary: "#fff;x:y",
    });
    expect(css).not.toContain("<");
    expect(css).not.toContain("script");
    expect(css).toContain(`--primary:${DEFAULT_THEME.primary};`);
    expect(css).toContain(`--secondary-brand:${DEFAULT_THEME.secondary};`);
  });
});
