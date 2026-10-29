import { describe, expect, it } from "vitest";

import bn from "@/dictionaries/bn.json";
import en from "@/dictionaries/en.json";
import {
  ALPHABET,
  CERTIFICATE_TYPES,
  certificateBody,
  fillTemplate,
  issueSchema,
  makeReference,
  normalizeReference,
  REFERENCE_RE,
  revokeSchema,
  typeOfReference,
  type CertificateFacts,
  type TemplateText,
} from "@/lib/certificates";

const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe("certificate references", () => {
  it("uses 31 characters people cannot mix up", () => {
    expect(ALPHABET).toHaveLength(31);
    for (const c of "01OIL") expect(ALPHABET).not.toContain(c);
  });
  it("makes TS/TC/CC references in the printed form", () => {
    expect(
      makeReference("transfer", seq([5, 17, 21, 0, 18, 7, 28, 8, 2, 20])),
    ).toBe("TC-7KQ2-M9XA-4P");
    expect(makeReference("testimonial", () => 0)).toBe("TS-2222-2222-22");
    expect(makeReference("character", () => 30)).toBe("CC-ZZZZ-ZZZZ-ZZ");
    for (const type of CERTIFICATE_TYPES)
      expect(makeReference(type, () => Math.floor(Math.random() * 31))).toMatch(
        REFERENCE_RE,
      );
  });
  it("refuses a broken random source", () => {
    expect(() => makeReference("transfer", () => 31)).toThrow();
    expect(() => makeReference("transfer", () => -1)).toThrow();
    expect(() => makeReference("transfer", () => 1.5)).toThrow();
  });
  it("reads references as people type or scan them", () => {
    for (const input of [
      "TC-7KQ2-M9XA-4P",
      "tc-7kq2-m9xa-4p",
      " tc 7kq2 m9xa 4p ",
      "TC7KQ2M9XA4P",
      "TC–7KQ2–M9XA–4P",
      "TC-৭KQ২-M৯XA-৪P",
    ])
      expect(normalizeReference(input), input).toBe("TC-7KQ2-M9XA-4P");
  });
  it("refuses what cannot be a reference", () => {
    for (const input of [
      "",
      "TC-7KQ2-M9XA",
      "XX-7KQ2-M9XA-4P",
      "TC-7KQ2-M9XA-4PP",
      "TC-0KQ2-M9XA-4P", // 0 is never used
      "TC-IKQ2-M9XA-4P",
      "TC-7KQ2-M9XA-4P'; drop table x",
      "<script>",
    ])
      expect(normalizeReference(input), input).toBeNull();
  });
  it("knows the type from the prefix", () => {
    expect(typeOfReference("TS-2222-2222-22")).toBe("testimonial");
    expect(typeOfReference("TC-2222-2222-22")).toBe("transfer");
    expect(typeOfReference("CC-2222-2222-22")).toBe("character");
    expect(typeOfReference("XX-2222-2222-22")).toBeNull();
  });
});

describe("certificate text", () => {
  const facts: CertificateFacts = {
    name: "Ayesha Siddika",
    gender: "female",
    parents: ["Abdul Karim", "Rokeya Begum"],
    className: "Class 6",
    section: "A",
    roll: "2",
    session: "2026",
    code: "2026060002",
    birthDate: "15 March 2014",
  };
  const EN = en.certificates.templates as TemplateText;
  const BN = bn.certificates.templates as TemplateText;

  it("fills {placeholders} and leaves unknown ones", () => {
    expect(fillTemplate("{a} and {b} {c}", { a: "1", b: "2" })).toBe(
      "1 and 2 {c}",
    );
    expect(fillTemplate("{constructor}", {})).toBe("{constructor}");
  });
  it("writes a testimonial with the right pronouns", () => {
    const text = certificateBody("testimonial", EN, facts);
    expect(text).toBe(
      "This is to certify that Ayesha Siddika, daughter of Abdul Karim and Rokeya Begum, is a student of this school. She studies in Class 6, section A, roll 2, in the 2026 session. Student ID: 2026060002. Date of birth: 15 March 2014. To the best of my knowledge, she bears a good moral character. I wish her every success in life.",
    );
    expect(
      certificateBody("testimonial", EN, { ...facts, gender: "male" }),
    ).toContain(
      "son of Abdul Karim and Rokeya Begum, is a student of this school. He studies",
    );
  });
  it("leaves out parents and birth date when unknown", () => {
    const text = certificateBody("transfer", EN, {
      ...facts,
      gender: "other",
      parents: [" "],
      birthDate: null,
      className: null,
      roll: "",
    });
    expect(text).toContain(
      "that Ayesha Siddika was a student of this school in —, section A, roll —,",
    );
    expect(text).toContain(
      "Student ID: 2026060002. They are leaving this school at the request of their guardian.",
    );
    expect(text).not.toContain("{");
  });
  it("joins three names", () => {
    expect(
      certificateBody("character", EN, { ...facts, parents: ["A", "B", "C"] }),
    ).toContain("daughter of A, B and C,");
  });
  it("has every type in both languages with no placeholder left over", () => {
    for (const type of CERTIFICATE_TYPES) {
      for (const text of [EN, BN]) {
        const body = certificateBody(type, text, facts);
        expect(body, type).not.toMatch(/\{\w+\}/);
        expect(body).toContain("2026060002");
      }
    }
    expect(
      certificateBody("character", BN, {
        ...facts,
        name: "আয়েশা সিদ্দিকা",
        parents: ["আব্দুল করিম"],
      }),
    ).toBe(
      "এই মর্মে প্রত্যয়ন করা যাচ্ছে যে আয়েশা সিদ্দিকা, আব্দুল করিম-এর কন্যা, 2026 শিক্ষাবর্ষে Class 6, A শাখা, রোল 2-এর শিক্ষার্থী। শিক্ষার্থী আইডি: 2026060002। আমার জানামতে সে শৃঙ্খলাবিরোধী কোনো কাজে অংশ নেয়নি। তার চরিত্র ভালো।",
    );
  });
});

describe("certificate forms", () => {
  const ok = {
    student_id: 3,
    type: "transfer",
    body_en: " Text ",
    body_bn: "",
  };
  it("checks what is issued", () => {
    expect(issueSchema.parse(ok)).toEqual({ ...ok, body_en: "Text" });
    const bad = issueSchema.safeParse({
      ...ok,
      type: "diploma",
      body_en: " ",
      body_bn: "x".repeat(4001),
    });
    expect(bad.error!.issues.map((i) => i.message).sort()).toEqual([
      expect.stringContaining("Invalid option"),
      "errors.required",
      "errors.tooLong",
    ]);
    expect(issueSchema.safeParse({ ...ok, student_id: 0 }).success).toBe(false);
  });
  it("needs a reason to revoke", () => {
    expect(
      revokeSchema.safeParse({ reason: "  " }).error!.issues[0]!.message,
    ).toBe("errors.required");
    expect(revokeSchema.parse({ reason: " Wrong name " })).toEqual({
      reason: "Wrong name",
    });
  });
});
