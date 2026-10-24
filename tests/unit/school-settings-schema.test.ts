import { describe, expect, it } from "vitest";

import {
  logoFileSchema,
  schoolSettingsSchema,
  type SchoolSettingsInput,
} from "@/lib/validation/school-settings";

const valid: SchoolSettingsInput = {
  name_en: "Sunrise High School",
  name_bn: "সানরাইজ হাই স্কুল",
  short_name: "SHS",
  address_en: "12 Lake Road",
  address_bn: "",
  phone: "01700000000",
  email: "info@sunrise.test",
  website_url: "https://sunrise.test",
  facebook_url: "",
  youtube_url: "",
  map_embed_url: "https://www.google.com/maps/embed?pb=abc",
  office_hours_en: "",
  office_hours_bn: "",
  primary_color: "#0f766e",
  secondary_color: "#f59e0b",
  eiin: "123456",
  institution_code: "1234",
  center_code: "",
  established_year: 1975,
  head_name_en: "",
  head_name_bn: "",
  head_message_en: "",
  head_message_bn: "",
};

const errorFor = (patch: Partial<Record<keyof SchoolSettingsInput, unknown>>) =>
  schoolSettingsSchema.safeParse({ ...valid, ...patch });

describe("schoolSettingsSchema", () => {
  it("accepts a valid settings form", () => {
    expect(schoolSettingsSchema.parse(valid)).toEqual(valid);
  });
  it("trims text and accepts the year as a string from a form", () => {
    const r = schoolSettingsSchema.parse({
      ...valid,
      name_en: "  Sunrise  ",
      established_year: "1975",
    });
    expect(r.name_en).toBe("Sunrise");
    expect(r.established_year).toBe(1975);
  });
  it.each([
    ["name_en", ""],
    ["name_en", "   "],
    ["primary_color", "red"],
    ["primary_color", "#fff"],
    ["secondary_color", "#12345g"],
    ["email", "not-an-email"],
    ["eiin", "12345"],
    ["institution_code", "12a"],
    ["website_url", "http://insecure.test"],
    ["website_url", "javascript:alert(1)"],
    ["map_embed_url", "https://evil.test/maps/embed"],
    ["map_embed_url", "https://www.google.com/search?q=x"],
    ["phone", "call me"],
    ["established_year", 1700],
    ["established_year", new Date().getFullYear() + 1],
  ])("rejects %s = %j", (field, value) => {
    expect(errorFor({ [field]: value }).success).toBe(false);
  });
});

describe("logoFileSchema", () => {
  const file = (size: number, type: string) =>
    new File([new Uint8Array(size)], "logo", { type });
  it("accepts a small PNG", () => {
    expect(logoFileSchema.safeParse(file(1000, "image/png")).success).toBe(
      true,
    );
  });
  it("rejects SVG, large and empty files", () => {
    expect(logoFileSchema.safeParse(file(1000, "image/svg+xml")).success).toBe(
      false,
    );
    expect(
      logoFileSchema.safeParse(file(2 * 1024 * 1024, "image/png")).success,
    ).toBe(false);
    expect(logoFileSchema.safeParse(file(0, "image/png")).success).toBe(false);
  });
});
