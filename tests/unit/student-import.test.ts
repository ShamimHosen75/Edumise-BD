import { describe, expect, it } from "vitest";

import { csvRecords, parseCsv } from "@/lib/csv-parse";
import {
  assignRolls,
  checkImportRows,
  IMPORT_COLUMNS,
  IMPORT_EXAMPLE,
  normalizeHeader,
  parseDate,
} from "@/lib/student-import";

const sections = [
  { id: 1, level: 6, name: "A" },
  { id: 2, level: 6, name: "B" },
  { id: 3, level: 9, name: "A" },
];
const ctx = (over: Partial<Parameters<typeof checkImportRows>[1]> = {}) => ({
  sections,
  usedRolls: new Set<string>(),
  usedBirthRegs: new Set<string>(),
  ...over,
});
const good = (over: Record<string, unknown> = {}) => ({
  name_en: "Test Student",
  name_bn: "",
  gender: "male",
  birth_date: "15/03/2014",
  birth_reg_no: "",
  religion: "islam",
  blood_group: "b+",
  class: "6",
  section: "a",
  roll: "",
  guardian_name: "Test Guardian",
  guardian_phone: "01712345678",
  relation: "father",
  ...over,
});

describe("normalizeHeader", () => {
  it("lower-cases, drops notes in brackets and joins words", () => {
    expect(normalizeHeader(" Name EN ")).toBe("name_en");
    expect(normalizeHeader("Guardian phone (01XXXXXXXXX)")).toBe(
      "guardian_phone",
    );
    expect(normalizeHeader("birth-date")).toBe("birth_date");
  });
});

describe("parseDate", () => {
  it("reads ISO and day/month/year dates", () => {
    expect(parseDate("2014-03-15")).toBe("2014-03-15");
    expect(parseDate("15/03/2014")).toBe("2014-03-15");
    expect(parseDate("5.3.2014")).toBe("2014-03-05");
    // Excel's day number for 15 March 2014.
    expect(parseDate("41713")).toBe("2014-03-15");
  });
  it("is empty for an empty cell", () => {
    expect(parseDate("")).toBe("");
  });
  it("rejects impossible, future and unknown formats", () => {
    expect(parseDate("31/02/2014")).toBeNull();
    expect(parseDate("01/01/2999")).toBeNull();
    expect(parseDate("March 2014")).toBeNull();
  });
});

describe("checkImportRows", () => {
  it("accepts a valid row and normalises values", () => {
    const [r] = checkImportRows([good()], ctx());
    expect(r!.issues).toEqual([]);
    expect(r!.line).toBe(2);
    expect(r!.row).toMatchObject({
      gender: "male",
      birth_date: "2014-03-15",
      blood_group: "B+",
      section_id: 1,
      roll: 1,
      relation: "father",
      guardian_phone: "01712345678",
    });
  });

  it("accepts Bangla words and digits", () => {
    const [r] = checkImportRows(
      [
        good({
          gender: "মেয়ে",
          relation: "মা",
          guardian_phone: "০১৭১২৩৪৫৬৭৮",
          roll: "৭",
        }),
      ],
      ctx(),
    );
    expect(r!.issues).toEqual([]);
    expect(r!.row).toMatchObject({
      gender: "female",
      relation: "mother",
      roll: 7,
    });
  });

  it("puts back the leading 0 a spreadsheet drops from a mobile number", () => {
    const [r] = checkImportRows([good({ guardian_phone: 1712345678 })], ctx());
    expect(r!.row?.guardian_phone).toBe("01712345678");
  });

  it("lists every problem of a row with its column", () => {
    const [r] = checkImportRows(
      [
        {
          name_en: "",
          gender: "x",
          birth_date: "2014/99/99",
          birth_reg_no: "123",
          religion: "none",
          blood_group: "C",
          class: "11",
          section: "A",
          roll: "0",
          guardian_name: "",
          guardian_phone: "123",
          relation: "uncle",
        },
      ],
      ctx(),
    );
    expect(r!.row).toBeNull();
    expect(r!.issues.map((i) => i.field)).toEqual([
      "name_en",
      "gender",
      "birth_date",
      "birth_reg_no",
      "religion",
      "blood_group",
      "section",
      "roll",
      "guardian_name",
      "guardian_phone",
      "relation",
    ]);
  });

  it("finds rolls and birth registration numbers used twice", () => {
    const reg = "20132691000000099";
    const rows = checkImportRows(
      [
        good({ roll: "3", birth_reg_no: reg }),
        good({ roll: "3", birth_reg_no: reg }),
        good({ roll: "5" }),
        good({ birth_reg_no: "20132691000000001" }),
      ],
      ctx({
        usedRolls: new Set(["1:5"]),
        usedBirthRegs: new Set(["20132691000000001"]),
      }),
    );
    expect(rows[0]!.issues).toEqual([]);
    expect(rows[1]!.issues.map((i) => i.message)).toEqual([
      "errors.birthRegTaken",
      "errors.rollTaken",
    ]);
    expect(rows[2]!.issues[0]?.message).toBe("errors.rollTaken");
    expect(rows[3]!.issues[0]?.message).toBe("errors.birthRegTaken");
  });

  it("matches class and section by level and name", () => {
    const rows = checkImportRows(
      [
        good({ class: "Class 9", section: "A" }),
        good({ class: "7", section: "A" }),
      ],
      ctx(),
    );
    expect(rows[0]!.row?.section_id).toBe(3);
    expect(rows[1]!.issues[0]).toEqual({
      field: "section",
      message: "errors.section",
    });
  });

  it("the template example row is valid", () => {
    const [r] = checkImportRows([IMPORT_EXAMPLE], ctx());
    expect(r!.issues).toEqual([]);
    expect(Object.keys(IMPORT_EXAMPLE)).toEqual([...IMPORT_COLUMNS]);
  });
});

describe("assignRolls", () => {
  it("keeps written rolls and numbers the rest after the highest", () => {
    expect(
      assignRolls(
        [
          { sectionId: 1, roll: null },
          { sectionId: 1, roll: 10 },
          { sectionId: 2, roll: null },
          { sectionId: 1, roll: null },
        ],
        new Set(["1:4", "2:2", "3:9"]),
      ),
    ).toEqual([11, 10, 3, 12]);
  });
  it("starts at 1 in an empty section", () => {
    expect(
      assignRolls(
        [
          { sectionId: 5, roll: null },
          { sectionId: 5, roll: null },
        ],
        new Set(),
      ),
    ).toEqual([1, 2]);
  });
  it("import rows get their final rolls", () => {
    const rows = checkImportRows(
      [good(), good({ roll: "8" }), good()],
      ctx({ usedRolls: new Set(["1:2"]) }),
    );
    expect(rows.map((r) => r.row?.roll)).toEqual([9, 8, 10]);
  });
});

describe("CSV reading", () => {
  it("handles quotes, commas, new lines and a byte-order mark", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\n"two\nlines",z')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
      ["two\nlines", "z"],
    ]);
  });
  it("turns rows into records by header and skips blank lines", () => {
    expect(csvRecords("name_en,roll\nA,1\n\n , \nB,\n")).toEqual([
      { name_en: "A", roll: "1" },
      { name_en: "B", roll: "" },
    ]);
  });
});
