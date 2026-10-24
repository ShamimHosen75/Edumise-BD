import { fitWithin, webpName } from "@/lib/content/image-size";

/**
 * Resizes a photo in the browser to at most 1600 px on its longest side and encodes it as
 * WebP (or PNG where the browser cannot write WebP). Big phone photos become small uploads.
 */
export async function resizeToWebp(file: File, max = 1600): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const size = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.85),
  );
  if (!blob) throw new Error("Could not encode the photo");
  const name =
    blob.type === "image/webp"
      ? webpName(file.name)
      : webpName(file.name).replace(/\.webp$/, ".png");
  return new File([blob], name, { type: blob.type });
}
