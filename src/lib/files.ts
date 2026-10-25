export type ImageType = "image/png" | "image/jpeg" | "image/webp";
export type DocumentType = ImageType | "application/pdf";

const EXTENSIONS: Record<DocumentType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/**
 * Detects an image type from the file's first bytes. The type a browser reports can be
 * faked, so uploads are checked against the real content.
 */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  const starts = (sig: number[], offset = 0) =>
    sig.every((b, i) => bytes[offset + i] === b);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "image/png";
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8))
    return "image/webp";
  return null;
}

export function imageExtension(type: DocumentType): string {
  return EXTENSIONS[type];
}

/** PDF or image, detected from the file's first bytes ("%PDF-" for PDF). */
export function detectDocumentType(bytes: Uint8Array): DocumentType | null {
  const pdf = [0x25, 0x50, 0x44, 0x46, 0x2d];
  if (pdf.every((b, i) => bytes[i] === b)) return "application/pdf";
  return detectImageType(bytes);
}

/** Cover and editor images. */
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
/**
 * Attachments and downloads. Uploads go through a server action, and Vercel accepts request
 * bodies up to 4.5 MB, so 4 MB is the most a file can be (next.config allows 5 MB bodies).
 */
export const ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024;

/** True when the form's file is bigger than max (checked in the browser before upload). */
export function fileTooLarge(file: FormDataEntryValue | null, max: number) {
  return typeof file === "object" && file !== null && file.size > max;
}

/** Short label for a file type: "PDF", "JPG", "PNG", "WEBP"; "" when unknown. */
export function fileTypeLabel(mime: string | null | undefined): string {
  const ext = EXTENSIONS[mime as DocumentType];
  return ext ? ext.toUpperCase() : "";
}

/**
 * Storage paths that may be deleted: our own uploads under one of the expected folders.
 * Demo files ship with the app, and a path stored in a row is never trusted to point
 * anywhere else (a row could have been edited to name another file).
 */
export function deletablePaths(
  paths: unknown[],
  prefixes: readonly string[],
): string[] {
  return paths.filter(
    (p): p is string =>
      typeof p === "string" &&
      !p.includes("..") &&
      !p.startsWith("/") &&
      prefixes.some((prefix) => p.startsWith(prefix)),
  );
}
