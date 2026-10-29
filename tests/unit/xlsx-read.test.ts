import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { readXlsx, xlsxRecords } from "@/lib/xlsx-read";
import { toXlsx, zipStore } from "@/lib/xlsx";

const fixture = (name: string) =>
  new Uint8Array(readFileSync(path.join(__dirname, "../fixtures", name)));

describe("readXlsx", () => {
  it("reads a file saved by another spreadsheet program (compressed, shared strings)", () => {
    const rows = xlsxRecords(fixture("marks-openpyxl.xlsx"));
    expect(rows).toEqual([
      {
        roll: "1",
        name: "রহিম আহমেদ",
        cq: "65.5",
        mcq: "25",
        practical: "",
        absent: "",
      },
      {
        roll: "2",
        name: "Ayesha & <Siddika>",
        cq: "",
        mcq: "",
        practical: "",
        absent: "yes",
      },
      {
        roll: "3",
        name: "Tanvir",
        cq: "70",
        mcq: "30",
        practical: "",
        absent: "FALSE",
      },
    ]);
  });
  it("reads back the app's own files", () => {
    const file = toXlsx("Sheet", [
      ["roll", "name"],
      [1, "Karim"],
      [12, ""],
    ]);
    expect(readXlsx(file)).toEqual([["roll", "name"], ["1", "Karim"], ["12"]]);
  });
  it("refuses files that are not spreadsheets", () => {
    expect(() =>
      readXlsx(new TextEncoder().encode("name,roll\nA,1")),
    ).toThrow();
    expect(() => readXlsx(new Uint8Array(3 * 1024 * 1024))).toThrow(
      "too large",
    );
  });
});

describe("readXlsx against crafted files (review S1, S2)", () => {
  const enc = new TextEncoder();
  const book = (sheet: string) =>
    zipStore(
      Object.entries({
        "xl/workbook.xml":
          '<workbook><sheets><sheet name="A" r:id="rId1"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels":
          '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
        "xl/worksheets/sheet1.xml": sheet,
      }).map(([name, d]) => ({ name, data: enc.encode(d) })),
    );

  it("reads many unclosed tags in linear time", () => {
    const sheet = `<sheetData>${'<row r="1"><c t="inlineStr"><is><t>'.repeat(50_000)}</sheetData>`;
    const started = performance.now();
    expect(readXlsx(book(sheet))).toEqual([]);
    expect(performance.now() - started).toBeLessThan(1000);
  });
  it("does not pad millions of rows for a huge row number", () => {
    const sheet =
      '<sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>a</t></is></c></row>' +
      '<row r="999999999"><c r="A999999999"><v>1</v></c></row></sheetData>';
    expect(readXlsx(book(sheet))).toEqual([["a"]]);
  });
  it("tells <t> from similar tags and reads self-closing cells", () => {
    const sheet =
      '<sheetData><row r="1"><c r="A1" t="inlineStr"><is><r><t xml:space="preserve">x </t></r><r><t>y</t></r></is></c>' +
      '<c r="B1"/><c r="C1"><v>3</v></c></row></sheetData>';
    expect(readXlsx(book(sheet))).toEqual([["x y", "", "3"]]);
  });
});
