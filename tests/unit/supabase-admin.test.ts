import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` throws outside a React Server environment; stub it for Node tests.
vi.mock("server-only", () => ({}));

const root = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("supabase admin client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("throws when the service-role key is missing", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { createAdminClient } = await import("@/lib/supabase/admin");
    expect(() => createAdminClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("creates a client when the key is set", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    const { createAdminClient } = await import("@/lib/supabase/admin");
    expect(createAdminClient()).toHaveProperty("from");
  });

  it("throws when the public URL is invalid", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not a url");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    const { createAdminClient } = await import("@/lib/supabase/admin");
    expect(() => createAdminClient()).toThrow();
  });

  it("admin and server clients are marked server-only", () => {
    expect(read("src/lib/supabase/admin.ts")).toMatch(
      /^import "server-only";/m,
    );
    expect(read("src/lib/supabase/server.ts")).toMatch(
      /^import "server-only";/m,
    );
  });

  it("the service-role key is never exposed with a NEXT_PUBLIC_ prefix", () => {
    expect(read(".env.example")).not.toMatch(/NEXT_PUBLIC_[A-Z_]*SERVICE/);
  });
});
