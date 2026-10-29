import { describe, expect, it } from "vitest";

import {
  DEFAULT_SCALE,
  gradeFor,
  gradeForGpa,
  gradeSubject,
  parseScale,
  rankResults,
  round2,
  studentResult,
  studentSubjects,
  type ExamPaper,
  type PaperInput,
  type SubjectGrade,
  type SubjectInput,
  type SubjectRole,
} from "@/lib/grading";

const S = parseScale(DEFAULT_SCALE);

const paper = (
  mark: Partial<NonNullable<PaperInput["mark"]>> | null,
  o: Partial<PaperInput> = {},
): PaperInput => ({
  examSubjectId: 1,
  cq_full: 70,
  mcq_full: 30,
  practical_full: 0,
  cq_pass: 23,
  mcq_pass: 10,
  practical_pass: null,
  mark:
    mark === null
      ? null
      : { cq: null, mcq: null, practical: null, is_absent: false, ...mark },
  ...o,
});
const subject = (
  papers: PaperInput[],
  role: SubjectRole = "compulsory",
  key = "s:1",
): SubjectInput => ({ key, role, papers });
/** A graded subject from total marks out of 100 (70 CQ / 30 MCQ, both parts passed). */
const scored = (
  marks: number,
  role: SubjectRole = "compulsory",
  key = `k${marks}`,
): SubjectGrade => {
  const mcq = Math.min(30, Math.max(10, marks - 23));
  return gradeSubject(subject([paper({ cq: marks - mcq, mcq })], role, key), S);
};

describe("grading scale", () => {
  it("reads the settings scale, best band first", () => {
    const reversed = [...DEFAULT_SCALE].reverse();
    expect(parseScale(reversed).map((b) => b.grade)).toEqual([
      "A+",
      "A",
      "A-",
      "B",
      "C",
      "D",
      "F",
    ]);
  });
  it("refuses broken scales", () => {
    expect(() => parseScale(null)).toThrow();
    expect(() => parseScale([{ min: 0, grade: "F", point: 0 }])).toThrow();
    // No band starting at 0.
    expect(() =>
      parseScale([
        { min: 50, grade: "A", point: 5 },
        { min: 33, grade: "F", point: 0 },
      ]),
    ).toThrow();
    // Same lower limit twice.
    expect(() =>
      parseScale([
        { min: 0, grade: "A", point: 5 },
        { min: 0, grade: "F", point: 0 },
      ]),
    ).toThrow();
    // Points must fall as marks fall.
    expect(() =>
      parseScale([
        { min: 50, grade: "A", point: 1 },
        { min: 0, grade: "F", point: 2 },
      ]),
    ).toThrow();
  });
  it("maps every band boundary", () => {
    const cases: [number, string, number][] = [
      [100, "A+", 5],
      [80, "A+", 5],
      [79.99, "A", 4],
      [70, "A", 4],
      [69, "A-", 3.5],
      [60, "A-", 3.5],
      [59, "B", 3],
      [50, "B", 3],
      [49, "C", 2],
      [40, "C", 2],
      [39, "D", 1],
      [33, "D", 1],
      [32.99, "F", 0],
      [0, "F", 0],
    ];
    for (const [pct, grade, point] of cases)
      expect(gradeFor(pct, S), `${pct}%`).toMatchObject({ grade, point });
  });
  it("compares the exact percentage: 79.5 is an A (Q30)", () => {
    expect(gradeFor(79.5, S).grade).toBe("A");
  });
  it("refuses impossible percentages", () => {
    expect(() => gradeFor(-1, S)).toThrow();
    expect(() => gradeFor(100.01, S)).toThrow();
    expect(() => gradeFor(Number.NaN, S)).toThrow();
  });
  it("gives the overall grade for a GPA", () => {
    expect(gradeForGpa(5, S).grade).toBe("A+");
    expect(gradeForGpa(4.99, S).grade).toBe("A");
    expect(gradeForGpa(3.5, S).grade).toBe("A-");
    expect(gradeForGpa(1, S).grade).toBe("D");
    expect(gradeForGpa(0.5, S).grade).toBe("F");
  });
  it("rounds to 2 decimals", () => {
    expect(round2(4.125)).toBe(4.13);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(23 / 6)).toBe(3.83);
  });
});

describe("one subject", () => {
  it("grades by percent when every part is passed", () => {
    const g = gradeSubject(subject([paper({ cq: 60, mcq: 25 })]), S);
    expect(g).toMatchObject({
      obtained: 85,
      full: 100,
      percent: 85,
      grade: "A+",
      point: 5,
      failed: false,
      absent: false,
      missing: false,
      failedParts: [],
    });
  });
  it("CQ passed but MCQ failed is F, whatever the total", () => {
    const g = gradeSubject(subject([paper({ cq: 70, mcq: 9 })]), S);
    expect(g.percent).toBe(79);
    expect(g).toMatchObject({ grade: "F", point: 0, failedParts: ["mcq"] });
  });
  it("a part without pass marks is not checked on its own", () => {
    const g = gradeSubject(
      subject([paper({ cq: 60, mcq: 0 }, { mcq_pass: null })]),
      S,
    );
    expect(g).toMatchObject({ grade: "A-", failedParts: [] });
  });
  it("checks practical pass marks", () => {
    const ict = {
      cq_full: 25,
      cq_pass: 8,
      mcq_full: 15,
      mcq_pass: 5,
      practical_full: 10,
      practical_pass: 3,
    };
    expect(
      gradeSubject(subject([paper({ cq: 25, mcq: 15, practical: 2 }, ict)]), S),
    ).toMatchObject({ grade: "F", failedParts: ["practical"] });
    expect(
      gradeSubject(subject([paper({ cq: 20, mcq: 12, practical: 8 }, ict)]), S),
    ).toMatchObject({ obtained: 40, percent: 80, grade: "A+" });
  });
  it("32 out of 100 is F; 33 is D", () => {
    expect(scored(32).grade).toBe("F");
    expect(scored(33).grade).toBe("D");
  });
  it("absent is F with no marks", () => {
    const g = gradeSubject(subject([paper({ is_absent: true })]), S);
    expect(g).toMatchObject({
      grade: "F",
      point: 0,
      obtained: 0,
      absent: true,
      failed: true,
      missing: false,
    });
  });
  it("no marks entered is flagged as missing (and graded as absent)", () => {
    for (const mark of [null, {}])
      expect(gradeSubject(subject([paper(mark)]), S)).toMatchObject({
        missing: true,
        absent: true,
        grade: "F",
      });
  });
  it("adds up two papers of one subject before grading (Q32)", () => {
    // 1st paper 55%, 2nd paper 90%: 72.5% together is an A.
    const g = gradeSubject(
      subject([
        paper({ cq: 40, mcq: 15 }),
        paper({ cq: 65, mcq: 25 }, { examSubjectId: 2 }),
      ]),
      S,
    );
    expect(g).toMatchObject({
      obtained: 145,
      full: 200,
      percent: 72.5,
      grade: "A",
    });
  });
  it("two papers: the part pass marks are added up too", () => {
    // MCQ 9 + 12 = 21 >= 20: passed, though the first paper alone is below 10.
    expect(
      gradeSubject(
        subject([
          paper({ cq: 40, mcq: 9 }),
          paper({ cq: 40, mcq: 12 }, { examSubjectId: 2 }),
        ]),
        S,
      ).failedParts,
    ).toEqual([]);
    // CQ 20 + 25 = 45 < 46: failed.
    expect(
      gradeSubject(
        subject([
          paper({ cq: 20, mcq: 30 }),
          paper({ cq: 25, mcq: 30 }, { examSubjectId: 2 }),
        ]),
        S,
      ),
    ).toMatchObject({ grade: "F", failedParts: ["cq"] });
  });
  it("absent in one of two papers fails the subject", () => {
    expect(
      gradeSubject(
        subject([
          paper({ cq: 70, mcq: 30 }),
          paper({ is_absent: true }, { examSubjectId: 2 }),
        ]),
        S,
      ),
    ).toMatchObject({ grade: "F", absent: true, obtained: 0 });
  });
  it("keeps decimal marks", () => {
    expect(
      gradeSubject(subject([paper({ cq: 55.5, mcq: 24.25 })]), S),
    ).toMatchObject({ obtained: 79.75, percent: 79.75, grade: "A" });
  });
  it("needs a paper", () => {
    expect(() => gradeSubject(subject([]), S)).toThrow();
  });
});

describe("student result", () => {
  it("all A+ is GPA 5.00", () => {
    const r = studentResult([scored(90), scored(85), scored(80)], S);
    expect(r).toMatchObject({
      passed: true,
      gpa: 5,
      gpaWithoutFourth: 5,
      grade: "A+",
      total: 255,
      fullTotal: 300,
      failedCount: 0,
    });
  });
  it("one compulsory subject at 32 fails: GPA 0.00", () => {
    const r = studentResult([scored(90), scored(32), scored(85)], S);
    expect(r).toMatchObject({
      passed: false,
      gpa: 0,
      gpaWithoutFourth: 0,
      grade: "F",
      failedCount: 1,
    });
  });
  it("absent in a compulsory subject fails", () => {
    const absent = gradeSubject(subject([paper({ is_absent: true })]), S);
    expect(studentResult([scored(90), absent], S).passed).toBe(false);
  });
  it("fourth subject A+ adds 3.00", () => {
    // Compulsory: A (4) + B (3) = 7; fourth A+ adds 3 -> 10 / 2 = 5.00.
    const r = studentResult([scored(75), scored(55), scored(90, "fourth")], S);
    expect(r).toMatchObject({ gpa: 5, gpaWithoutFourth: 3.5, grade: "A+" });
  });
  it("caps GPA at 5.00", () => {
    const r = studentResult([scored(90), scored(85), scored(95, "fourth")], S);
    expect(r.gpa).toBe(5);
    expect(r.gpaWithoutFourth).toBe(5);
  });
  it("fourth subject at or below 2.00 adds nothing and its F does not fail", () => {
    for (const marks of [45, 20]) {
      const r = studentResult(
        [scored(75), scored(65, "compulsory", "b"), scored(marks, "fourth")],
        S,
      );
      expect(r).toMatchObject({
        passed: true,
        gpa: 3.75,
        gpaWithoutFourth: 3.75,
      });
    }
  });
  it("rounds GPA to 2 decimals", () => {
    // 5 + 4 + 3.5 + 3 + 2 + 1 = 18.5 / 6 = 3.0833...
    const r = studentResult(
      [scored(85), scored(75), scored(65), scored(55), scored(45), scored(35)],
      S,
    );
    expect(r).toMatchObject({ gpa: 3.08, grade: "B" });
  });
  it("extra subjects are shown but do not count", () => {
    const r = studentResult([scored(85), scored(20, "extra")], S);
    expect(r).toMatchObject({
      passed: true,
      gpa: 5,
      total: 85,
      fullTotal: 100,
    });
  });
  it("total includes the fourth subject", () => {
    expect(studentResult([scored(85), scored(60, "fourth")], S).total).toBe(
      145,
    );
  });
  it("needs a compulsory subject and at most one fourth", () => {
    expect(studentResult([scored(90, "fourth")], S).passed).toBe(false);
    expect(() =>
      studentResult(
        [scored(90), scored(80, "fourth"), scored(70, "fourth")],
        S,
      ),
    ).toThrow();
  });
});

describe("merit positions (Q33)", () => {
  it("ranks by GPA, then total, then roll; failed students last", () => {
    const pos = rankResults([
      { id: 1, passed: true, gpa: 4.5, total: 500, roll: 1 },
      { id: 2, passed: true, gpa: 5, total: 480, roll: 2 },
      { id: 3, passed: true, gpa: 4.5, total: 520, roll: 3 },
      { id: 4, passed: false, gpa: 0, total: 600, roll: 4 },
      { id: 5, passed: true, gpa: 4.5, total: 500, roll: 5 },
      { id: 6, passed: false, gpa: 0, total: 300, roll: 6 },
    ]);
    expect(
      [...pos.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id),
    ).toEqual([2, 3, 1, 5, 4, 6]);
  });
  it("equal rolls in different sections go by section order", () => {
    const pos = rankResults([
      { id: 10, passed: true, gpa: 5, total: 500, roll: 1, sectionOrder: 2 },
      { id: 11, passed: true, gpa: 5, total: 500, roll: 1, sectionOrder: 1 },
    ]);
    expect(pos.get(11)).toBe(1);
    expect(pos.get(10)).toBe(2);
  });
  it("is unique and stable for identical rows", () => {
    const pos = rankResults([
      { id: 8, passed: true, gpa: 5, total: 500, roll: 1 },
      { id: 7, passed: true, gpa: 5, total: 500, roll: 1 },
    ]);
    expect(pos.get(7)).toBe(1);
    expect(pos.get(8)).toBe(2);
    expect(rankResults([]).size).toBe(0);
  });
});

describe("the subjects a student sits", () => {
  const ep = (o: Partial<ExamPaper> & { subjectId: number }): ExamPaper => ({
    examSubjectId: o.subjectId * 10,
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
    sortOrder: o.subjectId,
    ...o,
  });
  const SCIENCE = 1;
  const BUSINESS = 2;
  const papers = [
    ep({ subjectId: 1 }), // Bangla 1st paper
    ep({ subjectId: 2, paperGroup: "BAN" }),
    ep({ subjectId: 3, paperGroup: "BAN" }),
    ep({ subjectId: 4, groupIds: [SCIENCE] }), // Biology
    ep({ subjectId: 5, groupIds: [SCIENCE], subjectType: "fourth" }), // Higher maths
    ep({ subjectId: 6, groupIds: [BUSINESS] }),
    ep({ subjectId: 7, countsInGpa: false, subjectType: "optional" }),
  ];
  const roles = (list: SubjectInput[]) =>
    Object.fromEntries(list.map((s) => [s.key, s.role]));

  it("takes common and own-group subjects, joins paper groups", () => {
    const list = studentSubjects(
      papers,
      { groupId: SCIENCE, fourthSubjectId: null },
      new Map(),
    );
    expect(roles(list)).toEqual({
      "s:1": "compulsory",
      "g:BAN": "compulsory",
      "s:4": "compulsory",
      "s:5": "fourth",
      "s:7": "extra",
    });
    expect(
      list.find((s) => s.key === "g:BAN")!.papers.map((p) => p.examSubjectId),
    ).toEqual([20, 30]);
  });
  it("uses the fourth subject chosen on the enrolment", () => {
    const list = studentSubjects(
      papers,
      { groupId: SCIENCE, fourthSubjectId: 4 },
      new Map(),
    );
    expect(roles(list)).toMatchObject({ "s:4": "fourth", "s:5": "compulsory" });
  });
  it("leaves out other groups' subjects; no group means common subjects only", () => {
    expect(
      Object.keys(
        roles(
          studentSubjects(
            papers,
            { groupId: BUSINESS, fourthSubjectId: null },
            new Map(),
          ),
        ),
      ),
    ).toEqual(["s:1", "g:BAN", "s:6", "s:7"]);
    expect(
      Object.keys(
        roles(
          studentSubjects(
            papers,
            { groupId: null, fourthSubjectId: null },
            new Map(),
          ),
        ),
      ),
    ).toEqual(["s:1", "g:BAN", "s:7"]);
  });
  it("several fourth-type subjects and no choice: none counts", () => {
    const two = [
      ep({ subjectId: 1 }),
      ep({ subjectId: 8, subjectType: "fourth" }),
      ep({ subjectId: 9, subjectType: "fourth" }),
    ];
    expect(
      roles(
        studentSubjects(
          two,
          { groupId: null, fourthSubjectId: null },
          new Map(),
        ),
      ),
    ).toEqual({
      "s:1": "compulsory",
      "s:8": "extra",
      "s:9": "extra",
    });
  });
  it("a paper group with a counted paper is counted", () => {
    const mixed = [
      ep({ subjectId: 1, paperGroup: "X", countsInGpa: false }),
      ep({ subjectId: 2, paperGroup: "X" }),
    ];
    expect(
      roles(
        studentSubjects(
          mixed,
          { groupId: null, fourthSubjectId: null },
          new Map(),
        ),
      ),
    ).toEqual({ "g:X": "compulsory" });
  });
  it("attaches each paper's marks", () => {
    const m = { cq: 50, mcq: 20, practical: null, is_absent: false };
    const list = studentSubjects(
      [ep({ subjectId: 1 })],
      { groupId: null, fourthSubjectId: null },
      new Map([[10, m]]),
    );
    expect(list[0]!.papers[0]!.mark).toEqual(m);
    expect(gradeSubject(list[0]!, S)).toMatchObject({
      obtained: 70,
      grade: "A",
    });
  });
});
