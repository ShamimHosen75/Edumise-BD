import { describe, expect, it } from "vitest";

import {
  ageOn,
  formatTrackingNo,
  isBirthRegNo,
  meritList,
  nextRoll,
  normalizeBirthRegNo,
  normalizeTrackingNo,
  studentCode,
} from "@/lib/admission";
import { createUploadToken, verifyUploadToken } from "@/lib/admission-token";
import { centerSquare } from "@/lib/content/image-size";
import {
  applicationSchema,
  guardianStep,
  reviewSchema,
  statusLookupSchema,
  studentStep,
} from "@/lib/validation/admission";

describe("birth registration number", () => {
  it("is exactly 17 digits, in either script, spaces and dashes ignored", () => {
    expect(isBirthRegNo("20143512345678901")).toBe(true);
    expect(isBirthRegNo("২০১৪৩৫১২৩৪৫৬৭৮৯০১")).toBe(true);
    expect(isBirthRegNo("2014 3512-3456 78901")).toBe(true);
    expect(normalizeBirthRegNo("২০১৪-৩৫")).toBe("201435");
    for (const bad of [
      "",
      "123",
      "2014351234567890",
      "201435123456789012",
      "2014351234567890a",
    ])
      expect(isBirthRegNo(bad), bad).toBe(false);
  });
});

describe("mobile number in the application", () => {
  const ok = {
    father_name: "F",
    mother_name: "M",
    local_guardian_name: "",
    guardian_occupation: "",
    guardian_email: "",
    present_address: "Road 1",
    permanent_address: "",
  };
  it("accepts 01XXXXXXXXX written any common way", () => {
    for (const phone of [
      "01712345678",
      "+8801712345678",
      "0171-234 5678",
      "০১৭১২৩৪৫৬৭৮",
    ])
      expect(
        guardianStep.parse({ ...ok, guardian_phone: phone }).guardian_phone,
      ).toBe("01712345678");
  });
  it("rejects other numbers", () => {
    for (const phone of ["0171234567", "02712345678", "01212345678", "abc"])
      expect(
        guardianStep.safeParse({ ...ok, guardian_phone: phone }).success,
        phone,
      ).toBe(false);
  });
});

describe("tracking numbers", () => {
  it("formats with five digits or more", () => {
    expect(formatTrackingNo(2026, 1)).toBe("ADM-2026-00001");
    expect(formatTrackingNo(2026, 123456)).toBe("ADM-2026-123456");
    expect(() => formatTrackingNo(2026, 0)).toThrow();
  });
  it("cleans what people type", () => {
    expect(normalizeTrackingNo(" adm-2026-00042 ")).toBe("ADM-2026-00042");
    expect(normalizeTrackingNo("ADM 2026 42")).toBe("ADM-2026-00042");
    expect(normalizeTrackingNo("ADM-২০২৬-০০০৪২")).toBe("ADM-2026-00042");
    expect(normalizeTrackingNo("2026-00042")).toBeNull();
    expect(normalizeTrackingNo("ADM-2026-0")).toBeNull();
  });
});

describe("student ID and rolls", () => {
  it("joins year, class and serial", () => {
    expect(studentCode(2026, 6, 12)).toBe("2026060012");
    expect(studentCode(2027, 10, 1)).toBe("2027100001");
  });
  it("gives the next roll after the highest", () => {
    expect(nextRoll([])).toBe(1);
    expect(nextRoll([1, 2, 5])).toBe(6);
  });
});

describe("the student step", () => {
  const ok = {
    student_name_en: "Rina",
    student_name_bn: "",
    gender: "female",
    birth_reg_no: "20143512345678901",
    religion: "",
    blood_group: "",
  };
  it("counts age from the birthday", () => {
    expect(ageOn("2014-03-15", "2026-03-14")).toBe(11);
    expect(ageOn("2014-03-15", "2026-03-15")).toBe(12);
  });
  it("accepts ages 8 to 20 and refuses others", () => {
    const year = new Date().getFullYear();
    expect(
      studentStep.safeParse({ ...ok, birth_date: `${year - 12}-01-01` })
        .success,
    ).toBe(true);
    expect(
      studentStep.safeParse({ ...ok, birth_date: `${year - 5}-01-01` }).success,
    ).toBe(false);
    expect(
      studentStep.safeParse({ ...ok, birth_date: `${year - 30}-01-01` })
        .success,
    ).toBe(false);
  });
  it("needs the declaration ticked", () => {
    const result = applicationSchema.safeParse({ declaration: false });
    expect(
      result.error?.issues.find((i) => i.path[0] === "declaration")?.message,
    ).toBe("errors.declaration");
  });
});

describe("review", () => {
  it("takes marks 0 to 100 with two decimals, or none", () => {
    const base = {
      status: "under_review",
      test_at: "",
      test_venue: "",
      office_note: "",
    };
    expect(reviewSchema.parse({ ...base, test_marks: "87.5" }).test_marks).toBe(
      87.5,
    );
    expect(
      reviewSchema.parse({ ...base, test_marks: "" }).test_marks,
    ).toBeNull();
    for (const bad of ["101", "-1", "87.555", "x"])
      expect(
        reviewSchema.safeParse({ ...base, test_marks: bad }).success,
        bad,
      ).toBe(false);
    expect(
      reviewSchema.safeParse({ ...base, status: "approved", test_marks: "" })
        .success,
    ).toBe(false);
  });
  it("status lookups need both fields", () => {
    expect(
      statusLookupSchema.safeParse({ tracking_no: "", phone: "01712345678" })
        .success,
    ).toBe(false);
  });
});

describe("merit list", () => {
  const row = (
    id: number,
    marks: number | null,
    at: string,
    status = "test_scheduled",
  ) => ({
    id,
    test_marks: marks,
    submitted_at: at,
    status,
  });
  it("ranks by marks; ties share a rank and keep application order", () => {
    const list = meritList([
      row(1, 70, "2026-01-03"),
      row(2, 90, "2026-01-05"),
      row(3, 90, "2026-01-01"),
      row(4, null, "2026-01-01"),
      row(5, 95, "2026-01-09", "rejected"),
      row(6, 60, "2026-01-02"),
    ]);
    expect(list.map((r) => [r.id, r.rank])).toEqual([
      [3, 1],
      [2, 1],
      [1, 3],
      [6, 4],
    ]);
  });
});

describe("document upload token", () => {
  const secret = "test-secret";
  it("proves which application and expires after an hour", () => {
    const token = createUploadToken(secret, 42, 1_000);
    expect(verifyUploadToken(secret, token, 1_000)).toBe(42);
    expect(verifyUploadToken(secret, token, 1_000 + 3601)).toBeNull();
  });
  it("refuses a changed id, another secret or junk", () => {
    const token = createUploadToken(secret, 42, 1_000);
    expect(
      verifyUploadToken(secret, token.replace(/^42/, "43"), 1_000),
    ).toBeNull();
    expect(verifyUploadToken("other", token, 1_000)).toBeNull();
    expect(verifyUploadToken(secret, "x", 1_000)).toBeNull();
    expect(verifyUploadToken(secret, undefined, 1_000)).toBeNull();
  });
});

describe("square photo crop", () => {
  it("takes the centred square", () => {
    expect(centerSquare(800, 600)).toEqual({ x: 100, y: 0, side: 600 });
    expect(centerSquare(600, 900)).toEqual({ x: 0, y: 150, side: 600 });
  });
});
