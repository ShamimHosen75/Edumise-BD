import "server-only";

import { inflateRawSync } from "node:zlib";

// Reads the first sheet of an Excel (.xlsx) file into rows of text, on the server. Only
// what spreadsheets need: shared and inline strings, numbers and booleans. Limits keep a
// crafted file (a "zip bomb") from using much memory.

const MAX_FILE = 2 * 1024 * 1024;
const MAX_PART = 4 * 1024 * 1024;
export const MAX_SHEET_ROWS = 3000;

type Entry = { name: string; method: number; size: number; offset: number };

function entries(buf: Buffer): Map<string, Entry> {
  // End of central directory: the last 22+ bytes, found by its signature.
  let end = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66_000); i--)
    if (buf.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw new Error("not a zip file");
  const count = buf.readUInt16LE(end + 10);
  let at = buf.readUInt32LE(end + 16);
  const out = new Map<string, Entry>();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(at) !== 0x02014b50) throw new Error("bad zip");
    const method = buf.readUInt16LE(at + 10);
    const size = buf.readUInt32LE(at + 20);
    const usize = buf.readUInt32LE(at + 24);
    const nameLen = buf.readUInt16LE(at + 28);
    const extra = buf.readUInt16LE(at + 30);
    const comment = buf.readUInt16LE(at + 32);
    const offset = buf.readUInt32LE(at + 42);
    const name = buf.toString("utf8", at + 46, at + 46 + nameLen);
    if (usize > MAX_PART) throw new Error("file part too large");
    out.set(name, { name, method, size, offset });
    at += 46 + nameLen + extra + comment;
  }
  return out;
}

function read(
  buf: Buffer,
  list: Map<string, Entry>,
  name: string,
): string | null {
  const e = list.get(name);
  if (!e) return null;
  if (buf.readUInt32LE(e.offset) !== 0x04034b50) throw new Error("bad zip");
  const start =
    e.offset +
    30 +
    buf.readUInt16LE(e.offset + 26) +
    buf.readUInt16LE(e.offset + 28);
  const raw = buf.subarray(start, start + e.size);
  const data =
    e.method === 0
      ? raw
      : e.method === 8
        ? inflateRawSync(raw, { maxOutputLength: MAX_PART })
        : null;
  if (!data) throw new Error("unsupported compression");
  return data.toString("utf8");
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/&amp;/g, "&");

/**
 * Each <tag ...>inner</tag> (or <tag .../>) in order, found with indexOf so the time is
 * linear: a crafted file with unclosed tags cannot make the scan quadratic.
 */
export function* elements(
  xml: string,
  tag: string,
): Generator<{ attrs: string; inner: string }> {
  const open = `<${tag}`;
  const close = `</${tag}>`;
  let at = 0;
  for (;;) {
    const start = xml.indexOf(open, at);
    if (start < 0) return;
    const next = xml[start + open.length];
    // "<t" must not match "<tc" or "<text".
    if (next !== ">" && next !== "/" && !/\s/.test(next ?? "")) {
      at = start + open.length;
      continue;
    }
    const gt = xml.indexOf(">", start);
    if (gt < 0) return;
    const head = xml.slice(start + open.length, gt);
    if (head.endsWith("/")) {
      yield { attrs: head.slice(0, -1), inner: "" };
      at = gt + 1;
      continue;
    }
    const end = xml.indexOf(close, gt);
    if (end < 0) return;
    yield { attrs: head, inner: xml.slice(gt + 1, end) };
    at = end + close.length;
  }
}

/** Text of all <t> elements inside an XML fragment (rich text runs joined). */
const texts = (xml: string) =>
  [...elements(xml, "t")].map((e) => decode(e.inner)).join("");

/** "C12" -> column index 2. */
function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** The first worksheet as rows of cell text ("" for empty cells). */
export function readXlsx(bytes: Uint8Array): string[][] {
  if (bytes.byteLength > MAX_FILE) throw new Error("file too large");
  const buf = Buffer.from(bytes);
  const list = entries(buf);
  const workbook = read(buf, list, "xl/workbook.xml");
  const rels = read(buf, list, "xl/_rels/workbook.xml.rels");
  if (!workbook) throw new Error("not an Excel workbook");
  // First sheet -> its relationship -> its file.
  const rid = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook)?.[1];
  const target = rid
    ? (new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`).exec(
        rels ?? "",
      )?.[1] ??
      new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`).exec(
        rels ?? "",
      )?.[1])
    : undefined;
  const path = target
    ? target.startsWith("/")
      ? target.slice(1)
      : `xl/${target}`
    : "xl/worksheets/sheet1.xml";
  const sheet = read(buf, list, path);
  if (!sheet) throw new Error("no worksheet");
  const shared = [
    ...elements(read(buf, list, "xl/sharedStrings.xml") ?? "", "si"),
  ].map((e) => texts(e.inner));

  const rows: string[][] = [];
  for (const row of elements(sheet, "row")) {
    if (rows.length >= MAX_SHEET_ROWS + 1) break;
    const rowNo = Number(/\br="(\d+)"/.exec(row.attrs)?.[1] ?? rows.length + 1);
    // A row number from the file must not make us pad millions of empty rows.
    if (!Number.isSafeInteger(rowNo) || rowNo > MAX_SHEET_ROWS + 1) break;
    const cells: string[] = [];
    for (const c of elements(row.inner, "c")) {
      const attrs = c.attrs;
      const inner = c.inner;
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1];
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1] ?? "n";
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let text = "";
      if (type === "s") text = shared[Number(v)] ?? "";
      else if (type === "inlineStr") text = texts(inner);
      else if (type === "b") text = v === "1" ? "TRUE" : "FALSE";
      else text = v === undefined ? "" : decode(v);
      const col = ref ? columnIndex(ref) : cells.length;
      if (col > 200) continue;
      while (cells.length < col) cells.push("");
      cells[col] = text;
    }
    // Keep row numbers lined up when the file skips empty rows.
    while (rows.length < rowNo - 1) rows.push([]);
    rows.push(cells);
  }
  return rows;
}

/** Rows as records keyed by the header row; blank rows are skipped. */
export function xlsxRecords(bytes: Uint8Array): Record<string, string>[] {
  const [header, ...rows] = readXlsx(bytes);
  if (!header) return [];
  return rows
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) =>
      Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ""])),
    );
}
