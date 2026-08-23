import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "admin.e2e@bhumiraj.test";
const adminPassword =
  process.env.E2E_ADMIN_PASSWORD ?? "AdminTest!234567";
const bidderEmail =
  process.env.E2E_BIDDER_EMAIL ?? "bidder.e2e@bhumiraj.test";

test("anonymous user cannot access the admin API", async ({ request }) => {
  const response = await request.get("/api/v1/admin/users");
  expect([401, 403]).toContain(response.status());
});

test("super administrator paginates, searches, changes role, suspends and restores a user", async ({
  page,
}) => {
  await login(page, adminEmail, adminPassword);
  await page.goto("/dashboard/users");
  await expect(
    page.getByRole("heading", { name: "User management" }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();

  const next = page.getByRole("button", { name: "Next page" });
  if (await next.isEnabled()) {
    await next.click();
    await expect(page.getByText(/Page 2 of/)).toBeVisible();
    await page.getByRole("button", { name: "Previous page" }).click();
  }

  await page.getByPlaceholder("Search name or email").fill(bidderEmail);
  const row = page.getByRole("row").filter({ hasText: bidderEmail });
  await expect(row).toBeVisible();

  await page.getByLabel(`Role for ${bidderEmail}`).selectOption("AGENT");
  await expect(page.getByText("User account updated.")).toBeVisible();
  await page.getByLabel(`Role for ${bidderEmail}`).selectOption("USER");
  await expect(page.getByText("User account updated.")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept("E2E suspension verification"));
  await page.getByLabel(`Suspend ${bidderEmail}`).click();
  await expect(row.getByText("SUSPENDED")).toBeVisible();
  await page.getByLabel(`Restore ${bidderEmail}`).click();
  await expect(row.getByText("ACTIVE")).toBeVisible();

  await page.goto("/dashboard/listings");
  await expect(page.getByRole("table")).toBeVisible();
});
