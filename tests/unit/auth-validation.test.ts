import { describe, expect, it } from "vitest";

import {
  forgotPasswordSchema,
  isBdPhone,
  loginSchema,
  newPasswordSchema,
  normalizePhone,
} from "@/lib/validation/auth";

const firstError = (r: {
  success: boolean;
  error?: { issues: { message: string }[] };
}) => r.error?.issues[0]?.message;

describe("phone helpers", () => {
  it("normalises country code, spaces and dashes", () => {
    expect(normalizePhone("+8801710000002")).toBe("01710000002");
    expect(normalizePhone("8801710000002")).toBe("01710000002");
    expect(normalizePhone("01710-000 002")).toBe("01710000002");
  });
  it("recognises Bangladesh mobile numbers", () => {
    expect(isBdPhone("01710000002")).toBe(true);
    expect(isBdPhone("+8801910000002")).toBe(true);
    expect(isBdPhone("01210000002")).toBe(false);
    expect(isBdPhone("0171000000")).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts an email or a mobile number", () => {
    expect(
      loginSchema.safeParse({ identifier: "admin@sunrise.test", password: "x" })
        .success,
    ).toBe(true);
    expect(
      loginSchema.safeParse({ identifier: "01710000002", password: "x" })
        .success,
    ).toBe(true);
  });
  it("rejects empty and malformed identifiers with translatable keys", () => {
    expect(
      firstError(loginSchema.safeParse({ identifier: "", password: "x" })),
    ).toBe("errors.required");
    expect(
      firstError(loginSchema.safeParse({ identifier: "rahim", password: "x" })),
    ).toBe("errors.emailOrPhone");
    expect(
      firstError(loginSchema.safeParse({ identifier: "0171", password: "x" })),
    ).toBe("errors.emailOrPhone");
  });
  it("requires a password", () => {
    expect(
      firstError(loginSchema.safeParse({ identifier: "a@b.co", password: "" })),
    ).toBe("errors.required");
  });
});

describe("forgotPasswordSchema", () => {
  it("needs a valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.co" }).success).toBe(
      true,
    );
    expect(firstError(forgotPasswordSchema.safeParse({ email: "" }))).toBe(
      "errors.required",
    );
    expect(firstError(forgotPasswordSchema.safeParse({ email: "nope" }))).toBe(
      "errors.email",
    );
  });
});

describe("newPasswordSchema", () => {
  it("accepts a strong matching password", () => {
    expect(
      newPasswordSchema.safeParse({
        password: "School2026",
        confirm: "School2026",
      }).success,
    ).toBe(true);
  });
  it.each([
    ["short", "abc123", "errors.passwordShort"],
    ["letters only", "abcdefghij", "errors.passwordWeak"],
    ["digits only", "1234567890", "errors.passwordWeak"],
  ])("rejects %s", (_, password, key) => {
    expect(
      firstError(newPasswordSchema.safeParse({ password, confirm: password })),
    ).toBe(key);
  });
  it("rejects a mismatch on the confirm field", () => {
    const r = newPasswordSchema.safeParse({
      password: "School2026",
      confirm: "School2027",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]).toMatchObject({
      message: "errors.passwordMismatch",
      path: ["confirm"],
    });
  });
});
