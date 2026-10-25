import "server-only";

import { tempPassword } from "@/lib/auth/temp-password";
import { createAdminClient } from "@/lib/supabase/admin";

// Logins for guardians and students. Their account emails are placeholders under the
// reserved .invalid domain (never delivered): guardians log in with their mobile number,
// students with their student ID. Creating accounts needs the service role, so every
// caller checks that the user is an admin first. One-time password, must change.

export type GuardianLogin =
  | { status: "created"; phone: string; password: string }
  | { status: "exists"; phone: string }
  | { status: "failed" };
export type StudentLogin =
  | { status: "created"; code: string; password: string }
  | { status: "exists"; code: string }
  | { status: "failed" };

/** Placeholder email of a student login; signIn derives it from the student ID. */
export const studentEmail = (code: string) => `student-${code}@student.invalid`;

type Profile = {
  role: "guardian" | "student";
  phone: string | null;
  full_name_en: string;
  full_name_bn: string;
};

/** Creates the auth user and its profile; returns the new id, or null on failure. */
async function createAccount(email: string, password: string, p: Profile) {
  const service = createAdminClient();
  const { data: created, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !created.user) return null;
  // Supabase stores app_metadata after the profile trigger has run, so the role and
  // names are set on the profile here (the service role may; nobody else can).
  const { error: profileError } = await service
    .from("profiles")
    .update({ ...p, must_change_password: true, is_active: true })
    .eq("id", created.user.id);
  if (profileError) {
    await service.auth.admin.deleteUser(created.user.id);
    return null;
  }
  return created.user.id;
}

export async function createGuardianLogin(
  guardianId: number,
): Promise<GuardianLogin> {
  const service = createAdminClient();
  const { data: guardian } = await service
    .from("guardians")
    .select("id, profile_id, phone, full_name_en, full_name_bn")
    .eq("id", guardianId)
    .maybeSingle();
  if (!guardian) return { status: "failed" };
  if (guardian.profile_id) return { status: "exists", phone: guardian.phone };
  const { data: taken } = await service
    .from("profiles")
    .select("id, role")
    .eq("phone", guardian.phone)
    .maybeSingle();
  if (taken) {
    // Same mobile already logs in as a guardian (e.g. a brother's father record): reuse it.
    if (taken.role !== "guardian") return { status: "failed" };
    await service
      .from("guardians")
      .update({ profile_id: taken.id })
      .eq("id", guardian.id);
    return { status: "exists", phone: guardian.phone };
  }
  const password = tempPassword();
  const id = await createAccount(
    `guardian-${guardian.phone}@guardian.invalid`,
    password,
    {
      role: "guardian",
      phone: guardian.phone,
      full_name_en: guardian.full_name_en,
      full_name_bn: guardian.full_name_bn,
    },
  );
  if (!id) return { status: "failed" };
  const { error } = await service
    .from("guardians")
    .update({ profile_id: id })
    .eq("id", guardian.id)
    .is("profile_id", null);
  if (error) {
    await service.auth.admin.deleteUser(id);
    return { status: "failed" };
  }
  return { status: "created", phone: guardian.phone, password };
}

export async function createStudentLogin(
  studentId: number,
): Promise<StudentLogin> {
  const service = createAdminClient();
  const { data: student } = await service
    .from("students")
    .select("id, profile_id, student_code, full_name_en, full_name_bn")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return { status: "failed" };
  if (student.profile_id)
    return { status: "exists", code: student.student_code };
  const password = tempPassword();
  const id = await createAccount(studentEmail(student.student_code), password, {
    role: "student",
    phone: null,
    full_name_en: student.full_name_en,
    full_name_bn: student.full_name_bn,
  });
  if (!id) return { status: "failed" };
  const { error } = await service
    .from("students")
    .update({ profile_id: id })
    .eq("id", student.id)
    .is("profile_id", null);
  if (error) {
    await service.auth.admin.deleteUser(id);
    return { status: "failed" };
  }
  return { status: "created", code: student.student_code, password };
}

/** New one-time password for a guardian or student login (never staff or admins). */
export async function resetFamilyPassword(
  profileId: string,
): Promise<string | null> {
  const service = createAdminClient();
  const { data: profile } = await service
    .from("profiles")
    .select("role")
    .eq("id", profileId)
    .maybeSingle();
  if (profile?.role !== "guardian" && profile?.role !== "student") return null;
  const password = tempPassword();
  const { error } = await service.auth.admin.updateUserById(profileId, {
    password,
  });
  if (error) return null;
  await service
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", profileId);
  return password;
}
