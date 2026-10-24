import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Capture the function passed to unstable_cache so we can check what would be cached.
const cache = vi.hoisted(() => ({
  inner: undefined as undefined | (() => Promise<unknown>),
}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>) => {
    cache.inner = fn;
    return fn;
  },
}));

const query = vi.hoisted(() => ({
  result: { data: null as unknown, error: null as null | { message: string } },
}));
vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({
    from: () => ({ select: () => ({ maybeSingle: async () => query.result }) }),
  }),
}));

describe("getSchoolSettings", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("returns the settings row", async () => {
    query.result = { data: { name_en: "Sunrise High School" }, error: null };
    const { getSchoolSettings } = await import("@/lib/settings");
    await expect(getSchoolSettings()).resolves.toEqual({
      name_en: "Sunrise High School",
    });
  });

  it("falls back to null when the database is unreachable", async () => {
    query.result = { data: null, error: { message: "fetch failed" } };
    const { getSchoolSettings } = await import("@/lib/settings");
    await expect(getSchoolSettings()).resolves.toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("fetch failed"),
    );
  });

  it("does not cache a failed read (the cached function throws instead of returning null)", async () => {
    query.result = { data: null, error: { message: "fetch failed" } };
    await import("@/lib/settings");
    await expect(cache.inner!()).rejects.toThrow("fetch failed");
  });
});
