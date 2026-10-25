import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

// The built-in PDF fonts have no Bangla letters (and react-pdf cannot shape Bangla
// script), so the card is in English.

/** Card size CR80 (85.6 mm x 54 mm), in points. */
const SIZE = { width: 242.65, height: 153.07 };

export type IdCardData = {
  school: string;
  schoolAddress: string;
  schoolPhone: string;
  color: string;
  name: string;
  code: string;
  className: string;
  section: string;
  roll: string;
  session: string;
  bloodGroup: string;
  photo: { data: Buffer; format: "jpg" | "png" } | null;
  qr: string;
};

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 7, color: "#111827" },
  band: { paddingVertical: 5, paddingHorizontal: 8, color: "#ffffff" },
  school: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  sub: { fontSize: 6 },
  body: { flexDirection: "row", padding: 8, gap: 8 },
  photo: { width: 54, height: 66, borderWidth: 1, borderColor: "#d1d5db" },
  noPhoto: { backgroundColor: "#f3f4f6" },
  name: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  row: { flexDirection: "row", marginBottom: 1.5 },
  label: { width: 42, color: "#6b7280" },
  qr: { width: 46, height: 46, marginLeft: "auto" },
  back: { padding: 10, gap: 5, fontSize: 7 },
  title: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  sign: {
    marginTop: "auto",
    borderTopWidth: 0.5,
    borderTopColor: "#6b7280",
    width: 90,
    paddingTop: 2,
    alignSelf: "flex-end",
    textAlign: "center",
  },
});

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text>{value || "-"}</Text>
    </View>
  );
}

/** Student ID card, front and back. */
export function IdCardPdf({ card }: { card: IdCardData }) {
  return (
    <Document title={`ID card ${card.code}`} author={card.school}>
      <Page size={SIZE} style={s.page}>
        <View style={[s.band, { backgroundColor: card.color }]}>
          <Text style={s.school}>{card.school}</Text>
          <Text style={s.sub}>STUDENT ID CARD</Text>
        </View>
        <View style={s.body}>
          {card.photo ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- PDF image, not HTML
            <Image style={s.photo} src={card.photo} />
          ) : (
            <View style={[s.photo, s.noPhoto]} />
          )}
          <View style={{ flexGrow: 1 }}>
            <Text style={s.name}>{card.name}</Text>
            <Field label="Student ID" value={card.code} />
            <Field label="Class" value={card.className} />
            <Field label="Section" value={card.section} />
            <Field label="Roll" value={card.roll} />
            <Field label="Session" value={card.session} />
            <Field label="Blood group" value={card.bloodGroup} />
          </View>
        </View>
      </Page>
      <Page size={SIZE} style={[s.page, s.back]}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flexGrow: 1, flexShrink: 1, gap: 4 }}>
            <Text style={s.title}>{card.school}</Text>
            <Text>{card.schoolAddress}</Text>
            {card.schoolPhone ? <Text>Phone: {card.schoolPhone}</Text> : null}
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- PDF image, not HTML */}
          <Image style={s.qr} src={card.qr} />
        </View>
        <Text>
          This card belongs to the school. If found, please return it to the
          school office.
        </Text>
        <Text style={s.sign}>Head teacher</Text>
      </Page>
    </Document>
  );
}
