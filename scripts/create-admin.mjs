// Creates the first super admin of a new deployment (Step 6.4, docs/deploy.md).
//
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/create-admin.mjs --email admin@school.edu.bd --name "Head Teacher" \
//     [--name-bn "প্রধান শিক্ষক"] [--phone 017XXXXXXXX] [--role super_admin|admin]
//
// Prints a one-time password; the person must change it at first sign-in. Run it from a
// trusted machine only: the service-role key bypasses every access rule. Nothing else in
// the app can create a super admin.
import { randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function fail(message) {
  console.error(message);
  process.exit(1);
}

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = arg("email");
const name = arg("name");
const nameBn = arg("name-bn", "");
const phone = arg("phone", "");
const role = arg("role", "super_admin");

if (!url || !key) fail("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Give --email.");
if (!name) fail("Give --name (the person's name in English).");
if (!["super_admin", "admin"].includes(role))
  fail("--role is super_admin or admin.");
if (phone && !/^01[3-9]\d{8}$/.test(phone))
  fail("--phone must be 01XXXXXXXXX.");

// 12 characters from an unambiguous alphabet (no 0/O, 1/l): typed from paper.
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const password = Array.from(
  randomBytes(12),
  (b) => alphabet[b % alphabet.length],
).join("");

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// The profile trigger reads the role and names from app_metadata (handle_new_user).
const { data, error } = await db.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  phone: undefined,
  app_metadata: {
    app_role: role,
    phone: phone || null,
    full_name_en: name,
    full_name_bn: nameBn,
  },
});
if (error || !data.user)
  fail(`Could not create the login: ${error?.message ?? "unknown error"}`);

const { error: profileError } = await db
  .from("profiles")
  .update({
    role,
    full_name_en: name,
    full_name_bn: nameBn,
    phone: phone || null,
    must_change_password: true,
    is_active: true,
  })
  .eq("id", data.user.id);
if (profileError) {
  await db.auth.admin.deleteUser(data.user.id);
  fail(`Could not set up the profile: ${profileError.message}`);
}

console.warn(`Created ${role} ${email} (${name}).`);
console.warn(`One-time password: ${password}`);
console.warn("They must change it at first sign-in. Do not keep this output.");
