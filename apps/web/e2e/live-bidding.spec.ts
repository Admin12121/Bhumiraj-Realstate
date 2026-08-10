import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
test("eligible bidder places a committed live bid and sees sequence update", async ({ page }) => {
  await login(page, process.env.E2E_BIDDER_EMAIL ?? "bidder.e2e@bhumiraj.test", process.env.E2E_BIDDER_PASSWORD ?? "BidderTest!234567");
  await page.goto("/auctions/00000000-0000-4000-8000-000000000004");
  await expect(page.getByText("Current bid").first()).toBeVisible();
  const input=page.getByLabel("Your bid (NPR)");
  const minimum=Number(await input.getAttribute("min"));
  await input.fill(String(minimum+1000));
  await page.getByRole("button",{name:"Place bid"}).click();
  await expect(page.getByText("Bid accepted")).toBeVisible();
  await expect(page.getByText(/Sequence [1-9]/)).toBeVisible();
});
