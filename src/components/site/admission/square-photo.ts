import { centerSquare } from "@/lib/content/image-size";

/**
 * Cuts a photo to its centred square, at most 600 px, as JPEG. Lowers the quality until
 * the file fits the limit (passport-style photos easily fit 500 KB).
 */
export async function squarePhoto(file: File, maxBytes: number): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const { x, y, side } = centerSquare(bitmap.width, bitmap.height);
  const size = Math.min(600, side);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);
  context.drawImage(bitmap, x, y, side, side, 0, 0, size, size);
  bitmap.close();
  for (const quality of [0.9, 0.8, 0.7, 0.6, 0.5]) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (blob && blob.size <= maxBytes)
      return new File([blob], "photo.jpg", { type: "image/jpeg" });
  }
  throw new Error("Photo is too large");
}
