import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Password123!";

export const USERS = [
  {
    role: "super_admin",
    email: "superadmin@sunrise.test",
    home: "/en/dashboard/super-admin",
  },
  {
    role: "admin",
    email: "admin@sunrise.test",
    home: "/en/dashboard/admin",
    phone: "01710000002",
  },
  {
    role: "teacher",
    email: "teacher@sunrise.test",
    home: "/en/dashboard/teacher",
  },
  {
    role: "accountant",
    email: "accountant@sunrise.test",
    home: "/en/dashboard/accountant",
  },
  {
    role: "student",
    email: "student@sunrise.test",
    home: "/en/dashboard/student",
  },
  {
    role: "guardian",
    email: "guardian@sunrise.test",
    home: "/en/dashboard/guardian",
  },
] as const;

export async function login(
  page: Page,
  identifier: string,
  password = PASSWORD,
  lang = "en",
) {
  await page.goto(`/${lang}/login`);
  await page
    .getByLabel(
      lang === "en" ? "Email or mobile number" : "ইমেইল বা মোবাইল নম্বর",
    )
    .fill(identifier);
  await page
    .getByLabel(lang === "en" ? "Password" : "পাসওয়ার্ড", { exact: true })
    .fill(password);
  await page
    .getByRole("button", { name: lang === "en" ? "Log in" : "লগইন করুন" })
    .click();
}

/** Logs in and waits until the dashboard (or forced password page) has loaded. */
export async function loginAs(
  page: Page,
  identifier: string,
  password = PASSWORD,
) {
  await login(page, identifier, password);
  await expect(page).toHaveURL(/\/en\/(dashboard\/[a-z-]+|change-password)$/);
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/en\/login$/);
}

/** Service-role client for test setup only (never used by the app in the browser). */
export function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

/** Creates a throwaway login for one test and returns a cleanup function. */
export async function createTempUser(opts: {
  role: string | null;
  mustChangePassword: boolean;
  tag: string;
}) {
  const email = `e2e-${opts.tag}-${Date.now()}-${Math.round(Math.random() * 1e6)}@sunrise.test`;
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: { full_name_en: "Test User" },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  // Server code that creates accounts sets the role on the profile directly.
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      role: opts.role,
      must_change_password: opts.mustChangePassword,
      full_name_en: "Test User",
    })
    .eq("id", data.user.id);
  if (profileError) throw profileError;
  return {
    email,
    cleanup: async () => void (await admin.auth.admin.deleteUser(data.user.id)),
  };
}

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

/** Waits for the newest email to an address in the local Mailpit inbox and returns its text. */
export async function latestEmailText(to: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
    );
    const body = (await res.json()) as { messages?: { ID: string }[] };
    const id = body.messages?.[0]?.ID;
    if (id) {
      const msg = (await (
        await fetch(`${MAILPIT}/api/v1/message/${id}`)
      ).json()) as { Text: string; HTML: string };
      return msg.Text || msg.HTML;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email arrived for ${to}`);
}

/** 1x1 transparent PNG. */
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/**
 * Deletes an online application made by a test (found by its guardian mobile), with the
 * student, guardians and guardian login its approval created, and its uploaded files.
 */
export async function cleanupApplication(phone: string) {
  const admin = adminClient();
  const { data: apps } = await admin
    .from("admission_applications")
    .select("id, student_id, photo_path, admission_documents(file_path)")
    .eq("guardian_phone", phone);
  for (const app of apps ?? []) {
    const files = [
      app.photo_path,
      ...((app.admission_documents ?? []) as { file_path: string }[]).map(
        (x) => x.file_path,
      ),
    ].filter((f): f is string => Boolean(f));
    if (app.student_id) {
      const { data: links } = await admin
        .from("student_guardians")
        .select("guardian_id")
        .eq("student_id", app.student_id);
      const guardianIds = (links ?? []).map((l) => l.guardian_id);
      const { data: guardians } = guardianIds.length
        ? await admin
            .from("guardians")
            .select("id, profile_id")
            .in("id", guardianIds)
        : { data: [] };
      // Enrolments, guardian links and attendance go with the student (cascade).
      await admin.from("students").delete().eq("id", app.student_id);
      if (guardianIds.length)
        await admin.from("guardians").delete().in("id", guardianIds);
      for (const g of guardians ?? [])
        if (g.profile_id) await admin.auth.admin.deleteUser(g.profile_id);
    }
    await admin.from("admission_applications").delete().eq("id", app.id);
    if (files.length) await admin.storage.from("private-docs").remove(files);
  }
}
