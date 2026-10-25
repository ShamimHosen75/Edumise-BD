import { describe, expect, it } from "vitest";

import {
  datesBetween,
  findClashes,
  hhmm,
  invalidCells,
  isMonth,
  monthGrid,
  shiftMonth,
  weekDays,
  type Booking,
  type RoutineCell,
} from "@/lib/routine";
import {
  examScheduleSchema,
  holidaySchema,
  periodSchema,
  routineSaveSchema,
  workingDaysSchema,
} from "@/lib/validation/routine";

const cell = (o: Partial<RoutineCell> = {}): RoutineCell => ({
  day: 6,
  periodId: 1,
  subjectId: 10,
  staffId: 100,
  roomId: 200,
  ...o,
});
const booking = (o: Partial<Booking> = {}): Booking => ({
  ...cell(),
  sectionId: 2,
  section: "Class 7 A",
  ...o,
});

describe("findClashes", () => {
  it("finds the same teacher in another section at the same time", () => {
    expect(findClashes([cell({ roomId: null })], [booking()], 1)).toEqual([
      { day: 6, periodId: 1, kind: "teacher", section: "Class 7 A" },
    ]);
  });
  it("finds the same room in another section at the same time", () => {
    expect(
      findClashes([cell({ staffId: 101 })], [booking()], 1).map((c) => c.kind),
    ).toEqual(["room"]);
  });
  it("reports teacher and room together", () => {
    expect(findClashes([cell()], [booking()], 1)).toHaveLength(2);
  });
  it("no clash at another period or day, or without teacher and room", () => {
    expect(findClashes([cell({ periodId: 2 })], [booking()], 1)).toEqual([]);
    expect(findClashes([cell({ day: 0 })], [booking()], 1)).toEqual([]);
    expect(
      findClashes(
        [cell({ staffId: null, roomId: null })],
        [booking({ staffId: null, roomId: null })],
        1,
      ),
    ).toEqual([]);
  });
  it("ignores the section's own saved classes (they are being replaced)", () => {
    expect(findClashes([cell()], [booking({ sectionId: 1 })], 1)).toEqual([]);
  });
});

describe("invalidCells", () => {
  const ctx = { workingDays: [6, 0, 1, 2, 3, 4], breakPeriodIds: [5] };
  it("refuses Fridays, breaks and a slot used twice", () => {
    const friday = cell({ day: 5 });
    const brk = cell({ periodId: 5 });
    const twice = cell({ subjectId: 11 });
    expect(invalidCells([cell(), friday, brk, twice], ctx)).toEqual([
      friday,
      brk,
      twice,
    ]);
  });
  it("accepts a normal week", () => {
    expect(
      invalidCells([cell(), cell({ day: 0 }), cell({ periodId: 2 })], ctx),
    ).toEqual([]);
  });
});

describe("calendar helpers", () => {
  it("orders the week from Saturday and keeps working days", () => {
    expect(weekDays([0, 1, 2, 3, 4, 6])).toEqual([6, 0, 1, 2, 3, 4]);
  });
  it("lists dates between two days", () => {
    expect(datesBetween("2026-12-30", "2027-01-02")).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
    expect(datesBetween("2026-01-02", "2026-01-01")).toEqual([]);
  });
  it("builds a month grid starting on Saturday", () => {
    // 1 November 2026 is a Sunday: one empty Saturday before it.
    const weeks = monthGrid("2026-11");
    expect(weeks[0]!.slice(0, 2)).toEqual([null, "2026-11-01"]);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
  it("moves between months and checks month values", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(isMonth("2026-11")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth("<script>")).toBe(false);
  });
  it("shortens times", () => {
    expect(hhmm("08:45:00")).toBe("08:45");
  });
});

describe("routine schemas", () => {
  it("periods must end after they start", () => {
    expect(
      periodSchema.safeParse({
        number: "1",
        starts_at: "09:00",
        ends_at: "08:00",
        is_break: false,
      }).error?.issues[0]?.message,
    ).toBe("errors.endBeforeStart");
    expect(
      periodSchema.parse({
        number: "2",
        starts_at: "08:00:00",
        ends_at: "08:45",
        is_break: false,
      }),
    ).toEqual({
      number: 2,
      starts_at: "08:00",
      ends_at: "08:45",
      is_break: false,
    });
  });
  it("rejects bad times and dates", () => {
    expect(
      examScheduleSchema
        .safeParse({
          exam_id: 1,
          class_id: 1,
          subject_id: 1,
          exam_date: "2026-02-30",
          starts_at: "25:00",
          ends_at: "13:00",
        })
        .error?.issues.map((i) => i.path[0]),
    ).toEqual(["exam_date", "starts_at"]);
    expect(
      holidaySchema.safeParse({
        title_en: "x",
        title_bn: "",
        starts_on: "2026-02-02",
        ends_on: "2026-02-01",
      }).success,
    ).toBe(false);
  });
  it("needs at least one working day, each once", () => {
    expect(workingDaysSchema.safeParse([]).success).toBe(false);
    expect(workingDaysSchema.safeParse([1, 1]).success).toBe(false);
    expect(workingDaysSchema.safeParse([7]).success).toBe(false);
    expect(workingDaysSchema.safeParse([6, 0, 1, 2, 3, 4]).success).toBe(true);
  });
  it("limits the routine to 100 classes", () => {
    const cells = Array.from({ length: 101 }, () => cell());
    expect(
      routineSaveSchema.safeParse({ session_id: 1, section_id: 1, cells })
        .success,
    ).toBe(false);
  });
});
