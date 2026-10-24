import { expect, test } from "@playwright/test";

import {
  createTempUser,
  latestEmailText,
  login,
  loginAs,
  logout,
  PASSWORD,
  USERS,
} from "./helpers";

test.describe("each seeded role", () => {
  for (const [i, user] of USERS.entries()) {
    const other = USERS[(i + 1) % USERS.length]!;
    test(`${user.role} logs in, lands on own dashboard and is blocked from ${other.role}'s page`, async ({
      page,
    }) => {
      // The admin logs in with a mobile number; everyone else with email.
      await login(page, "phone" in user ? user.phone : user.email);
      await expect(page).toHaveURL(new RegExp(`${user.home}$`));
      await expect(page.getByTestId(`home-${user.role}`)).toBeVisible();

      const response = await page.goto(other.home);
      expect(response?.status()).toBe(403);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "You do not have access to this page",
      );

      await page.goto(user.home);
      await logout(page);
    });
  }
});

test("a wrong password shows an error and stays on the login page", async ({
  page,
}) => {
  await login(page, "teacher@sunrise.test", "WrongPassword1");
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText(
    "Wrong email, mobile number or password.",
  );
  await expect(page).toHaveURL(/\/en\/login$/);
});

test("an unknown phone number gets the same error (accounts cannot be probed)", async ({
  page,
}) => {
  await login(page, "01799999999");
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText(
    "Wrong email, mobile number or password.",
  );
});

test("empty and malformed input show validation errors in both languages", async ({
  page,
}) => {
  await page.goto("/en/login");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("This field is required.").first()).toBeVisible();
  await page.getByLabel("Email or mobile number").fill("rahim");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(
    page.getByText(
      "Enter an email or an 11-digit mobile number (01XXXXXXXXX).",
    ),
  ).toBeVisible();

  await page.goto("/bn/login");
  await page.getByRole("button", { name: "লগইন করুন" }).click();
  await expect(
    page.getByText("এই ঘরটি পূরণ করা আবশ্যক।").first(),
  ).toBeVisible();
});

test("protected pages redirect to login when logged out, then return after login", async ({
  page,
}) => {
  await page.goto("/en/dashboard/settings");
  await expect(page).toHaveURL(
    /\/en\/login\?next=%2Fen%2Fdashboard%2Fsettings$/,
  );
  await page.getByLabel("Email or mobile number").fill("admin@sunrise.test");
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard\/settings$/);
});

test("a crafted next= link cannot send users to another site", async ({
  page,
}) => {
  await page.goto("/en/login?next=https://evil.test/en/dashboard");
  await page.getByLabel("Email or mobile number").fill("teacher@sunrise.test");
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard\/teacher$/);
});

test("after logout the dashboard is blocked again", async ({ page }) => {
  await loginAs(page, "guardian@sunrise.test");
  await logout(page);
  await page.goto("/en/dashboard/guardian");
  await expect(page).toHaveURL(/\/en\/login\?next=/);
});

test("first login forces a password change", async ({ page }) => {
  const user = await createTempUser({
    role: "teacher",
    mustChangePassword: true,
    tag: "force",
  });
  try {
    await login(page, user.email);
    await expect(page).toHaveURL(/\/en\/change-password$/);
    // The dashboard stays closed until the password is changed.
    await page.goto("/en/dashboard/teacher");
    await expect(page).toHaveURL(/\/en\/change-password$/);

    await page.getByLabel("New password", { exact: true }).fill("short");
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page.getByText("Use at least 8 characters.")).toBeVisible();

    await page
      .getByLabel("New password", { exact: true })
      .fill("NewSchool2026");
    await page.getByLabel("Confirm new password").fill("NewSchool2026");
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard\/teacher$/);

    await logout(page);
    await login(page, user.email, "NewSchool2026");
    await expect(page).toHaveURL(/\/en\/dashboard\/teacher$/);
  } finally {
    await user.cleanup();
  }
});

test("forgot password sends an email whose link lets the user set a new password", async ({
  page,
}) => {
  const user = await createTempUser({
    role: "guardian",
    mustChangePassword: false,
    tag: "reset",
  });
  try {
    await page.goto("/en/forgot-password");
    await page.getByLabel("Email").fill(user.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status")).toContainText(
      "If an account exists for that email",
    );

    const email = await latestEmailText(user.email);
    const link = /https?:\/\/[^\s"<>]+verify[^\s"<>]+/
      .exec(email)?.[0]
      ?.replaceAll("&amp;", "&");
    expect(link, "reset link in the email").toBeTruthy();
    await page.goto(link!);
    await expect(page).toHaveURL(/\/en\/reset-password$/);

    await page.getByLabel("New password", { exact: true }).fill("Reset2026abc");
    await page.getByLabel("Confirm new password").fill("Reset2026abc");
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard\/guardian$/);

    await logout(page);
    await login(page, user.email, "Reset2026abc");
    await expect(page).toHaveURL(/\/en\/dashboard\/guardian$/);
  } finally {
    await user.cleanup();
  }
});

test("an unknown email on the forgot page gets the same answer", async ({
  page,
}) => {
  await page.goto("/en/forgot-password");
  await page.getByLabel("Email").fill("nobody@sunrise.test");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText(
    "If an account exists for that email",
  );
});

test("an invalid reset link goes back to login with a message", async ({
  page,
}) => {
  await page.goto("/api/auth/callback?code=bogus&next=/en/reset-password");
  await expect(page).toHaveURL(/\/en\/login\?error=link$/);
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText(
    "This link has expired",
  );
});

test("a login without a role sees a clear message, not a redirect loop", async ({
  page,
}) => {
  const user = await createTempUser({
    role: null,
    mustChangePassword: false,
    tag: "norole",
  });
  try {
    await login(page, user.email);
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText(
      "Your account has no access. Please contact the school office.",
    );
    const response = await page.goto("/en/dashboard");
    expect(response?.ok()).toBe(true);
    await expect(page).toHaveURL(/\/en\/login/);
  } finally {
    await user.cleanup();
  }
});

test("auth pages fit a 360px screen", async ({ page }) => {
  for (const path of ["/en/login", "/bn/login", "/en/forgot-password"]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("a normal session cannot use the password pages (no change without the current password)", async ({
  page,
}) => {
  await loginAs(page, "accountant@sunrise.test");
  await page.goto("/en/change-password");
  await expect(page).toHaveURL(/\/en\/dashboard\/accountant$/);
  await page.goto("/en/reset-password");
  await expect(page).toHaveURL(/\/en\/login\?error=link$/);
});

test("too many wrong passwords for one account are refused", async ({
  page,
}) => {
  const email = `e2e-lock-${Date.now()}@sunrise.test`;
  const alert = page.getByRole("alert").filter({ hasText: /\S/ });
  for (let i = 0; i < 10; i++) {
    await login(page, email, `Wrong${i}pass`);
    await expect(alert).toHaveText("Wrong email, mobile number or password.");
  }
  await login(page, email, "Wrong10pass");
  await expect(alert).toHaveText(
    "Too many attempts. Please wait a few minutes and try again.",
  );
});
