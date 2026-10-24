const HEX = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a #RRGGBB colour. */
export function luminance(hex: string): number {
  if (!isHexColor(hex)) throw new RangeError(`Not a #RRGGBB colour: ${hex}`);
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

/** WCAG contrast ratio between two colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white, whichever is more readable on the given background. */
export function readableTextColor(background: string): "#000000" | "#ffffff" {
  return contrastRatio(background, "#ffffff") >=
    contrastRatio(background, "#000000")
    ? "#ffffff"
    : "#000000";
}

export const DEFAULT_THEME = {
  primary: "#0f766e",
  secondary: "#f59e0b",
} as const;

/**
 * CSS that overrides the theme colours with the school's own. Only valid hex colours are
 * used (anything else falls back to the default), so settings can never inject CSS.
 */
export function buildThemeCss(colors: {
  primary?: string | null;
  secondary?: string | null;
}): string {
  const primary = isHexColor(colors.primary)
    ? colors.primary
    : DEFAULT_THEME.primary;
  const secondary = isHexColor(colors.secondary)
    ? colors.secondary
    : DEFAULT_THEME.secondary;
  return (
    `:root{--primary:${primary};--primary-foreground:${readableTextColor(primary)};` +
    `--ring:${primary};--secondary-brand:${secondary};` +
    `--secondary-brand-foreground:${readableTextColor(secondary)};}`
  );
}
