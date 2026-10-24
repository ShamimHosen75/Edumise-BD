import sanitizeHtml from "sanitize-html";

/** Plain-text summary of rich text for cards and link previews (ends with "…" if cut). */
export function excerpt(html: string | null | undefined, max = 160): string {
  const text = sanitizeHtml(html ?? "", {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
