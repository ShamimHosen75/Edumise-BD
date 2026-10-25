import { describe, expect, it } from "vitest";

import { isAcademicEntity } from "@/lib/academic";
import { csvCell, csvFileName, toCsv } from "@/lib/csv";
import {
  classSchema,
  classSubjectsSchema,
  classUsesGroups,
  groupSchema,
  sectionSchema,
  sessionSchema,
  subjectSchema,
} from "@/lib/validation/academic";

const issues = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) =>
  Object.fromEntries(
    (result.error?.issues ?? []).map((i) => [String(i.path[0]), i.message]),
  );

describe("session", () => {
  it("needs a name and an end after the start", () => {
    expect(
      sessionSchema.safeParse({
        name: "2027",
        starts_on: "2027-01-01",
        ends_on: "2027-12-31",
      }).success,
    ).toBe(true);
    expect(
      issues(
        sessionSchema.safeParse({
          name: " ",
          starts_on: "2027-01-01",
          ends_on: "2027-01-01",
        }),
      ),
    ).toEqual({ name: "errors.required", ends_on: "errors.endBeforeStart" });
    expect(
      issues(
        sessionSchema.safeParse({
          name: "x",
          starts_on: "2027-02-30",
          ends_on: "2027-12-31",
        }),
      ),
    ).toEqual({ starts_on: "errors.date" });
  });
});

describe("class", () => {
  it("takes levels 6 to 10 typed in a form", () => {
    expect(
      classSchema.parse({ level: "9", name_en: "Class 9", name_bn: "" }).level,
    ).toBe(9);
    for (const level of ["5", "11", "9.5", "", "nine"])
      expect(
        issues(classSchema.safeParse({ level, name_en: "x", name_bn: "" })),
      ).toEqual({
        level: "errors.classLevel",
      });
  });
  it("uses groups from Class 9", () => {
    expect(classUsesGroups(8)).toBe(false);
    expect(classUsesGroups(9)).toBe(true);
  });
});

describe("group and subject codes", () => {
  it("checks group codes", () => {
    expect(
      groupSchema.safeParse({
        code: "science",
        name_en: "Science",
        name_bn: "",
      }).success,
    ).toBe(true);
    expect(
      issues(
        groupSchema.safeParse({ code: "Science 1", name_en: "x", name_bn: "" }),
      ),
    ).toEqual({
      code: "errors.groupCode",
    });
  });
  it("upper-cases subject codes and checks them", () => {
    const ok = {
      code: "math",
      name_en: "Maths",
      name_bn: "",
      type: "compulsory",
      sort_order: "3",
    };
    expect(subjectSchema.parse(ok)).toMatchObject({
      code: "MATH",
      sort_order: 3,
    });
    expect(issues(subjectSchema.safeParse({ ...ok, code: "M" }))).toEqual({
      code: "errors.subjectCode",
    });
    expect(subjectSchema.safeParse({ ...ok, type: "extra" }).success).toBe(
      false,
    );
  });
});

describe("section", () => {
  const ok = {
    class_id: 3,
    name_en: "C",
    name_bn: "গ",
    capacity: "",
    class_teacher_id: null,
  };
  it("treats an empty capacity as no limit", () => {
    expect(sectionSchema.parse(ok).capacity).toBeNull();
    expect(sectionSchema.parse({ ...ok, capacity: "45" }).capacity).toBe(45);
  });
  it("rejects a bad capacity and a missing class", () => {
    expect(issues(sectionSchema.safeParse({ ...ok, capacity: "0" }))).toEqual({
      capacity: "errors.capacity",
    });
    expect(issues(sectionSchema.safeParse({ ...ok, capacity: "500" }))).toEqual(
      { capacity: "errors.capacity" },
    );
    expect(issues(sectionSchema.safeParse({ ...ok, class_id: null }))).toEqual({
      class_id: "errors.required",
    });
  });
});

describe("class subjects", () => {
  it("rejects repeated subjects", () => {
    expect(
      classSubjectsSchema.safeParse({
        class_id: 1,
        group_id: null,
        subject_ids: [1, 2],
      }).success,
    ).toBe(true);
    expect(
      classSubjectsSchema.safeParse({
        class_id: 1,
        group_id: null,
        subject_ids: [1, 1],
      }).success,
    ).toBe(false);
    expect(
      classSubjectsSchema.safeParse({
        class_id: 1,
        group_id: 0,
        subject_ids: [],
      }).success,
    ).toBe(false);
  });
  it("knows its entities", () => {
    expect(isAcademicEntity("sections")).toBe(true);
    expect(isAcademicEntity("toString")).toBe(false);
  });
});

describe("CSV", () => {
  it("quotes cells that need it", () => {
    expect(csvCell('Say "hi", then go')).toBe('"Say ""hi"", then go"');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(42)).toBe("42");
  });
  it("defuses spreadsheet formulas but not negative numbers", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell(-5)).toBe("-5");
  });
  it("starts with a BOM so Excel reads Bangla", () => {
    const csv = toCsv(["Name", "নাম"], [["Class 6", "ষষ্ঠ শ্রেণি"]]);
    expect(csv).toBe("﻿Name,নাম\r\nClass 6,ষষ্ঠ শ্রেণি\r\n");
  });
  it("makes safe file names", () => {
    expect(csvFileName("Class subjects")).toBe("class-subjects.csv");
    expect(csvFileName("শাখা")).toBe("export.csv");
  });
});
