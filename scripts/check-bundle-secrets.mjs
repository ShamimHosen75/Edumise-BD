// Fails when a server secret could reach the browser (Step 6.2, NFR-01). Scans the
// client bundles in .next/static for secret names, the service-role JWT marker and any
// secret value found in .env.local. Run after `npm run build`.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = ".next/static";
if (!existsSync(ROOT)) {
  console.error("No build found: run `npm run build` first.");
  process.exit(2);
}

const needles = new Map([
  ["SUPABASE_SERVICE_ROLE_KEY", "secret name"],
  ["PAYMENT_SANDBOX_SECRET", "secret name"],
  ["ADMISSION_TOKEN_SECRET", "secret name"],
  // {"role":"service_role"} inside a JWT, base64url-encoded.
  ["c2VydmljZV9yb2xl", "service-role JWT"],
  ["sb_secret_", "Supabase secret key"],
]);
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = /^([A-Z_]+)=["']?([^"'\n]+)["']?$/.exec(line.trim());
    if (m && !m[1].startsWith("NEXT_PUBLIC_") && m[2].length >= 16)
      needles.set(m[2], `value of ${m[1]}`);
  }
}

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|mjs|json|txt|css|html)$/.test(name)) files.push(p);
  }
})(ROOT);

const found = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const [needle, what] of needles)
    if (text.includes(needle)) found.push(`${file}: ${what}`);
}
if (found.length) {
  console.error(`Secrets in client bundles:\n${found.join("\n")}`);
  process.exit(1);
}
console.warn(
  `No secrets in ${files.length} client files (${needles.size} checks).`,
);
