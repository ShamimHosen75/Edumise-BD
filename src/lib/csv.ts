/** One CSV cell: quoted when needed; formulas are defused so spreadsheets do not run them. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // A cell starting with = + - @ (or a tab/CR) would be run as a formula by Excel.
  if (/^[=+\-@\t\r]/.test(text) && typeof value !== "number") text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * CSV text with a header row. Starts with a byte-order mark so Excel opens Bangla text
 * correctly, and uses CRLF line ends as the CSV standard asks.
 */
export function toCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Safe file name for a download: "Class subjects 2026" -> "class-subjects-2026.csv". */
export function csvFileName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "export"}.csv`;
}
