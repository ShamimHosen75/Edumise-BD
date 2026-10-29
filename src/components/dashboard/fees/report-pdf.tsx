import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

// English only (the built-in PDF fonts have no Bangla letters). Cells arrive as text.

export type ReportPdfData = {
  school: string;
  title: string;
  subtitle: string;
  tables: {
    caption: string;
    head: string[];
    right: boolean[];
    rows: string[][];
    foot: string[] | null;
  }[];
};

const s = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: "#111827",
  },
  school: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "center" },
  title: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginTop: 4,
  },
  subtitle: {
    fontSize: 9,
    textAlign: "center",
    color: "#4b5563",
    marginTop: 2,
  },
  caption: { fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 4 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#9ca3af" },
  bold: { fontFamily: "Helvetica-Bold", backgroundColor: "#f3f4f6" },
  cell: { padding: 3, flex: 1 },
});

export function ReportPdf({ data: d }: { data: ReportPdfData }) {
  return (
    <Document title={d.title}>
      <Page size="A4" style={s.page}>
        <Text style={s.school}>{d.school}</Text>
        <Text style={s.title}>{d.title}</Text>
        <Text style={s.subtitle}>{d.subtitle}</Text>
        {d.tables.map((t, n) => (
          <View key={n}>
            <Text style={s.caption}>{t.caption}</Text>
            {[t.head, ...t.rows, ...(t.foot ? [t.foot] : [])].map(
              (r, i, all) => (
                <View
                  key={i}
                  style={[
                    s.row,
                    ...(i === 0 || (t.foot && i === all.length - 1)
                      ? [s.bold]
                      : []),
                  ]}
                  wrap={false}
                >
                  {r.map((v, j) => (
                    <Text
                      key={j}
                      style={[
                        s.cell,
                        { textAlign: t.right[j] ? "right" : "left" },
                      ]}
                    >
                      {v}
                    </Text>
                  ))}
                </View>
              ),
            )}
            {t.rows.length ? null : <Text>-</Text>}
          </View>
        ))}
      </Page>
    </Document>
  );
}
