import { z } from "zod";

const ID = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

/** Row ids sent to server actions are checked like any other input. */
export function assertId(value: unknown): number {
  const result = ID.safeParse(value);
  if (!result.success) throw new Error("Invalid id");
  return result.data;
}

/** null means "create a new row". */
export function assertOptionalId(value: unknown): number | null {
  return value === null ? null : assertId(value);
}
