import { describe, expect, it } from "vitest";

import { isStudentCode, loginSchema } from "@/lib/validation/auth";
import {
  enrollmentSchema,
  guardianLinkSchema,
  newStudentSchema,
  promotionSchema,
  studentFormValues,
  studentSchema,
} from "@/lib/validation/student";

const student = {
  ...studentFormValues(null),
  full_name_en: "  Test Student ",
  gender: "female",
};

describe("studentSchema", () => {
  it("accepts a minimal student and trims text", () => {
    const r = studentSchema.parse(student);
    expect(r.full_name_en).toBe("Test Student");
    expect(r.status).toBe("active");
  });
  it("checks private fields", () => {
    const r = studentSchema.safeParse({
      ...student,
      birth_date: "2999-01-01",
      birth_reg_no: "123",
      personal_phone: "555",
    });
    expect(r.success).toBe(false);
    const fields = r.error!.issues.map((i) => i.path[0]);
    expect(fields).toEqual(["birth_date", "birth_reg_no", "personal_phone"]);
  });
  it("normalises Bangla digits in the mobile number", () => {
    expect(
      studentSchema.parse({ ...student, personal_phone: "০১৭১২৩৪৫৬৭৮" })
        .personal_phone,
    ).toBe("01712345678");
  });
});

describe("newStudentSchema", () => {
  it("needs a section; an empty roll means the next one", () => {
    expect(
      newStudentSchema.safeParse({ ...student, roll: "", group_id: null })
        .success,
    ).toBe(false);
    const r = newStudentSchema.parse({
      ...student,
      section_id: 3,
      roll: "",
      group_id: null,
    });
    expect(r.roll).toBeNull();
    // What the browser sends after parsing it once.
    expect(newStudentSchema.parse({ ...r, roll: null }).roll).toBeNull();
    expect(
      newStudentSchema.parse({
        ...student,
        section_id: 3,
        roll: "12",
        group_id: null,
      }).roll,
    ).toBe(12);
  });
  it("rejects a roll outside 1-999", () => {
    const r = newStudentSchema.safeParse({
      ...student,
      section_id: 3,
      roll: "1000",
      group_id: null,
    });
    expect(r.error?.issues[0]?.message).toBe("errors.roll");
  });
});

describe("enrollmentSchema", () => {
  it("coerces the roll", () => {
    expect(
      enrollmentSchema.parse({
        session_id: 1,
        section_id: 2,
        roll: "5",
        group_id: null,
      }).roll,
    ).toBe(5);
  });
});

describe("guardianLinkSchema", () => {
  const base = {
    guardian_id: null,
    full_name_en: "",
    full_name_bn: "",
    phone: "",
    occupation: "",
    relation: "mother",
    is_primary: false,
  };
  it("a new guardian needs a name and a mobile", () => {
    const r = guardianLinkSchema.safeParse(base);
    expect(r.error?.issues.map((i) => i.path[0])).toEqual([
      "full_name_en",
      "phone",
    ]);
  });
  it("an existing guardian needs only the id", () => {
    expect(
      guardianLinkSchema.safeParse({ ...base, guardian_id: 7 }).success,
    ).toBe(true);
  });
});

describe("promotionSchema", () => {
  const ok = {
    from_session: 1,
    to_session: 2,
    class_id: 1,
    decisions: [{ student_id: 1, promote: true }],
  };
  it("accepts decisions for another session", () => {
    expect(promotionSchema.safeParse(ok).success).toBe(true);
  });
  it("rejects promoting into the same session or with no students", () => {
    expect(
      promotionSchema.safeParse({ ...ok, to_session: 1 }).error?.issues[0]
        ?.message,
    ).toBe("promotion.sameSession");
    expect(promotionSchema.safeParse({ ...ok, decisions: [] }).success).toBe(
      false,
    );
  });
});

describe("student ID login", () => {
  it("recognises student IDs (year, class 06-10, serial)", () => {
    expect(isStudentCode("2026060001")).toBe(true);
    expect(isStudentCode("2026100123")).toBe(true);
    expect(isStudentCode("2026050001")).toBe(false);
    expect(isStudentCode("01712345678")).toBe(false);
  });
  it("the login form accepts a student ID", () => {
    expect(
      loginSchema.safeParse({ identifier: "2026060001", password: "x" })
        .success,
    ).toBe(true);
  });
});
