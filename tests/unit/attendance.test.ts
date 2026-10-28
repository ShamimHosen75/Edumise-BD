import { describe, expect, it } from "vitest";

import {
  absenceStreak,
  canMark,
  isSchoolDay,
  nextStatus,
  schoolDays,
  summarize,
  type DayMark,
} from "@/lib/attendance";
import { columnName, crc32, toXlsx, zipStore } from "@/lib/xlsx";

const SAT_TO_THU = [6, 0, 1, 2, 3, 4];

describe("school days", () => {
  it("skips Fridays and holidays", () => {
    // 15–21 November 2026: Sunday to Saturday; Friday 20th is closed.
    const holidays = [{ start: "2026-11-17", end: "2026-11-18" }];
    expect(
      schoolDays("2026-11-15", "2026-11-21", SAT_TO_THU, holidays),
    ).toEqual(["2026-11-15", "2026-11-16", "2026-11-19", "2026-11-21"]);
    expect(isSchoolDay("2026-11-20", SAT_TO_THU, [])).toBe(false);
    expect(isSchoolDay("2026-11-17", SAT_TO_THU, holidays)).toBe(false);
  });
});

describe("summarize", () => {
  const days = [
    "2026-11-15",
    "2026-11-16",
    "2026-11-17",
    "2026-11-18",
    "2026-11-19",
  ];
  const marks = (...s: DayMark["status"][]): DayMark[] =>
    s.map((status, i) => ({ date: days[i]!, status }));

  it("late counts as attended, leave is not absence", () => {
    const r = summarize(
      marks("present", "late", "absent", "leave", "present"),
      days,
    );
    expect(r).toMatchObject({
      present: 2,
      late: 1,
      absent: 1,
      leave: 1,
      unmarked: 0,
    });
    // (2 + 1) / (5 − 1) = 75 %
    expect(r.percent).toBe(75);
  });
  it("all leave or nothing marked gives no percentage", () => {
    expect(summarize(marks("leave", "leave"), days).percent).toBeNull();
    expect(summarize([], days)).toMatchObject({ percent: null, unmarked: 5 });
  });
  it("ignores marks on days the school was closed", () => {
    const r = summarize(
      [...marks("present"), { date: "2026-11-20", status: "absent" }],
      days,
    );
    expect(r.absent).toBe(0);
    expect(r.percent).toBe(100);
  });
  it("rounds to one decimal", () => {
    expect(summarize(marks("present", "absent", "absent"), days).percent).toBe(
      33.3,
    );
  });
});

describe("absenceStreak", () => {
  const days = ["2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18"];
  it("counts absences in a row up to the last marked day", () => {
    expect(
      absenceStreak(
        [
          { date: "2026-11-15", status: "present" },
          { date: "2026-11-16", status: "absent" },
          { date: "2026-11-17", status: "absent" },
        ],
        days,
      ),
    ).toBe(2);
  });
  it("leave and unmarked days neither break nor add to it", () => {
    expect(
      absenceStreak(
        [
          { date: "2026-11-15", status: "absent" },
          { date: "2026-11-16", status: "leave" },
          { date: "2026-11-17", status: "absent" },
        ],
        days,
      ),
    ).toBe(2);
    expect(
      absenceStreak([{ date: "2026-11-18", status: "present" }], days),
    ).toBe(0);
  });
});

describe("marking rules", () => {
  it("cycles Present, Absent, Late, Leave", () => {
    expect(nextStatus("present")).toBe("absent");
    expect(nextStatus("absent")).toBe("late");
    expect(nextStatus("late")).toBe("leave");
    expect(nextStatus("leave")).toBe("present");
  });
  it("teachers: today and 3 days back; nobody: the future", () => {
    const today = "2026-11-10";
    expect(canMark("2026-11-07", today, "teacher")).toBe(true);
    expect(canMark("2026-11-06", today, "teacher")).toBe(false);
    expect(canMark("2026-11-11", today, "teacher")).toBe(false);
    expect(canMark("2026-01-01", today, "admin")).toBe(true);
    expect(canMark("2026-11-11", today, "admin")).toBe(false);
  });
});

describe("xlsx", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
  it("names columns like Excel", () => {
    expect([0, 25, 26, 27, 701, 702].map(columnName)).toEqual([
      "A",
      "Z",
      "AA",
      "AB",
      "ZZ",
      "AAA",
    ]);
  });
  it("writes a zip with the workbook parts, text and numbers", () => {
    const file = toXlsx("Class 6 A", [
      ["Roll", "Name", "%"],
      [1, "রহিম <আহমেদ>", 95.5],
      [2, '=HYPERLINK("x")', null],
    ]);
    expect([...file.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const text = new TextDecoder().decode(file);
    expect(text).toContain("xl/worksheets/sheet1.xml");
    expect(text).toContain('<c r="C2"><v>95.5</v></c>');
    expect(text).toContain("রহিম &lt;আহমেদ&gt;");
    // A formula-looking cell is stored as text, never as a formula.
    expect(text).not.toContain("<f>");
    expect(text).toContain(
      't="inlineStr"><is><t xml:space="preserve">=HYPERLINK',
    );
  });
  it("zipStore writes an end-of-directory record", () => {
    const zip = zipStore([{ name: "a.txt", data: new Uint8Array([65]) }]);
    const end = zip.subarray(zip.length - 22);
    expect([...end.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x05, 0x06]);
  });
});

describe("monthly sheet", () => {
  it("builds rows with totals, greys closed and future days, and exports codes", async () => {
    const { buildSheet, sheetTable } = await import("@/lib/attendance-sheet");
    // November 2026, today the 5th; Friday the 6th is in the future anyway.
    const sheet = buildSheet(
      "2026-11",
      "2026-11-05",
      [{ studentId: 1, roll: 1, name: "Rahim" }],
      [
        { studentId: 1, date: "2026-11-01", status: "present" },
        { studentId: 1, date: "2026-11-02", status: "absent" },
        { studentId: 1, date: "2026-11-03", status: "leave" },
      ],
      SAT_TO_THU,
      [{ start: "2026-11-04", end: "2026-11-04" }],
    );
    expect(sheet.dates).toHaveLength(30);
    // 1, 2, 3, 5 November are open (4th is a holiday, later days are still to come).
    expect([...sheet.open]).toEqual([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-05",
    ]);
    expect(sheet.rows[0]!.summary).toMatchObject({
      present: 1,
      absent: 1,
      leave: 1,
      unmarked: 1,
      percent: 50,
    });
    const table = sheetTable(sheet, {
      roll: "Roll",
      name: "Name",
      codes: { present: "P", absent: "A", late: "L", leave: "Lv" },
      percent: "%",
    });
    expect(table[0]!.slice(0, 4)).toEqual(["Roll", "Name", 1, 2]);
    expect(table[1]!.slice(0, 6)).toEqual([1, "Rahim", "P", "A", "Lv", null]);
    expect(table[1]!.at(-1)).toBe(50);
  });
});
