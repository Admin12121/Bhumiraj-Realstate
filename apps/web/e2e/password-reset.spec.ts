import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import { latestEmailMatching } from "./helpers/email-capture";

const oldPassword = "ResetBefore!234567";
const newPassword = "ResetAfter!234567";

test("verified user resets password and old credentials are rejected", async ({
  page,
  request,
}) => {
  const email = `reset.${Date.now()}@bhumiraj.test`;
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("Password Reset User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(oldPassword);
  await page.getByLabel("Confirm password").fill(oldPassword);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();

  const verificationMail = await latestEmailMatching(
    request,
    email,
    /\/api\/auth\/verify-email/,
  );
  const verificationBody = await verificationMail.text();
  const verificationUrl = verificationBody
    .match(/https?:\/\/[^\s"<>]+\/api\/auth\/verify-email[^\s"<>]+/)?.[0]
    ?.replace(/&amp;/g, "&");
  expect(verificationUrl).toBeTruthy();
  await page.goto(verificationUrl!);

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/If the account exists/)).toBeVisible();

  const resetMail = await latestEmailMatching(
    request,
    email,
    /\/reset-password/,
  );
  const resetBody = await resetMail.text();
  const resetUrl = resetBody
    .match(/https?:\/\/[^\s"<>]+\/reset-password[^\s"<>]+/)?.[0]
    ?.replace(/&amp;/g, "&");
  expect(resetUrl).toBeTruthy();
  await page.goto(resetUrl!);
  await page.getByLabel("New password").fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword);
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page).toHaveURL(/sign-in/);

  await login(page, email, oldPassword);
  await expect(page).toHaveURL(/sign-in/);
  await page.getByLabel("Password").fill(newPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});
