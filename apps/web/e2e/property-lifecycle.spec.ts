import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { login } from "./helpers/auth";

test("user creates, uploads and submits a property listing", async ({ page }) => {
  await login(page, process.env.E2E_BIDDER_EMAIL ?? "bidder.e2e@bhumiraj.test", process.env.E2E_BIDDER_PASSWORD ?? "BidderTest!234567");
  await page.goto("/post-property");
  await page.getByLabel("Listing title").fill(`E2E Modern House ${Date.now()}`);
  await page.getByLabel("Price (NPR)").fill("34500000");
  await page.getByLabel("Description").fill("A production-quality property lifecycle test listing with verified location, spacious rooms, secure road access and complete marketplace moderation workflow.");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('input[type="file"]').setInputFiles(path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/property.png"));
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Submit property" }).click();
  await expect(page.getByText("Property submitted for review")).toBeVisible();
});
