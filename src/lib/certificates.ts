// Certificate references and body text (pure, unit tested).

import { z } from "zod";

import { toAsciiDigits } from "@/lib/format";

export const CERTIFICATE_TYPES = [
  "testimonial",
  "transfer",
  "character",
] as const;
export type CertificateType = (typeof CERTIFICATE_TYPES)[number];

export const PREFIX: Record<CertificateType, string> = {
  testimonial: "TS",
  transfer: "TC",
  character: "CC",
};

/** Characters people cannot mix up: no 0/O, 1/I/L. 31 symbols, 10 per reference. */
export const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const BODY = 10;
export const REFERENCE_RE =
  /^(TS|TC|CC)-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{2}$/;

/**
 * A new reference such as TC-7KQ2-M9XA-4P. `random(n)` returns a whole number 0..n-1
 * (crypto.randomInt on the server), so 31^10 ≈ 8 × 10^14 references cannot be guessed.
 */
export function makeReference(
  type: CertificateType,
  random: (n: number) => number,
): string {
  const chars = Array.from({ length: BODY }, () => {
    const i = random(ALPHABET.length);
    if (!Number.isInteger(i) || i < 0 || i >= ALPHABET.length)
      throw new Error("random() out of range");
    return ALPHABET[i];
  }).join("");
  return `${PREFIX[type]}-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
}

/**
 * A reference as typed or scanned ("tc 7kq2 m9xa 4p", Bangla digits, missing dashes) in
 * its printed form, or null when it cannot be one.
 */
export function normalizeReference(input: string): string | null {
  const raw = toAsciiDigits(input)
    .toUpperCase()
    .replace(/[\s\-–—_.]/g, "");
  if (!/^[A-Z0-9]{12}$/.test(raw)) return null;
  const ref = `${raw.slice(0, 2)}-${raw.slice(2, 6)}-${raw.slice(6, 10)}-${raw.slice(10)}`;
  return REFERENCE_RE.test(ref) ? ref : null;
}

/** The type a reference belongs to. */
export function typeOfReference(ref: string): CertificateType | null {
  const prefix = ref.slice(0, 2);
  return CERTIFICATE_TYPES.find((t) => PREFIX[t] === prefix) ?? null;
}

/** Replaces {key} with values; unknown keys stay as they are. */
export function fillTemplate(
  template: string,
  values: Readonly<Record<string, string>>,
): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) =>
    Object.hasOwn(values, key) ? values[key]! : m,
  );
}

export type Gender = "male" | "female" | "other";

/** One language's wording (from the dictionary). */
export type TemplateText = {
  bodies: Record<CertificateType, string>;
  /** ", {child} of {names}," */
  parents: string;
  child: Record<Gender, string>;
  /** " Date of birth: {date}." */
  birth: string;
  and: string;
  /** Pronouns and the verb forms that follow them (they are / he is). */
  pronouns: Record<Gender, Record<string, string>>;
  /** Shown where a detail is unknown. */
  unknown: string;
};

/** What the template needs, already in the target language (names, digits, dates). */
export type CertificateFacts = {
  name: string;
  gender: Gender;
  parents: string[];
  className: string | null;
  section: string | null;
  roll: string | null;
  session: string | null;
  code: string;
  birthDate: string | null;
};

/** The certificate's body text, ready for the office to read and edit. */
export function certificateBody(
  type: CertificateType,
  text: TemplateText,
  facts: CertificateFacts,
): string {
  const names = facts.parents.filter((p) => p.trim());
  const parents = names.length
    ? fillTemplate(text.parents, {
        child: text.child[facts.gender],
        names:
          names.length > 1
            ? `${names.slice(0, -1).join(", ")} ${text.and} ${names[names.length - 1]}`
            : names[0]!,
      })
    : "";
  const birth = facts.birthDate
    ? fillTemplate(text.birth, { date: facts.birthDate })
    : "";
  const or = (v: string | null) => (v && v.trim() ? v : text.unknown);
  return fillTemplate(text.bodies[type], {
    ...text.pronouns[facts.gender],
    name: facts.name,
    parents,
    birth,
    class: or(facts.className),
    section: or(facts.section),
    roll: or(facts.roll),
    session: or(facts.session),
    code: facts.code,
  });
}

const id = z.number().int().positive();

/** Issuing: the student, the type, and the body text as edited. */
export const issueSchema = z.object({
  student_id: id,
  type: z.enum(CERTIFICATE_TYPES),
  body_en: z
    .string()
    .trim()
    .min(1, "errors.required")
    .max(4000, "errors.tooLong"),
  body_bn: z.string().trim().max(4000, "errors.tooLong"),
});
export type IssueInput = z.infer<typeof issueSchema>;

export const revokeSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "errors.required")
    .max(500, "errors.tooLong"),
});
