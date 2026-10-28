import { isBirthRegNo, normalizeBirthRegNo } from "@/lib/admission";
import { toAsciiDigits } from "@/lib/format";
import { dhakaToday } from "@/lib/people";
import { BLOOD_GROUPS, RELIGIONS } from "@/lib/validation/admission";
import { isBdPhone, normalizePhone } from "@/lib/validation/auth";

// Checks rows read from an Excel or CSV file before anything is saved (pure, unit tested).

/** An example row for the template (a made-up student). */
export const IMPORT_EXAMPLE: Record<ImportColumn, string> = {
  name_en: "Example Student",
  name_bn: "",
  gender: "female",
  birth_date: "15/03/2014",
  birth_reg_no: "",
  religion: "islam",
  blood_group: "B+",
  class: "6",
  section: "A",
  roll: "",
  guardian_name: "Example Guardian",
  guardian_phone: "01700000000",
  relation: "father",
};

/** Template columns, in order. */
export const IMPORT_COLUMNS = [
  "name_en",
  "name_bn",
  "gender",
  "birth_date",
  "birth_reg_no",
  "religion",
  "blood_group",
  "class",
  "section",
  "roll",
  "guardian_name",
  "guardian_phone",
  "relation",
] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

export const IMPORT_MAX_ROWS = 2000;

export type ImportSection = { id: number; level: number; name: string };
export type ImportRow = {
  name_en: string;
  name_bn: string;
  gender: "male" | "female" | "other";
  birth_date: string;
  birth_reg_no: string;
  religion: string;
  blood_group: string;
  section_id: number;
  roll: number | null;
  guardian_name: string;
  guardian_phone: string;
  relation: "father" | "mother" | "other";
};
export type ImportIssue = { field: ImportColumn; message: string };
export type CheckedRow = {
  /** Spreadsheet line number (the header is line 1). */
  line: number;
  /** The name as written, to find the row in the preview. */
  name: string;
  row: ImportRow | null;
  issues: ImportIssue[];
};

const GENDER: Record<string, ImportRow["gender"]> = {
  male: "male",
  m: "male",
  boy: "male",
  ছেলে: "male",
  পুরুষ: "male",
  female: "female",
  f: "female",
  girl: "female",
  মেয়ে: "female",
  মহিলা: "female",
  other: "other",
  অন্যান্য: "other",
};
const RELATION: Record<string, ImportRow["relation"]> = {
  father: "father",
  পিতা: "father",
  বাবা: "father",
  mother: "mother",
  মাতা: "mother",
  মা: "mother",
  other: "other",
  guardian: "other",
  অভিভাবক: "other",
};

/** " Name EN " -> "name_en", "Guardian phone (01…)" -> "guardian_phone". */
export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .trim()
    .replace(/[\s-]+/g, "_");
}

const cell = (v: unknown) =>
  v === null || v === undefined ? "" : toAsciiDigits(String(v)).trim();

/** YYYY-MM-DD or DD/MM/YYYY (also with - or .) -> YYYY-MM-DD; "" if empty; null if invalid. */
export function parseDate(value: string): string | null {
  if (!value) return "";
  // A date typed into Excel is stored as a day number (1 = 1 January 1900).
  if (/^\d{5}(\.\d+)?$/.test(value)) {
    const serial = Math.floor(Number(value));
    const date = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
    const out = date.toISOString().slice(0, 10);
    return out < dhakaToday() ? out : null;
  }
  let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (dmy) [d, m, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  )
    return null;
  const out = date.toISOString().slice(0, 10);
  // "In the past" by the school's calendar (Dhaka), not UTC.
  return out < dhakaToday() ? out : null;
}

/**
 * Rolls for new students in each section: a roll written in the file is kept; an empty
 * roll gets the next free number after the highest roll in that section (already
 * enrolled or written in the file), in file order.
 */
export function assignRolls(
  rows: { sectionId: number; roll: number | null }[],
  usedRolls: Set<string>,
): number[] {
  const highest = new Map<number, number>();
  const bump = (section: number, roll: number) =>
    highest.set(section, Math.max(highest.get(section) ?? 0, roll));
  for (const key of usedRolls) {
    const [section, roll] = key.split(":").map(Number);
    if (section && roll) bump(section, roll);
  }
  for (const r of rows) if (r.roll !== null) bump(r.sectionId, r.roll);
  return rows.map((r) => {
    if (r.roll !== null) return r.roll;
    const next = (highest.get(r.sectionId) ?? 0) + 1;
    highest.set(r.sectionId, next);
    return next;
  });
}

/**
 * Validates every row: required fields, formats, class + section that exist, rolls and
 * birth registration numbers not used twice (in the file or already in the school).
 */
export function checkImportRows(
  raw: Record<string, unknown>[],
  ctx: {
    sections: ImportSection[];
    /** "sectionId:roll" already used this session. */
    usedRolls: Set<string>;
    usedBirthRegs: Set<string>;
  },
): CheckedRow[] {
  const rolls = new Map<string, number>();
  const regs = new Map<string, number>();
  const checked = raw.map((source, i): CheckedRow => {
    const line = i + 2;
    const get = (key: ImportColumn) => {
      const found = Object.entries(source).find(
        ([k]) => normalizeHeader(k) === key,
      );
      return cell(found?.[1]);
    };
    const issues: ImportIssue[] = [];
    const bad = (field: ImportColumn, message: string) =>
      issues.push({ field, message });

    const name_en = get("name_en");
    if (!name_en) bad("name_en", "errors.required");
    else if (name_en.length > 100) bad("name_en", "errors.tooLong");
    const gender = GENDER[get("gender").toLowerCase()];
    if (!gender) bad("gender", "errors.gender");
    const birth_date = parseDate(get("birth_date"));
    if (birth_date === null) bad("birth_date", "errors.date");
    const regRaw = get("birth_reg_no");
    const birth_reg_no = regRaw ? normalizeBirthRegNo(regRaw) : "";
    if (regRaw && !isBirthRegNo(regRaw))
      bad("birth_reg_no", "errors.birthRegNo");
    else if (birth_reg_no) {
      if (ctx.usedBirthRegs.has(birth_reg_no) || regs.has(birth_reg_no))
        bad("birth_reg_no", "errors.birthRegTaken");
      regs.set(birth_reg_no, line);
    }
    const religion = get("religion").toLowerCase();
    if (religion && !(RELIGIONS as readonly string[]).includes(religion))
      bad("religion", "errors.religion");
    const blood_group = get("blood_group").toUpperCase();
    if (
      blood_group &&
      !(BLOOD_GROUPS as readonly string[]).includes(blood_group)
    )
      bad("blood_group", "errors.bloodGroup");

    const level = Number(get("class").replace(/^class\s*/i, ""));
    const sectionName = get("section").toLowerCase();
    const section = ctx.sections.find(
      (s) => s.level === level && s.name.toLowerCase() === sectionName,
    );
    if (!section) bad("section", "errors.section");
    const rollText = get("roll");
    const roll = rollText ? Number(rollText) : null;
    if (roll !== null && (!Number.isInteger(roll) || roll < 1 || roll > 999))
      bad("roll", "errors.roll");
    else if (roll !== null && section) {
      const key = `${section.id}:${roll}`;
      if (ctx.usedRolls.has(key) || rolls.has(key))
        bad("roll", "errors.rollTaken");
      rolls.set(key, line);
    }

    const guardian_name = get("guardian_name");
    if (!guardian_name) bad("guardian_name", "errors.required");
    // Spreadsheets drop the leading 0 of a mobile number stored as a number.
    const phoneCell = get("guardian_phone");
    const phoneRaw = /^1[3-9][0-9]{8}$/.test(phoneCell)
      ? `0${phoneCell}`
      : phoneCell;
    const guardian_phone = normalizePhone(phoneRaw);
    if (!phoneRaw) bad("guardian_phone", "errors.required");
    else if (!isBdPhone(phoneRaw)) bad("guardian_phone", "errors.mobile");
    const relationRaw = get("relation").toLowerCase();
    const relation = relationRaw ? RELATION[relationRaw] : "father";
    if (!relation) bad("relation", "errors.relation");

    return {
      line,
      name: name_en,
      issues,
      row:
        issues.length === 0
          ? {
              name_en,
              name_bn: get("name_bn"),
              gender: gender!,
              birth_date: birth_date ?? "",
              birth_reg_no,
              religion,
              blood_group,
              section_id: section!.id,
              roll,
              guardian_name,
              guardian_phone,
              relation: relation!,
            }
          : null,
    };
  });
  // Every valid row gets its final roll, so the preview shows it and the database
  // receives exact numbers.
  const ok = checked.filter((c) => c.row);
  const assigned = assignRolls(
    ok.map((c) => ({ sectionId: c.row!.section_id, roll: c.row!.roll })),
    ctx.usedRolls,
  );
  ok.forEach((c, i) => (c.row!.roll = assigned[i]!));
  return checked;
}
