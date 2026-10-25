import { exPrincipalSchema, governingSchema } from "@/lib/validation/people";

/** Dashboard lists of people that are not staff accounts. */
export const PEOPLE_KINDS = ["governing-body", "ex-principals"] as const;
export type PeopleKind = (typeof PEOPLE_KINDS)[number];

export const isPeopleKind = (v: string): v is PeopleKind =>
  (PEOPLE_KINDS as readonly string[]).includes(v);

export const PEOPLE_TABLE = {
  "governing-body": "governing_body",
  "ex-principals": "ex_principals",
} as const satisfies Record<PeopleKind, string>;

export const PEOPLE_SCHEMAS = {
  "governing-body": governingSchema,
  "ex-principals": exPrincipalSchema,
} as const;

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown, fallback: number | "") =>
  typeof v === "number" ? v : fallback;

/** Database row (or nothing, for a new person) -> form values. */
export function personFormValues(kind: PeopleKind, row: Row | null) {
  const r = row ?? {};
  const names = {
    full_name_en: str(r.full_name_en),
    full_name_bn: str(r.full_name_bn),
  };
  if (kind === "governing-body")
    return {
      ...names,
      position_en: str(r.position_en),
      position_bn: str(r.position_bn),
      term_start: str(r.term_start),
      term_end: str(r.term_end),
      sort_order: num(r.sort_order, 0),
    };
  return {
    ...names,
    from_year: num(r.from_year, ""),
    to_year: num(r.to_year, ""),
    note_en: str(r.note_en),
    note_bn: str(r.note_bn),
  };
}
