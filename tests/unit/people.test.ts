import { describe, expect, it } from "vitest";

import { toAsciiDigits } from "@/lib/format";
import { dhakaToday, groupByDesignation, groupByTerm } from "@/lib/people";
import { isPeopleKind, personFormValues } from "@/lib/people-admin";
import {
  contactSchema,
  exPrincipalSchema,
  governingSchema,
} from "@/lib/validation/people";
import { isMapEmbedUrl } from "@/lib/validation/school-settings";

const staff = (
  id: number,
  rank: number,
  sort: number,
  name: string,
  designation = `D${rank}`,
) => ({
  id,
  designation_en: designation,
  designation_bn: "",
  designation_rank: rank,
  sort_order: sort,
  full_name_en: name,
});

describe("groupByDesignation", () => {
  it("orders groups by rank and people by sort order, then name", () => {
    const groups = groupByDesignation([
      staff(1, 4, 2, "Zia"),
      staff(2, 1, 0, "Head"),
      staff(3, 4, 1, "Bina"),
      staff(4, 4, 1, "Anis"),
      staff(5, 6, 0, "Office"),
    ]);
    expect(groups.map((g) => g.first.designation_en)).toEqual([
      "D1",
      "D4",
      "D6",
    ]);
    expect(groups[1]!.rows.map((r) => r.full_name_en)).toEqual([
      "Anis",
      "Bina",
      "Zia",
    ]);
  });
  it("returns nothing for nobody", () => {
    expect(groupByDesignation([])).toEqual([]);
  });
});

describe("groupByTerm", () => {
  const m = (id: number, start: string, end: string | null, sort = 0) => ({
    id,
    term_start: start,
    term_end: end,
    sort_order: sort,
  });
  const rows = [
    m(1, "2025-01-01", null, 2),
    m(2, "2025-01-01", null, 1),
    m(3, "2022-01-01", "2024-12-31"),
    m(4, "2019-01-01", "2021-12-31"),
    m(5, "2023-01-01", "2026-10-25"),
  ];
  it("splits current and former terms, newest first", () => {
    const { current, former } = groupByTerm(rows, "2026-10-25");
    expect(current.map((t) => t.key)).toEqual([
      "2025-01-01/",
      "2023-01-01/2026-10-25",
    ]);
    expect(current[0]!.rows.map((r) => r.id)).toEqual([2, 1]);
    expect(former.map((t) => t.key)).toEqual([
      "2022-01-01/2024-12-31",
      "2019-01-01/2021-12-31",
    ]);
  });
  it("a term that ended yesterday is former", () => {
    const { former } = groupByTerm(rows, "2026-10-26");
    expect(former[0]!.key).toBe("2023-01-01/2026-10-25");
  });
  it("uses the Bangladesh date", () => {
    expect(dhakaToday(new Date("2026-10-24T19:00:00Z"))).toBe("2026-10-25");
    expect(dhakaToday(new Date("2026-10-24T17:00:00Z"))).toBe("2026-10-24");
  });
});

describe("contact form", () => {
  const ok = {
    name: "Karim",
    phone: "01711000000",
    email: "",
    subject: "Admission",
    message: "When does admission open?",
    website: "",
  };
  it("accepts a valid message and normalises the phone number", () => {
    expect(
      contactSchema.parse({ ...ok, phone: "+880 1711-000000" }).phone,
    ).toBe("01711000000");
    expect(contactSchema.parse({ ...ok, phone: "০১৭১১০০০০০০" }).phone).toBe(
      "01711000000",
    );
  });
  it("names the field and the reason for each problem", () => {
    const result = contactSchema.safeParse({
      name: " ",
      phone: "12345",
      email: "not-an-email",
      subject: "",
      message: "short",
    });
    expect(result.success).toBe(false);
    const issues = Object.fromEntries(
      result.error!.issues.map((i) => [i.path[0], i.message]),
    );
    expect(issues).toEqual({
      name: "errors.required",
      phone: "errors.mobile",
      email: "errors.email",
      subject: "errors.required",
      message: "errors.messageShort",
    });
  });
  it("limits lengths", () => {
    expect(
      contactSchema.safeParse({ ...ok, message: "x".repeat(2001) }).success,
    ).toBe(false);
  });
});

describe("governing body and former head teachers", () => {
  const member = {
    full_name_en: "A",
    full_name_bn: "",
    position_en: "Chairman",
    position_bn: "",
    term_start: "2025-01-01",
    term_end: "",
    sort_order: "1",
  };
  it("validates terms", () => {
    expect(governingSchema.parse(member).sort_order).toBe(1);
    expect(
      governingSchema.safeParse({ ...member, term_end: "2024-01-01" }).success,
    ).toBe(false);
    expect(
      governingSchema.safeParse({ ...member, term_start: "2025-02-30" })
        .success,
    ).toBe(false);
  });
  it("validates years", () => {
    const head = {
      full_name_en: "B",
      full_name_bn: "",
      from_year: "1990",
      to_year: "2004",
      note_en: "",
      note_bn: "",
    };
    expect(exPrincipalSchema.safeParse(head).success).toBe(true);
    expect(
      exPrincipalSchema.safeParse({ ...head, to_year: "1980" }).success,
    ).toBe(false);
    expect(
      exPrincipalSchema.safeParse({ ...head, from_year: "" }).success,
    ).toBe(false);
    expect(
      exPrincipalSchema.safeParse({ ...head, to_year: "3000" }).success,
    ).toBe(false);
  });
  it("gives form values for new and saved people", () => {
    expect(isPeopleKind("governing-body")).toBe(true);
    expect(isPeopleKind("staff")).toBe(false);
    expect(personFormValues("ex-principals", null)).toMatchObject({
      from_year: "",
      to_year: "",
    });
    expect(
      personFormValues("governing-body", { term_end: null, sort_order: 3 }),
    ).toMatchObject({ term_end: "", sort_order: 3 });
  });
});

describe("small helpers", () => {
  it("reads Bangla digits", () => {
    expect(toAsciiDigits("০১২৩৪৫৬৭৮৯ abc")).toBe("0123456789 abc");
  });
  it("accepts only Google Maps embed links", () => {
    expect(isMapEmbedUrl("https://www.google.com/maps/embed?pb=x")).toBe(true);
    expect(isMapEmbedUrl("https://evil.test/maps/embed")).toBe(false);
    expect(isMapEmbedUrl("javascript:alert(1)")).toBe(false);
    expect(isMapEmbedUrl("not a url")).toBe(false);
  });
});
