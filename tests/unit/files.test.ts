import { describe, expect, it } from "vitest";

import { detectImageType, imageExtension } from "@/lib/files";

const bytes = (...b: number[]) =>
  new Uint8Array([...b, ...new Array(16).fill(0)]);

describe("detectImageType", () => {
  it("recognises PNG, JPEG and WebP by their first bytes", () => {
    expect(
      detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
    ).toBe("image/png");
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    const webp = bytes(
      0x52,
      0x49,
      0x46,
      0x46,
      0,
      0,
      0,
      0,
      0x57,
      0x45,
      0x42,
      0x50,
    );
    expect(detectImageType(webp)).toBe("image/webp");
  });
  it("rejects SVG, HTML, PDF and empty files even if they claim to be images", () => {
    const text = (s: string) => new TextEncoder().encode(s);
    expect(
      detectImageType(
        text(
          '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        ),
      ),
    ).toBeNull();
    expect(
      detectImageType(text("<html><script>alert(1)</script></html>")),
    ).toBeNull();
    expect(detectImageType(text("%PDF-1.7"))).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });
  it("rejects a RIFF file that is not WebP (e.g. WAV)", () => {
    expect(
      detectImageType(
        bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45),
      ),
    ).toBeNull();
  });
  it("maps types to file extensions", () => {
    expect(imageExtension("image/png")).toBe("png");
    expect(imageExtension("image/jpeg")).toBe("jpg");
    expect(imageExtension("image/webp")).toBe("webp");
  });
});
