import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";

test("register and authenticate with a virtual WebAuthn passkey", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "CDP virtual authenticators require Chromium");
  const client = await context.newCDPSession(page);
  await client.send("WebAuthn.enable");
  await client.send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  const email = process.env.E2E_BIDDER_EMAIL ?? "bidder.e2e@bhumiraj.test";
  const password = process.env.E2E_BIDDER_PASSWORD ?? "BidderTest!234567";
  await login(page, email, password);
  await page.goto("/account/security");
  await page.getByRole("button", { name: "Add passkey" }).click();
  await expect(page.getByText("Passkey added")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in with passkey" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/account/security");
  page.once("dialog", (dialog) => dialog.accept("Primary laptop passkey"));
  await page.getByRole("button", { name: /Rename .*passkey/i }).first().click();
  await expect(page.getByText("Primary laptop passkey")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /Remove Primary laptop passkey/i }).click();
  await expect(page.getByText("No passkeys registered.")).toBeVisible();
});
