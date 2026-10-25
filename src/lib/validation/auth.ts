import { z } from "zod";

// Messages are dictionary keys (errors.*) so the UI shows them in the reader's language.

const BD_PHONE = /^01[3-9][0-9]{8}$/;

/** Normalises +8801XXXXXXXXX / 8801XXXXXXXXX / spaces and dashes to 01XXXXXXXXX. */
export function normalizePhone(value: string): string {
  const digits = value.replace(/[\s-]/g, "").replace(/^\+?880/, "0");
  return digits;
}

export function isBdPhone(value: string): boolean {
  return BD_PHONE.test(normalizePhone(value));
}

/** Student ID: year + 2-digit class + 4-digit serial, e.g. 2026060001. */
export function isStudentCode(value: string): boolean {
  return /^20[0-9]{2}(0[6-9]|10)[0-9]{4}$/.test(value.trim());
}

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "errors.required")
    .refine(
      (v) => z.email().safeParse(v).success || isBdPhone(v) || isStudentCode(v),
      "errors.emailOrPhone",
    ),
  password: z.string().min(1, "errors.required").max(200, "errors.tooLong"),
  next: z.string().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "errors.required")
    .pipe(z.email("errors.email")),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "errors.passwordShort")
      .max(72, "errors.tooLong")
      .regex(/[A-Za-z]/, "errors.passwordWeak")
      .regex(/[0-9]/, "errors.passwordWeak"),
    confirm: z.string().min(1, "errors.required"),
  })
  .refine((v) => v.password === v.confirm, {
    message: "errors.passwordMismatch",
    path: ["confirm"],
  });
export type NewPasswordInput = z.infer<typeof newPasswordSchema>;
