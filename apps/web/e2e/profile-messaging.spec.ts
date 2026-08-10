import { expect, test, type APIRequestContext } from "@playwright/test";
import { login } from "./helpers/auth";

async function fixtureIds(request: APIRequestContext) {
  const response = await request.post("/api/v1/testing/fixtures", {
    headers: {
      "x-e2e-key":
        process.env.E2E_SETUP_KEY ?? "local-e2e-setup-key-change-me",
    },
    data: {
      adminEmail:
        process.env.E2E_ADMIN_EMAIL ?? "admin.e2e@bhumiraj.test",
      bidderEmail:
        process.env.E2E_BIDDER_EMAIL ?? "bidder.e2e@bhumiraj.test",
    },
  });
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<{ adminId: string; bidderId: string }>;
}

test("user updates profile, follows an agent and starts a realtime conversation", async ({
  page,
  request,
}) => {
  const fixtures = await fixtureIds(request);
  await login(
    page,
    process.env.E2E_BIDDER_EMAIL ?? "bidder.e2e@bhumiraj.test",
    process.env.E2E_BIDDER_PASSWORD ?? "BidderTest!234567",
  );

  await page.goto("/account/profile");
  await page.getByLabel("Full name").fill("E2E Bidder Profile");
  await page.getByLabel("Bio").fill(
    "Verified marketplace buyer testing public profiles and conversations.",
  );
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Profile updated")).toBeVisible();

  await page.goto(`/users/${fixtures.adminId}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("property-card").first()).toBeVisible();

  const follow = page.getByRole("button", { name: "Follow", exact: true });
  if (await follow.isVisible()) {
    await follow.click();
    await expect(page.getByRole("button", { name: "Following" })).toBeVisible();
  }

  page.once("dialog", (dialog) =>
    dialog.accept("Hello, I am interested in your verified auction property."),
  );
  await page.getByRole("button", { name: "Message" }).click();
  await expect(page).toHaveURL(/\/account\/messages\?conversation=/);
  await expect(
    page.getByText("Hello, I am interested in your verified auction property."),
  ).toBeVisible();
});
