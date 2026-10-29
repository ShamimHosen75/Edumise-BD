import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { Dictionary } from "@/i18n/get-dictionary";
import type { MarkSheet } from "@/lib/results-data";

/** Labels from the English dictionary (results.*, plus the student ID label). */
export type PdfLabels = Dictionary["results"] & { studentId: string };

// English only: the built-in PDF fonts have no Bangla letters (see the ID card). Bangla
// mark sheets are printed from the web page.

export type PdfSheet = MarkSheet & {
  studentCode: string;
  photo: { data: Buffer; format: "jpg" | "png" } | null;
};

const s = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica", fontSize: 9, color: "#111827" },
  school: { fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "center" },
  address: { fontSize: 8, textAlign: "center", color: "#4b5563", marginTop: 2 },
  title: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 10,
  },
  info: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  field: { flexDirection: "row", marginBottom: 2 },
  label: { width: 70, color: "#4b5563" },
  photo: { width: 64, height: 78, borderWidth: 1, borderColor: "#d1d5db" },
  table: { borderWidth: 0.5, borderColor: "#9ca3af" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#9ca3af" },
  head: { backgroundColor: "#f3f4f6", fontFamily: "Helvetica-Bold" },
  cell: { padding: 3, textAlign: "center", width: 48 },
  subject: { padding: 3, flexGrow: 1 },
  fail: { color: "#b91c1c" },
  summary: { flexDirection: "row", flexWrap: "wrap", marginTop: 10, gap: 6 },
  box: { borderWidth: 0.5, borderColor: "#9ca3af", padding: 4, width: "23.5%" },
  boxLabel: { fontSize: 7, color: "#4b5563" },
  boxValue: { fontFamily: "Helvetica-Bold", marginTop: 1 },
  signs: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 48,
  },
  sign: {
    width: 140,
    borderTopWidth: 0.5,
    borderColor: "#4b5563",
    paddingTop: 3,
    textAlign: "center",
    fontSize: 8,
  },
});

const num = (v: number | null) => (v === null ? "-" : String(v));
const gp = (v: number) => v.toFixed(2);

function Sheet({
  sheet,
  school,
  t,
}: {
  sheet: PdfSheet;
  school: Header;
  t: PdfLabels;
}) {
  const facts: [string, string][] = [
    [t.name, sheet.name_en],
    [t.studentId, sheet.studentCode],
    [t.class, sheet.class_en],
    [t.section, sheet.section_en],
    ...(sheet.group_en ? [[t.group, sheet.group_en] as [string, string]] : []),
    [t.roll, String(sheet.roll)],
    [t.session, sheet.session],
  ];
  const summary: [string, string][] = [
    [
      t.total,
      t.totalOf
        .replace("{total}", String(sheet.total))
        .replace("{full}", String(sheet.full_total)),
    ],
    [t.gpa, gp(sheet.gpa)],
    [t.gpaWithoutFourth, gp(sheet.gpa_without_fourth)],
    [t.grade, sheet.grade],
    [t.result, sheet.passed ? t.pass : t.fail],
    [t.sectionPosition, String(sheet.section_position)],
    [t.classPosition, String(sheet.class_position)],
    [
      t.attendance,
      sheet.attendance_percent === null ? "-" : `${sheet.attendance_percent}%`,
    ],
  ];
  return (
    <Page size="A4" style={s.page}>
      <Text style={s.school}>{school.name}</Text>
      {school.address ? <Text style={s.address}>{school.address}</Text> : null}
      <Text style={s.title}>
        {t.markSheet}: {sheet.exam_en}
      </Text>
      <View style={s.info}>
        <View>
          {facts.map(([k, v]) => (
            <View key={k} style={s.field}>
              <Text style={s.label}>{k}</Text>
              <Text>{v}</Text>
            </View>
          ))}
        </View>
        {sheet.photo ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- PDF image, not HTML
          <Image
            style={s.photo}
            src={{ data: sheet.photo.data, format: sheet.photo.format }}
          />
        ) : null}
      </View>
      <View style={s.table}>
        <View style={[s.row, s.head]}>
          <Text style={s.subject}>{t.subject}</Text>
          {[
            t.fullMarks,
            t.cq,
            t.mcq,
            t.practical,
            t.obtained,
            t.grade,
            t.point,
          ].map((h) => (
            <Text key={h} style={s.cell}>
              {h}
            </Text>
          ))}
        </View>
        {sheet.subjects.flatMap((sub) =>
          sub.papers.map((p, i) => (
            <View
              key={`${sub.key}-${i}`}
              style={sub.failed ? [s.row, s.fail] : s.row}
              wrap={false}
            >
              <Text style={s.subject}>
                {p.name_en}
                {i === 0 && sub.role === "fourth" ? ` (${t.fourth})` : ""}
                {i === 0 && sub.role === "extra" ? ` (${t.extra})` : ""}
              </Text>
              <Text style={s.cell}>{p.full}</Text>
              <Text style={s.cell}>{p.absent ? t.absent : num(p.cq)}</Text>
              <Text style={s.cell}>{p.absent ? "" : num(p.mcq)}</Text>
              <Text style={s.cell}>{p.absent ? "" : num(p.practical)}</Text>
              <Text style={s.cell}>{i === 0 ? String(sub.obtained) : ""}</Text>
              <Text style={s.cell}>{i === 0 ? sub.grade : ""}</Text>
              <Text style={s.cell}>{i === 0 ? gp(sub.point) : ""}</Text>
            </View>
          )),
        )}
      </View>
      <View style={s.summary}>
        {summary.map(([k, v]) => (
          <View key={k} style={s.box}>
            <Text style={s.boxLabel}>{k}</Text>
            <Text style={s.boxValue}>{v}</Text>
          </View>
        ))}
      </View>
      <View style={s.signs}>
        {[t.guardianSign, t.classTeacher, t.headTeacher].map((who) => (
          <Text key={who} style={s.sign}>
            {who}
          </Text>
        ))}
      </View>
    </Page>
  );
}

type Header = { name: string; address: string };

/** One A4 page per student. */
export function MarkSheetsPdf({
  sheets,
  school,
  t,
}: {
  sheets: PdfSheet[];
  school: Header;
  t: PdfLabels;
}) {
  return (
    <Document title={t.markSheet} author={school.name}>
      {sheets.map((sheet) => (
        <Sheet key={sheet.studentCode} sheet={sheet} school={school} t={t} />
      ))}
    </Document>
  );
}
