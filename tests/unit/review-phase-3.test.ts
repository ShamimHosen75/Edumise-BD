import { describe, expect, it } from "vitest";

import { duplicateField } from "@/lib/academic";
import { canManageLogin } from "@/lib/auth/roles";
import { fetchAll, PAGE_SIZE } from "@/lib/supabase/fetch-all";
import { reviewSchema } from "@/lib/validation/admission";
import { loginSchema } from "@/lib/validation/auth";
import { staffLoginSchema } from "@/lib/validation/staff";

// Regression tests for the Phase 3 code review (docs/code-review-phase-3.md).

describe("canManageLogin (S3, F4)", () => {
  const admin = { id: "a", role: "admin" as const };
  const sup = { id: "s", role: "super_admin" as const };
  it("nobody resets, switches off or removes their own login", () => {
    expect(canManageLogin(admin, { id: "a", role: "admin" })).toBe(false);
    expect(canManageLogin(sup, { id: "s", role: "super_admin" })).toBe(false);
  });
  it("only a super admin manages admins and super admins", () => {
    expect(canManageLogin(admin, { id: "b", role: "admin" })).toBe(false);
    expect(canManageLogin(admin, { id: "x", role: "super_admin" })).toBe(false);
    expect(canManageLogin(sup, { id: "b", role: "admin" })).toBe(true);
  });
  it("admins manage teachers and accountants", () => {
    expect(canManageLogin(admin, { id: "t", role: "teacher" })).toBe(true);
    expect(canManageLogin(admin, { id: "c", role: "accountant" })).toBe(true);
    expect(
      canManageLogin(
        { id: "t", role: "teacher" },
        { id: "c", role: "accountant" },
      ),
    ).toBe(false);
  });
});

describe("duplicateField (F5)", () => {
  const fields = ["name_en", "name_bn", "rank", "is_teaching"];
  it("points at the column named in the unique index", () => {
    expect(
      duplicateField(
        'duplicate key value violates unique constraint "designations_name_en_key"',
        fields,
        "rank",
      ),
    ).toBe("name_en");
    expect(
      duplicateField('… constraint "designations_rank_key"', fields, "rank"),
    ).toBe("rank");
  });
  it("falls back to the main field for other indexes", () => {
    expect(
      duplicateField(
        '… constraint "sections_class_name_ci"',
        ["class_id", "name_en"],
        "name_en",
      ),
    ).toBe("name_en");
    expect(duplicateField(undefined, fields, "rank")).toBe("rank");
  });
});

describe("fetchAll (P1: the API returns at most 1000 rows)", () => {
  it("reads page after page until a short page", async () => {
    const total = 2 * PAGE_SIZE + 5;
    const calls: [number, number][] = [];
    const rows = await fetchAll(async (from, to) => {
      calls.push([from, to]);
      const data = Array.from(
        { length: Math.max(0, Math.min(to, total - 1) - from + 1) },
        (_, i) => from + i,
      );
      return { data, error: null };
    });
    expect(rows).toHaveLength(total);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });
  it("throws on an error", async () => {
    await expect(
      fetchAll(async () => ({ data: null, error: { message: "boom" } })),
    ).rejects.toThrow("boom");
  });
});

describe("validation fixes", () => {
  const base = {
    status: "under_review",
    test_at: "",
    test_venue: "",
    office_note: "",
  };
  it("accepts marks like 72.1 and 33.33 (F5, floating point)", () => {
    for (const v of ["72.1", "33.3", "1.1", "33.33", "99.99"])
      expect(reviewSchema.safeParse({ ...base, test_marks: v }).success).toBe(
        true,
      );
    expect(
      reviewSchema.safeParse({ ...base, test_marks: "72.123" }).success,
    ).toBe(false);
  });
  it("logs in with Bangla digits (F12)", () => {
    expect(
      loginSchema.parse({ identifier: "২০২৬০৬০০০১", password: "x" }).identifier,
    ).toBe("2026060001");
    expect(
      loginSchema.parse({ identifier: "০১৭১২৩৪৫৬৭৮", password: "x" })
        .identifier,
    ).toBe("01712345678");
  });
  it("staff cannot take the student and guardian login addresses (S4)", () => {
    for (const email of [
      "student-2026069999@student.invalid",
      "guardian-01712345678@Guardian.invalid",
    ])
      expect(
        staffLoginSchema.safeParse({ email, phone: "", role: "teacher" })
          .success,
      ).toBe(false);
  });
});
