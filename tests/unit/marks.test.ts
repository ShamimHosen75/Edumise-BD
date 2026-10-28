import { describe, expect, it } from "vitest";

import {
  checkMarkRow,
  isEntered,
  markTotal,
  partsInUse,
  readMark,
  readMarkRows,
  type MarkRow,
} from "@/lib/marks";
import { examSchema, examSubjectSchema } from "@/lib/validation/marks";

const ES = { cq_full: 70, mcq_full: 30, practical_full: 0 };
const row = (o: Partial<MarkRow> = {}): MarkRow => ({
  student_id: 1,
  cq: null,
  mcq: null,
  practical: null,
  is_absent: false,
  ...o,
});

describe("marks entry rules", () => {
  it("knows which parts are used", () => {
    expect(partsInUse(ES)).toEqual(["cq", "mcq"]);
    expect(
      partsInUse({ cq_full: 25, mcq_full: 15, practical_full: 10 }),
    ).toEqual(["cq", "mcq", "practical"]);
  });
  it("reads marks typed in English or Bangla digits", () => {
    expect(readMark(" 65.5 ")).toBe(65.5);
    expect(readMark("৬৫")).toBe(65);
    expect(readMark("")).toBeNull();
    expect(readMark("6.555")).toBeNaN();
    expect(readMark("-1")).toBeNaN();
    expect(readMark("abc")).toBeNaN();
  });
  it("checks 0 to full marks per part", () => {
    expect(checkMarkRow(row({ cq: 70, mcq: 0 }), ES)).toEqual({});
    expect(checkMarkRow(row({ cq: 71 }), ES)).toEqual({ cq: "range" });
    expect(checkMarkRow(row({ mcq: Number.NaN }), ES)).toEqual({
      mcq: "range",
    });
    expect(checkMarkRow(row({ practical: 5 }), ES)).toEqual({
      practical: "unused",
    });
  });
  it("absent means no marks", () => {
    expect(checkMarkRow(row({ is_absent: true, cq: 10 }), ES)).toEqual({
      row: "absentWithMarks",
    });
    expect(isEntered(row({ is_absent: true }))).toBe(true);
    expect(isEntered(row())).toBe(false);
    expect(markTotal(row({ is_absent: true }))).toBeNull();
    expect(markTotal(row({ cq: 50.5, mcq: 20 }))).toBe(70.5);
  });
});

describe("marks import rows", () => {
  const roster = [
    { studentId: 11, roll: 1 },
    { studentId: 12, roll: 2 },
    { studentId: 13, roll: 3 },
  ];
  it("matches rolls and reads parts and absence", () => {
    const rows = readMarkRows(
      [
        { Roll: "1", Name: "A", CQ: "60", MCQ: "25" },
        { roll: "২", cq: "", mcq: "", absent: "yes" },
      ],
      roster,
      ES,
    );
    expect(rows.map((r) => r.row)).toEqual([
      { student_id: 11, cq: 60, mcq: 25, practical: null, is_absent: false },
      { student_id: 12, cq: null, mcq: null, practical: null, is_absent: true },
    ]);
    expect(rows[1]!.line).toBe(3);
  });
  it("lists problems per line", () => {
    const rows = readMarkRows(
      [
        { roll: "9", cq: "10" },
        { roll: "1", cq: "80" },
        { roll: "1", cq: "10" },
        { roll: "3", practical: "5" },
        { roll: "2", cq: "5", absent: "1" },
      ],
      roster,
      ES,
    );
    expect(rows.map((r) => r.problems)).toEqual([
      ["marks.import.unknownRoll"],
      ["marks.import.range"],
      ["marks.import.twice"],
      ["marks.import.unused"],
      ["marks.import.absentWithMarks"],
    ]);
    expect(rows.every((r) => r.row === null)).toBe(true);
  });
});

describe("exam schemas", () => {
  it("an exam needs a name and at least one class; end after start", () => {
    const ok = {
      name_en: "Test",
      name_bn: "",
      starts_on: "",
      ends_on: "",
      class_ids: [1],
    };
    expect(examSchema.safeParse(ok).success).toBe(true);
    expect(examSchema.safeParse({ ...ok, class_ids: [] }).success).toBe(false);
    expect(
      examSchema.safeParse({
        ...ok,
        starts_on: "2026-12-05",
        ends_on: "2026-12-01",
      }).error?.issues[0]?.message,
    ).toBe("errors.endBeforeStart");
  });
  it("full marks above 0 and pass marks within full marks", () => {
    const base = {
      exam_id: 1,
      class_id: 1,
      subject_id: 1,
      cq_full: "70",
      cq_pass: "23",
      mcq_full: "30",
      mcq_pass: "",
      practical_full: "0",
      practical_pass: null,
      counts_in_gpa: true,
    };
    expect(examSubjectSchema.parse(base)).toMatchObject({
      cq_full: 70,
      cq_pass: 23,
      mcq_pass: null,
    });
    expect(
      examSubjectSchema.safeParse({ ...base, cq_full: "0", mcq_full: "0" })
        .success,
    ).toBe(false);
    expect(
      examSubjectSchema.safeParse({ ...base, cq_pass: "80" }).error?.issues[0]
        ?.path[0],
    ).toBe("cq_pass");
  });
});
