import "server-only";

import type { Tables } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/public";

import { cachedDetailQuery, cachedPublicQuery, TAGS } from "./cache";

const db = () => createPublicClient();

function check<T>({
  data,
  error,
}: {
  data: T | null;
  error: { message: string } | null;
}): T {
  if (error) throw new Error(error.message);
  return data as T;
}

/** A row of the public_staff view (public fields only; the view has no private columns). */
export type PublicStaff = {
  id: number;
  full_name_en: string;
  full_name_bn: string;
  photo_path: string | null;
  designation_en: string;
  designation_bn: string;
  designation_rank: number;
  subject_en: string;
  subject_bn: string;
  qualification_en: string;
  qualification_bn: string;
  bio_en: string;
  bio_bn: string;
  joining_year: number | null;
  is_current: boolean;
  sort_order: number;
};

const STAFF_COLUMNS =
  "id, full_name_en, full_name_bn, photo_path, designation_en, designation_bn, designation_rank, subject_en, subject_bn, qualification_en, qualification_bn, bio_en, bio_bn, joining_year, is_current, sort_order";

export const getDirectory = cachedPublicQuery<PublicStaff[], []>(
  "staff-directory",
  [TAGS.staff],
  async () =>
    check(
      await db().from("public_staff").select(STAFF_COLUMNS),
    ) as PublicStaff[],
  [],
);

export const getStaffProfile = cachedDetailQuery<PublicStaff | null, [number]>(
  "staff-profile",
  [TAGS.staff],
  async (id: number) =>
    check(
      await db()
        .from("public_staff")
        .select(STAFF_COLUMNS)
        .eq("id", id)
        .maybeSingle(),
    ) as PublicStaff | null,
);

export type GoverningMember = Pick<
  Tables<"governing_body">,
  | "id"
  | "full_name_en"
  | "full_name_bn"
  | "position_en"
  | "position_bn"
  | "photo_path"
  | "term_start"
  | "term_end"
  | "sort_order"
>;

export const getGoverningBody = cachedPublicQuery<GoverningMember[], []>(
  "governing-body",
  [TAGS.governing],
  async () =>
    check(
      await db()
        .from("governing_body")
        .select(
          "id, full_name_en, full_name_bn, position_en, position_bn, photo_path, term_start, term_end, sort_order",
        ),
    ),
  [],
);

export type ExPrincipal = Pick<
  Tables<"ex_principals">,
  | "id"
  | "full_name_en"
  | "full_name_bn"
  | "photo_path"
  | "from_year"
  | "to_year"
  | "note_en"
  | "note_bn"
>;

export const getExPrincipals = cachedPublicQuery<ExPrincipal[], []>(
  "ex-principals",
  [TAGS.exPrincipals],
  async () =>
    check(
      await db()
        .from("ex_principals")
        .select(
          "id, full_name_en, full_name_bn, photo_path, from_year, to_year, note_en, note_bn",
        )
        .order("to_year", { ascending: false })
        .order("from_year", { ascending: false }),
    ),
  [],
);
