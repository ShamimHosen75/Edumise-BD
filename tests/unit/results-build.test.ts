import { describe, expect, it } from "vitest";

import { DEFAULT_SCALE, parseScale } from "@/lib/grading";
import {
  buildResults,
  resultSummary,
  type NamedPaper,
  type Sitting,
} from "@/lib/results-build";
import { linePoints, passRate } from "@/lib/site/chart";
import {
  boardResultSchema,
  resultRowsSchema,
  resultSearchSchema,
} from "@/lib/validation/results";

const scale = parseScale(DEFAULT_SCALE);
const paper = (
  o: Partial<NamedPaper> & { examSubjectId: number },
): NamedPaper => ({
  classId: 6,
  subjectId: o.examSubjectId,
  cq_full: 70,
  mcq_full: 30,
  practical_full: 0,
  cq_pass: 23,
  mcq_pass: 10,
  practical_pass: null,
  subjectType: "compulsory",
  paperGroup: null,
  countsInGpa: true,
  groupIds: [null],
  sortOrder: o.examSubjectId,
  name_en: `Subject ${o.examSubjectId}`,
  name_bn: "",
  ...o,
});
const sit = (o: Partial<Sitting> & { studentId: number }): Sitting => ({
  classId: 6,
  sectionId: 1,
  sectionOrder: 1,
  roll: o.studentId,
  groupId: null,
  fourthSubjectId: null,
  ...o,
});
const m = (cq: number, mcq: number) => ({
  cq,
  mcq,
  practical: null,
  is_absent: false,
});

const papers = [
  paper({
    examSubjectId: 1,
    name_en: "Bangla 1st",
    name_bn: "বাংলা ১ম",
    paperGroup: "BAN",
  }),
  paper({
    examSubjectId: 2,
    name_en: "Bangla 2nd",
    name_bn: "বাংলা ২য়",
    paperGroup: "BAN",
  }),
  paper({ examSubjectId: 3, name_en: "Maths" }),
  paper({ examSubjectId: 9, classId: 9, name_en: "Physics" }),
];
const marks = new Map([
  [
    1,
    new Map([
      [1, m(60, 25)],
      [2, m(60, 25)],
      [3, m(60, 25)],
    ]),
  ], // all A+
  [
    2,
    new Map([
      [1, m(50, 20)],
      [2, m(50, 20)],
      [3, m(20, 5)],
    ]),
  ], // fails maths
  [
    3,
    new Map([
      [1, m(60, 25)],
      [2, m(60, 25)],
      [3, m(60, 25)],
    ]),
  ], // 3B: same as 1
  [4, new Map([[1, m(50, 20)]])], // missing two papers
]);
const students = [
  sit({ studentId: 1 }),
  sit({ studentId: 2 }),
  sit({ studentId: 3, sectionId: 2, sectionOrder: 2, roll: 1 }),
];

describe("buildResults", () => {
  const { rows, missing } = buildResults({
    scale,
    papers,
    students,
    marks,
    attendance: new Map([[1, 95.5]]),
  });
  const row = (id: number) => rows.find((r) => r.student_id === id)!;

  it("grades each student and keeps a printable snapshot", () => {
    expect(row(1)).toMatchObject({
      gpa: 5,
      grade: "A+",
      passed: true,
      total: 255,
      full_total: 300,
      attendance_percent: 95.5,
    });
    const bangla = row(1).subjects[0]!;
    expect(bangla).toMatchObject({
      key: "g:BAN",
      name_en: "Bangla 1st + Bangla 2nd",
      name_bn: "বাংলা ১ম + বাংলা ২য়",
      obtained: 170,
      full: 200,
      grade: "A+",
    });
    expect(bangla.papers.map((p) => [p.name_en, p.cq, p.mcq])).toEqual([
      ["Bangla 1st", 60, 25],
      ["Bangla 2nd", 60, 25],
    ]);
    expect(row(2)).toMatchObject({
      passed: false,
      gpa: 0,
      grade: "F",
      failed_count: 1,
    });
    expect(row(2).attendance_percent).toBeNull();
  });
  it("ranks within the section and within the class", () => {
    expect([row(1).section_position, row(2).section_position]).toEqual([1, 2]);
    expect(row(3).section_position).toBe(1);
    // 1 and 3 tie on GPA and total and both have roll 1 in their section: A before B.
    expect([
      row(1).class_position,
      row(3).class_position,
      row(2).class_position,
    ]).toEqual([1, 2, 3]);
  });
  it("lists marks not entered yet", () => {
    expect(missing).toEqual([]);
    const withFour = buildResults({
      scale,
      papers,
      students: [...students, sit({ studentId: 4 })],
      marks,
      attendance: new Map(),
    });
    expect(withFour.missing).toEqual([
      { studentId: 4, examSubjectId: 2 },
      { studentId: 4, examSubjectId: 3 },
    ]);
  });
  it("skips students whose class has no subjects in the exam", () => {
    const none = buildResults({
      scale,
      papers,
      students: [sit({ studentId: 7, classId: 8 })],
      marks,
      attendance: new Map(),
    });
    expect(none).toEqual({ rows: [], missing: [] });
  });
  it("produces rows the database function accepts", () => {
    expect(resultRowsSchema.safeParse(rows).success).toBe(true);
  });
  it("summarises pass rate and GPA 5.00", () => {
    expect(resultSummary(rows)).toEqual({
      students: 3,
      passed: 2,
      failed: 1,
      passRate: 66.7,
      gpa5: 2,
    });
    expect(resultSummary([]).passRate).toBeNull();
  });
});

describe("result forms", () => {
  it("reads the public search, Bangla digits included", () => {
    expect(
      resultSearchSchema.parse({
        exam: "3",
        section: "1",
        roll: " ১২ ",
        group: "",
      }),
    ).toEqual({
      exam: 3,
      section: 1,
      roll: 12,
      group: null,
    });
    const bad = resultSearchSchema.safeParse({
      exam: "",
      section: "x",
      roll: "0",
      group: "",
    });
    expect(bad.success).toBe(false);
    expect(bad.error!.issues.map((i) => i.message).sort()).toEqual([
      "result.errors.exam",
      "result.errors.roll",
      "result.errors.section",
    ]);
  });
  it("checks board results add up", () => {
    const ok = {
      exam: "ssc",
      year: "2024",
      examinees: "120",
      passed: "110",
      gpa5: "30",
    };
    expect(boardResultSchema.parse(ok)).toEqual({
      exam: "ssc",
      year: 2024,
      examinees: 120,
      passed: 110,
      gpa5: 30,
    });
    const msg = (o: object) =>
      boardResultSchema
        .safeParse({ ...ok, ...o })
        .error?.issues.map((i) => i.message);
    expect(msg({ passed: "121" })).toEqual(["boardResults.errors.passed"]);
    expect(msg({ gpa5: "111" })).toEqual(["boardResults.errors.gpa5"]);
    expect(msg({ examinees: "0", passed: "0", gpa5: "0" })).toEqual([
      "errors.count",
    ]);
    expect(msg({ year: "1900" })).toEqual(["errors.year"]);
  });
});

describe("board results chart", () => {
  const box = {
    width: 200,
    height: 120,
    left: 20,
    right: 20,
    top: 10,
    bottom: 10,
  };
  it("places percentages on the plot area", () => {
    expect(linePoints([0, 50, 100], box)).toEqual([
      { x: 20, y: 110 },
      { x: 100, y: 60 },
      { x: 180, y: 10 },
    ]);
  });
  it("centres one point and clamps bad values", () => {
    expect(linePoints([120], box)).toEqual([{ x: 100, y: 10 }]);
    expect(linePoints([Number.NaN, -5], box).map((p) => p.y)).toEqual([
      110, 110,
    ]);
    expect(linePoints([], box)).toEqual([]);
  });
  it("computes the pass rate", () => {
    expect(passRate(98, 112)).toBe(87.5);
    expect(passRate(0, 0)).toBe(0);
  });
});
