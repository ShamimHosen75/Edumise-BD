// Generates the placeholder photos used by the demo school (public/demo/*.jpg).
// Real schools upload their own photos to Supabase Storage instead.
// Run: node scripts/generate-demo-images.mjs
import sharp from "sharp";

const scenes = [
  {
    file: "slider-1.jpg",
    w: 1600,
    h: 640,
    from: "#0f766e",
    to: "#134e4a",
    shape: "campus",
  },
  {
    file: "slider-2.jpg",
    w: 1600,
    h: 640,
    from: "#1d4ed8",
    to: "#0f172a",
    shape: "field",
  },
  {
    file: "slider-3.jpg",
    w: 1600,
    h: 640,
    from: "#b45309",
    to: "#7c2d12",
    shape: "books",
  },
  {
    file: "gallery-1.jpg",
    w: 800,
    h: 600,
    from: "#15803d",
    to: "#14532d",
    shape: "flag",
  },
  {
    file: "gallery-2.jpg",
    w: 800,
    h: 600,
    from: "#7c3aed",
    to: "#3b0764",
    shape: "stage",
  },
  {
    file: "gallery-3.jpg",
    w: 800,
    h: 600,
    from: "#0369a1",
    to: "#082f49",
    shape: "field",
  },
  {
    file: "gallery-4.jpg",
    w: 800,
    h: 600,
    from: "#be123c",
    to: "#4c0519",
    shape: "books",
  },
  {
    file: "head-teacher.jpg",
    w: 400,
    h: 400,
    from: "#cbd5e1",
    to: "#64748b",
    shape: "person",
  },
];

function shapes(kind, w, h) {
  const g = h * 0.72;
  switch (kind) {
    case "campus":
      return `<rect x="${w * 0.25}" y="${h * 0.35}" width="${w * 0.5}" height="${h * 0.4}" fill="#f8fafc" opacity=".9"/>
        <polygon points="${w * 0.22},${h * 0.36} ${w * 0.5},${h * 0.16} ${w * 0.78},${h * 0.36}" fill="#e2e8f0"/>
        ${[0, 1, 2, 3, 4].map((i) => `<rect x="${w * (0.3 + i * 0.09)}" y="${h * 0.45}" width="${w * 0.05}" height="${h * 0.1}" fill="#0f766e" opacity=".7"/>`).join("")}
        <rect x="${w * 0.47}" y="${h * 0.6}" width="${w * 0.06}" height="${h * 0.15}" fill="#334155"/>`;
    case "field":
      return `<rect y="${g}" width="${w}" height="${h - g}" fill="#16a34a"/>
        <circle cx="${w * 0.8}" cy="${h * 0.25}" r="${h * 0.1}" fill="#fde68a"/>
        <rect x="${w * 0.1}" y="${g - h * 0.25}" width="${w * 0.02}" height="${h * 0.25}" fill="#f8fafc"/>
        <rect x="${w * 0.88}" y="${g - h * 0.25}" width="${w * 0.02}" height="${h * 0.25}" fill="#f8fafc"/>`;
    case "books":
      return [0, 1, 2, 3, 4, 5]
        .map(
          (i) =>
            `<rect x="${w * (0.2 + i * 0.1)}" y="${h * (0.3 + (i % 3) * 0.05)}" width="${w * 0.07}" height="${h * (0.5 - (i % 3) * 0.05)}" rx="6" fill="${["#fef3c7", "#e0f2fe", "#fce7f3", "#dcfce7", "#ede9fe", "#fee2e2"][i]}"/>`,
        )
        .join("");
    case "flag":
      return `<rect x="${w * 0.3}" y="${h * 0.15}" width="${w * 0.015}" height="${h * 0.7}" fill="#e2e8f0"/>
        <rect x="${w * 0.315}" y="${h * 0.15}" width="${w * 0.4}" height="${h * 0.26}" fill="#006a4e"/>
        <circle cx="${w * 0.49}" cy="${h * 0.28}" r="${h * 0.075}" fill="#f42a41"/>`;
    case "stage":
      return `<rect y="${h * 0.65}" width="${w}" height="${h * 0.35}" fill="#1e293b"/>
        ${[0.25, 0.5, 0.75].map((x) => `<circle cx="${w * x}" cy="${h * 0.5}" r="${h * 0.08}" fill="#fde68a"/><rect x="${w * x - h * 0.06}" y="${h * 0.58}" width="${h * 0.12}" height="${h * 0.12}" rx="10" fill="#f8fafc"/>`).join("")}`;
    default:
      return `<circle cx="${w / 2}" cy="${h * 0.4}" r="${h * 0.18}" fill="#f1f5f9"/>
        <rect x="${w * 0.22}" y="${h * 0.62}" width="${w * 0.56}" height="${h * 0.5}" rx="${w * 0.25}" fill="#f1f5f9"/>`;
  }
}

for (const s of scenes) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s.w}" height="${s.h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${s.from}"/><stop offset="1" stop-color="${s.to}"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>${shapes(s.shape, s.w, s.h)}</svg>`;
  await sharp(Buffer.from(svg))
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(`public/demo/${s.file}`);
}
// eslint-disable-next-line no-console -- command-line script
console.log(`Wrote ${scenes.length} images to public/demo/`);

// A tiny valid one-page PDF for demo notices and downloads.
import { writeFileSync } from "node:fs";

function demoPdf(title) {
  const text = `BT /F1 24 Tf 72 720 Td (${title}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((o, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets
    .map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)
    .join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return body;
}
writeFileSync(
  "public/demo/notice-sample.pdf",
  demoPdf("Sunrise High School - Notice"),
);
writeFileSync(
  "public/demo/calendar-2026.pdf",
  demoPdf("Sunrise High School - Academic calendar 2026"),
);
// eslint-disable-next-line no-console -- command-line script
console.log("Wrote 2 demo PDFs to public/demo/");
