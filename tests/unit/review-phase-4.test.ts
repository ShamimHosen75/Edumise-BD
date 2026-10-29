// Phase 4 code review: regression tests (docs/code-review-phase-4.md).
import { describe, expect, it } from "vitest";

import { attendancePercent } from "@/lib/attendance";
import { DEFAULT_SCALE, gradeSubject, parseScale } from "@/lib/grading";
import { needsFourthChoice, type ExamPaper } from "@/lib/grading-subjects";
import {
  isComplete,
  readFileMark,
  readMarkRows,
  takesSubject,
} from "@/lib/marks";
import { buildResults } from "@/lib/results-build";
import { fetchAll } from "@/lib/supabase/fetch-all";

const S = parseScale(DEFAULT_SCALE);
const ES = { cq_full: 70, mcq_full: 30, practical_full: 0 };
const blank = { cq: null, mcq: null, practical: null, is_absent: false };

describe("complete rows (review C5)", () => {
  it("needs every part in use, or absent", () => {
    expect(isComplete({ ...blank, cq: 60 }, ES)).toBe(false);
    expect(isComplete({ ...blank, cq: 60, mcq: 0 }, ES)).toBe(true);
    expect(isComplete({ ...blank, is_absent: true }, ES)).toBe(true);
    expect(
      isComplete(blank, { cq_full: 0, mcq_full: 0, practical_full: 0 }),
    ).toBe(true);
  });
  it("a paper with a part left empty is missing, not graded as 0", () => {
    const g = gradeSubject(
      {
        key: "s:1",
        role: "compulsory",
        papers: [
          {
            examSubjectId: 1,
            ...ES,
            cq_pass: 23,
            mcq_pass: 10,
            practical_pass: null,
            mark: { ...blank, cq: 60 },
          },
        ],
      },
      S,
    );
    expect(g.missing).toBe(true);
  });
});

describe("who takes a subject (review C2)", () => {
  it("everyone, or the student's group", () => {
    expect(takesSubject([null], null)).toBe(true);
    expect(takesSubject([2], 2)).toBe(true);
    expect(takesSubject([2], 3)).toBe(false);
    expect(takesSubject([2, 3], null)).toBe(false);
  });
});

describe("paper groups: pass marks per part (results review C5)", () => {
  it("a paper without a CQ pass mark cannot hide another paper's CQ fail", () => {
    const paper = (id: number, cq: number, cq_pass: number | null) => ({
      examSubjectId: id,
      ...ES,
      cq_pass,
      mcq_pass: null,
      practical_pass: null,
      mark: { ...blank, cq, mcq: 20 },
    });
    const g = gradeSubject(
      {
        key: "g:X",
        role: "compulsory",
        papers: [paper(1, 5, 23), paper(2, 60, null)],
      },
      S,
    );
    expect(g).toMatchObject({ grade: "F", failedParts: ["cq"] });
  });
});

describe("fourth subject not chosen (results review C6)", () => {
  const ep = (
    subjectId: number,
    subjectType: ExamPaper["subjectType"],
  ): ExamPaper => ({
    examSubjectId: subjectId,
    subjectId,
    ...ES,
    cq_pass: 23,
    mcq_pass: 10,
    practical_pass: null,
    subjectType,
    paperGroup: null,
    countsInGpa: true,
    groupIds: [null],
    sortOrder: subjectId,
  });
  const papers = [ep(1, "compulsory"), ep(2, "fourth"), ep(3, "fourth")];
  it("is reported when several fourth subjects exist and none is chosen", () => {
    expect(
      needsFourthChoice(papers, { groupId: null, fourthSubjectId: null }),
    ).toBe(true);
    expect(
      needsFourthChoice(papers, { groupId: null, fourthSubjectId: 2 }),
    ).toBe(false);
    expect(
      needsFourthChoice(papers.slice(0, 2), {
        groupId: null,
        fourthSubjectId: null,
      }),
    ).toBe(false);
  });
  it("stops processing", () => {
    const full = { ...blank, cq: 50, mcq: 20 };
    const out = buildResults({
      scale: S,
      papers: papers.map((p) => ({
        ...p,
        classId: 9,
        name_en: `S${p.subjectId}`,
        name_bn: "",
      })),
      students: [
        {
          studentId: 7,
          classId: 9,
          sectionId: 1,
          sectionOrder: 1,
          roll: 1,
          groupId: null,
          fourthSubjectId: null,
        },
      ],
      marks: new Map([
        [
          7,
          new Map([
            [1, full],
            [2, full],
            [3, full],
          ]),
        ],
      ]),
      attendance: new Map(),
    });
    expect(out.needsFourth).toEqual([7]);
  });
});

describe("Excel decimals in imports (review C10)", () => {
  it("rounds long decimals Excel writes", () => {
    expect(readFileMark("70.150000000000006")).toBe(70.15);
    expect(readFileMark("65.5")).toBe(65.5);
    expect(readFileMark("abc")).toBeNaN();
    const [row] = readMarkRows(
      [{ roll: "1", cq: "60.000000000000007", mcq: "20" }],
      [{ studentId: 9, roll: 1 }],
      ES,
    );
    expect(row!.row).toMatchObject({ cq: 60, mcq: 20 });
  });
});

describe("attendance % from counts (review P1)", () => {
  it("matches the summary rule", () => {
    expect(attendancePercent({ present: 18, absent: 1, late: 1 })).toBe(95);
    expect(attendancePercent({ present: 0, absent: 0, late: 0 })).toBeNull();
  });
});

describe("fetchAll never shortens a list silently (review P1)", () => {
  it("throws when there are more rows than allowed", async () => {
    const page = (from: number, to: number) =>
      Promise.resolve({
        data: Array.from({ length: to - from + 1 }, (_, i) => from + i),
        error: null,
      });
    await expect(fetchAll(page, 2000)).rejects.toThrow("More than 2000 rows");
    const short = (from: number) =>
      Promise.resolve({ data: from === 0 ? [1, 2] : [], error: null });
    await expect(fetchAll(short)).resolves.toEqual([1, 2]);
  });
});
