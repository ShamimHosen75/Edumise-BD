import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { readXlsx, xlsxRecords } from "@/lib/xlsx-read";
import { toXlsx } from "@/lib/xlsx";

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
