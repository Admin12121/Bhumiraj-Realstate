import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import { latestEmailMatching } from "./helpers/email-capture";
import { secretFromOtpUri, totp } from "./helpers/totp";

const password = "SecureUser!234567";

test("email registration, verification, login, TOTP and account deletion initiation", async ({ page, request }) => {
  const email = `user.${Date.now()}@bhumiraj.test`;
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("Lifecycle User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/sign-in/);

  const messageResponse = await latestEmailMatching(
    request,
    email,
    /\/api\/auth\/verify-email/,
  );
  const message = await messageResponse.text();
  const verifyUrl = message.match(/https?:\/\/[^\s"<>]+\/api\/auth\/verify-email[^\s"<>]+/)?.[0]?.replace(/&amp;/g, "&");
  expect(verifyUrl).toBeTruthy();
  await page.goto(verifyUrl!);

  await login(page, email, password);
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/account/security");
  await page.getByPlaceholder("Confirm current password").fill(password);
  await page.getByRole("button", { name: "Enable" }).click();
  const uriText = await page.getByText(/Authenticator URI:/).textContent();
  const uri = uriText?.replace("Authenticator URI: ", "") ?? "";
  const secret = secretFromOtpUri(uri);
  await page.getByPlaceholder("123456").fill(totp(secret));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("Enabled")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await login(page, email, password);
  await expect(page).toHaveURL(/two-factor/);
  await page.getByLabel("Authenticator code").fill(totp(secret));
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/account/security");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Request account deletion" }).click();
  await expect(page.getByText("Deletion pending")).toBeVisible();
  await page.getByRole("button", { name: "Keep my account" }).click();
  await expect(page.getByRole("button", { name: "Request account deletion" })).toBeVisible();
});
