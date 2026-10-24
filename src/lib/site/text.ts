/**
 * Turns stored page text into plain paragraphs. Any HTML tags are removed (never rendered),
 * so this is safe for untrusted content. Step 2.2 replaces it with sanitised rich text.
 */
export function toParagraphs(body: string | null | undefined): string[] {
  if (!body) return [];
  return body
    .replace(/<\/(p|div|h[1-6]|li)>|<br\s*\/?>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}
