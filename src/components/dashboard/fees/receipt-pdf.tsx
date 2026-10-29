import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

// English only: the built-in PDF fonts have no Bangla letters. The Bangla receipt
// (with the amount in Bangla words) is printed from the web page.

export type ReceiptPdfData = {
  school: string;
  address: string;
  title: string;
  facts: [string, string][];
  head: [string, string, string, string];
  lines: [string, string, string, string][];
  total: [string, string];
  due: [string, string];
  words: string;
  cancelled: string | null;
  signature: string;
  qr: string;
};

const s = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#111827",
  },
  school: { fontSize: 16, fontFamily: "Helvetica-Bold", textAlign: "center" },
  address: { fontSize: 9, textAlign: "center", color: "#4b5563", marginTop: 3 },
  title: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginTop: 12,
  },
  cancelled: {
    marginTop: 10,
    padding: 5,
    borderWidth: 1.5,
    borderColor: "#b91c1c",
    color: "#b91c1c",
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
  },
  top: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  fact: { flexDirection: "row", marginBottom: 3 },
  key: { width: 90, color: "#4b5563" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#9ca3af" },
  th: { fontFamily: "Helvetica-Bold", backgroundColor: "#f3f4f6" },
  cell: { padding: 4, flex: 2 },
  money: { padding: 4, flex: 1, textAlign: "right" },
  table: { marginTop: 14, borderTopWidth: 0.5, borderColor: "#9ca3af" },
  words: { marginTop: 10 },
  sign: {
    marginTop: 48,
    alignSelf: "flex-end",
    borderTopWidth: 0.5,
    paddingTop: 3,
    paddingHorizontal: 20,
  },
});

export function ReceiptPdf({ data: d }: { data: ReceiptPdfData }) {
  return (
    <Document title={d.title}>
      <Page size="A5" orientation="landscape" style={s.page}>
        <Text style={s.school}>{d.school}</Text>
        {d.address ? <Text style={s.address}>{d.address}</Text> : null}
        <Text style={s.title}>{d.title}</Text>
        {d.cancelled ? <Text style={s.cancelled}>{d.cancelled}</Text> : null}
        <View style={s.top}>
          <View>
            {d.facts.map(([k, v]) => (
              <View key={k} style={s.fact}>
                <Text style={s.key}>{k}</Text>
                <Text>{v}</Text>
              </View>
            ))}
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
          <Image src={d.qr} style={{ width: 70, height: 70 }} />
        </View>
        <View style={s.table}>
          <View style={[s.row, s.th]}>
            <Text style={s.cell}>{d.head[0]}</Text>
            <Text style={s.cell}>{d.head[1]}</Text>
            <Text style={s.cell}>{d.head[2]}</Text>
            <Text style={s.money}>{d.head[3]}</Text>
          </View>
          {d.lines.map((l, n) => (
            <View key={n} style={s.row}>
              <Text style={s.cell}>{l[0]}</Text>
              <Text style={s.cell}>{l[1]}</Text>
              <Text style={s.cell}>{l[2]}</Text>
              <Text style={s.money}>{l[3]}</Text>
            </View>
          ))}
          <View style={[s.row, s.th]}>
            <Text style={{ ...s.cell, flex: 6 }}>{d.total[0]}</Text>
            <Text style={s.money}>{d.total[1]}</Text>
          </View>
          <View style={s.row}>
            <Text style={{ ...s.cell, flex: 6 }}>{d.due[0]}</Text>
            <Text style={s.money}>{d.due[1]}</Text>
          </View>
        </View>
        <Text style={s.words}>{d.words}</Text>
        <Text style={s.sign}>{d.signature}</Text>
      </Page>
    </Document>
  );
}
