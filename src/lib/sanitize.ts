import sanitizeHtml from "sanitize-html";

/**
 * Cleans rich text from the page editor. Used when saving AND when showing a page, so
 * even content written straight into the database cannot run scripts.
 *
 * Allowed: headings, paragraphs, lists, quotes, tables, links (https, mailto, tel, site
 * paths) and images from our own storage or /demo/. Everything else (scripts, iframes,
 * styles, event handlers like onerror, javascript: links) is removed.
 */
export function sanitizeRichText(
  html: string | null | undefined,
  opts: { mediaBaseUrl?: string } = {},
): string {
  if (!html) return "";
  const mediaBase = opts.mediaBaseUrl?.replace(/\/$/, "");
  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "br",
      "h2",
      "h3",
      "h4",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "a",
      "ul",
      "ol",
      "li",
      "blockquote",
      "hr",
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "code",
      "pre",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["https", "http"] },
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    exclusiveFilter: (frame) => {
      if (frame.tag !== "img") return false;
      const src = frame.attribs.src ?? "";
      const own =
        (mediaBase &&
          src.startsWith(
            `${mediaBase}/storage/v1/object/public/public-media/`,
          ) &&
          // A7 (Step 6.2): no "../" (plain or encoded) to step out of the bucket.
          !/(^|\/)(\.|%2e){2}(\/|%2f|$)/i.test(src) &&
          !/%2f|%5c|\\/i.test(src)) ||
        /^\/demo\/[a-z0-9-]+\.(jpg|png|webp)$/.test(src);
      return !own;
    },
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href ?? "";
        const external = /^https:\/\//.test(href);
        return {
          tagName,
          attribs: {
            href,
            ...(external
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {}),
          },
        };
      },
    },
  });
}

/** True when the HTML has visible text (used to treat a page as empty). */
export function hasText(html: string | null | undefined): boolean {
  return (
    sanitizeHtml(html ?? "", { allowedTags: [], allowedAttributes: {} }).trim()
      .length > 0
  );
}
