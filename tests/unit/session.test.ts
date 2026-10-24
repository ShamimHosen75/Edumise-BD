import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// redirect() and forbidden() throw in Next; mimic that so we can assert on them.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  forbidden: () => {
    throw new Error("FORBIDDEN");
  },
}));

const state = vi.hoisted(() => ({
  user: null as null | { id: string; email: string },
  profile: null as null | Record<string, unknown>,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: state.profile }) }),
      }),
    }),
  }),
}));

const profile = (over: Record<string, unknown> = {}) => ({
  role: "teacher",
  full_name_en: "Kamal Hossain",
  full_name_bn: "কামাল হোসেন",
  must_change_password: false,
  is_active: true,
  ...over,
});

async function load() {
  vi.resetModules(); // React cache() is per module instance
  return import("@/lib/auth/session");
}

describe("requireUser / requireRole", () => {
  beforeEach(() => {
    state.user = { id: "u1", email: "teacher@sunrise.test" };
    state.profile = profile();
  });

  it("returns the user when logged in with an allowed role", async () => {
    const { requireRole } = await load();
    await expect(
      requireRole("en", ["teacher", "admin"]),
    ).resolves.toMatchObject({ role: "teacher", id: "u1" });
  });

  it("sends a logged-out visitor to login", async () => {
    state.user = null;
    const { requireUser } = await load();
    await expect(requireUser("bn")).rejects.toThrow("REDIRECT:/bn/login");
  });

  it("answers 403 for a role that is not allowed", async () => {
    const { requireRole } = await load();
    await expect(requireRole("en", ["admin", "super_admin"])).rejects.toThrow(
      "FORBIDDEN",
    );
  });

  it("treats a deactivated profile as no access (no redirect loop)", async () => {
    state.profile = profile({ is_active: false });
    const { requireUser, getCurrentUser } = await load();
    await expect(getCurrentUser()).resolves.toBeNull();
    await expect(requireUser("en")).rejects.toThrow(
      "REDIRECT:/en/login?error=noaccess",
    );
  });

  it("treats a missing or unknown role as no access", async () => {
    for (const p of [
      profile({ role: null }),
      profile({ role: "janitor" }),
      null,
    ]) {
      state.profile = p;
      const { requireUser } = await load();
      await expect(requireUser("en")).rejects.toThrow(
        "REDIRECT:/en/login?error=noaccess",
      );
    }
  });

  it("reports the forced password change flag", async () => {
    state.profile = profile({ must_change_password: true });
    const { requireUser } = await load();
    await expect(requireUser("en")).resolves.toMatchObject({
      mustChangePassword: true,
    });
  });
});
