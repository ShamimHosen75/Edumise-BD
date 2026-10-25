import { describe, expect, it } from "vitest";

import { tempPassword } from "@/lib/auth/temp-password";
import { newPasswordSchema } from "@/lib/validation/auth";
import {
  assignmentSchema,
  designationSchema,
  splitStaff,
  staffFormValues,
  staffLoginSchema,
  staffSchema,
} from "@/lib/validation/staff";

const issues = (r: {
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) =>
  Object.fromEntries(
    (r.error?.issues ?? []).map((i) => [String(i.path[0]), i.message]),
  );

const base = {
  ...staffFormValues(null, null),
  full_name_en: "A",
  designation_id: 4,
};

describe("staff form", () => {
  it("starts empty, public, with no designation", () => {
    const v = staffFormValues(null, null);
    expect(v).toMatchObject({
      full_name_en: "",
      is_public: true,
      sort_order: 0,
      nid: "",
    });
    expect(staffSchema.safeParse(v).success).toBe(false);
  });
  it("accepts a valid member of staff and normalises numbers", () => {
    const v = staffSchema.parse({
      ...base,
      nid: "১৯৯০০০০০০০০০৩",
      personal_phone: "+880 1711-000000",
      joined_on: "2020-01-01",
      left_on: "2024-12-31",
    });
    expect(v.nid).toBe("1990000000003");
    expect(v.personal_phone).toBe("01711000000");
  });
  it("names each problem", () => {
    expect(
      issues(
        staffSchema.safeParse({
          ...base,
          full_name_en: "",
          nid: "123",
          personal_phone: "555",
          email: "x",
          birth_date: "2999-01-01",
          joined_on: "2020-01-01",
          left_on: "2019-01-01",
        }),
      ),
    ).toEqual({
      full_name_en: "errors.required",
      nid: "errors.nid",
      personal_phone: "errors.mobile",
      email: "errors.email",
      birth_date: "errors.date",
      left_on: "errors.endBeforeStart",
    });
  });
  it("splits public and private fields; empty means null", () => {
    const { staff, private: priv } = splitStaff(
      staffSchema.parse({ ...base, nid: "1234567890", address: "" }),
    );
    expect(staff).not.toHaveProperty("nid");
    expect(staff).toMatchObject({
      joined_on: null,
      left_on: null,
      designation_id: 4,
    });
    expect(priv).toEqual({
      nid: "1234567890",
      birth_date: null,
      address: null,
      personal_phone: null,
      email: null,
    });
  });
  it("loads saved rows back into the form", () => {
    expect(
      staffFormValues(
        {
          full_name_en: "B",
          designation_id: 2,
          left_on: null,
          is_public: false,
        },
        { nid: "1234567890", birth_date: null },
      ),
    ).toMatchObject({
      full_name_en: "B",
      designation_id: 2,
      left_on: "",
      is_public: false,
      nid: "1234567890",
      birth_date: "",
    });
  });
});

describe("login, assignment and designation input", () => {
  it("checks the login email, mobile and role", () => {
    expect(
      staffLoginSchema.parse({
        email: " New@School.BD ",
        phone: "",
        role: "teacher",
      }),
    ).toEqual({
      email: "new@school.bd",
      phone: "",
      role: "teacher",
    });
    expect(
      issues(
        staffLoginSchema.safeParse({
          email: "nope",
          phone: "123",
          role: "super_admin",
        }),
      ),
    ).toEqual({
      email: "errors.email",
      phone: "errors.mobile",
      role: "errors.required",
    });
  });
  it("needs a session, section and subject", () => {
    expect(
      assignmentSchema.safeParse({
        session_id: 1,
        section_id: 2,
        subject_id: 3,
      }).success,
    ).toBe(true);
    expect(
      assignmentSchema.safeParse({
        session_id: 1,
        section_id: null,
        subject_id: 3,
      }).success,
    ).toBe(false);
  });
  it("keeps designation ranks between 1 and 99", () => {
    const d = { rank: "3", name_en: "Clerk", name_bn: "", is_teaching: false };
    expect(designationSchema.parse(d).rank).toBe(3);
    expect(issues(designationSchema.safeParse({ ...d, rank: "0" }))).toEqual({
      rank: "errors.rank",
    });
  });
});

describe("tempPassword", () => {
  it("meets the password rule and avoids look-alike characters", () => {
    for (let i = 0; i < 200; i++) {
      const p = tempPassword();
      expect(p).toHaveLength(12);
      expect(p).toMatch(/^[A-Za-z2-9]+$/);
      expect(p).not.toMatch(/[01OIl]/);
      expect(
        newPasswordSchema.safeParse({ password: p, confirm: p }).success,
      ).toBe(true);
    }
  });
  it("is different each time", () => {
    expect(new Set(Array.from({ length: 50 }, () => tempPassword())).size).toBe(
      50,
    );
  });
});

describe("emails with spaces around them", () => {
  it("are trimmed before they are checked", async () => {
    const { contactSchema } = await import("@/lib/validation/people");
    expect(
      contactSchema.parse({
        name: "A",
        phone: "01711000000",
        email: " a@b.bd ",
        subject: "S",
        message: "A long enough message",
      }).email,
    ).toBe("a@b.bd");
    expect(staffSchema.parse({ ...base, email: " x@y.bd " }).email).toBe(
      "x@y.bd",
    );
  });
});
