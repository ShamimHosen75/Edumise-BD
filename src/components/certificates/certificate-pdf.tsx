import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

// English only: the built-in PDF fonts have no Bangla letters (as for the ID card and
// mark sheets). The Bangla certificate is printed from the web page.

export type CertificatePdfData = {
  school: string;
  address: string;
  title: string;
  reference: string;
  date: string;
  body: string;
  revoked: string | null;
  qr: string;
  verifyText: string;
};

const s = StyleSheet.create({
  page: {
    padding: 56,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: "#111827",
  },
  school: { fontSize: 18, fontFamily: "Helvetica-Bold", textAlign: "center" },
  address: { fontSize: 9, textAlign: "center", color: "#4b5563", marginTop: 3 },
  title: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginTop: 28,
    textDecoration: "underline",
  },
  meta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 28,
    fontSize: 10,
  },
  body: { marginTop: 28, lineHeight: 1.9, textAlign: "justify" },
  revoked: {
    marginBottom: 12,
    padding: 6,
    borderWidth: 1.5,
    borderColor: "#b91c1c",
    color: "#b91c1c",
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
  },
  foot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 72,
  },
  qrBox: { flexDirection: "row", alignItems: "flex-end", gap: 8, width: 260 },
  qr: { width: 72, height: 72 },
  small: { fontSize: 7.5, color: "#4b5563" },
  sign: {
    width: 150,
    borderTopWidth: 0.75,
    borderColor: "#4b5563",
    paddingTop: 3,
    textAlign: "center",
    fontSize: 10,
  },
});

export function CertificatePdf({ data }: { data: CertificatePdfData }) {
  return (
    <Document title={`${data.title} ${data.reference}`} author={data.school}>
      <Page size="A4" style={s.page}>
        {data.revoked ? <Text style={s.revoked}>{data.revoked}</Text> : null}
        <Text style={s.school}>{data.school}</Text>
        {data.address ? <Text style={s.address}>{data.address}</Text> : null}
        <Text style={s.title}>{data.title}</Text>
        <View style={s.meta}>
          <Text>Reference: {data.reference}</Text>
          <Text>Date: {data.date}</Text>
        </View>
        <Text style={s.body}>{data.body}</Text>
        <View style={s.foot}>
          <View style={s.qrBox}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- PDF image, not HTML */}
            <Image style={s.qr} src={data.qr} />
            <Text style={s.small}>{data.verifyText}</Text>
          </View>
          <Text style={s.sign}>Head teacher</Text>
        </View>
      </Page>
    </Document>
  );
}
