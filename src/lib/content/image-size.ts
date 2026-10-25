/** Largest size within max x max that keeps the aspect ratio (never enlarges). */
export function fitWithin(
  width: number,
  height: number,
  max = 1600,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** WebP file name for a resized photo: "IMG 0042.JPG" -> "img-0042.webp". */
export function webpName(name: string): string {
  const base = name
    .replace(/\.[^.]*$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "photo"}.webp`;
}

/** The centred square of an image: source x, y and side length. */
export function centerSquare(width: number, height: number) {
  const side = Math.min(width, height);
  return {
    x: Math.floor((width - side) / 2),
    y: Math.floor((height - side) / 2),
    side,
  };
}
