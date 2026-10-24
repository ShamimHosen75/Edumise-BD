/** Share links for a page (Facebook, WhatsApp, X). URL and title are encoded. */
export function shareLinks(url: string, title: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
    x: `https://x.com/intent/post?url=${u}&text=${t}`,
  };
}

/** Search text that is safe inside a PostgREST or() filter: no wildcards, commas, brackets or quotes. */
export function cleanSearch(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "")
    .replace(/[%_\\,()"*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}
