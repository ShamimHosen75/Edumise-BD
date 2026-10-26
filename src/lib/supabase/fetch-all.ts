// The API returns at most 1000 rows per request (supabase/config.toml max_rows), whatever
// .limit() asks for. Lists that can be longer (students, routine, applications) read
// page by page. The query must have a stable order (e.g. .order("id")).

export const PAGE_SIZE = 1000;

type Page<T> = PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>;

/** Reads every row, PAGE_SIZE at a time; `page(from, to)` builds a fresh query. */
export async function fetchAll<T>(
  page: (from: number, to: number) => Page<T>,
  max = 50_000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < max; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE_SIZE) break;
  }
  return rows;
}
