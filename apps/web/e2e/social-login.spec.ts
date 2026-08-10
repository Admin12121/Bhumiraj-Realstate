import { expect, test } from "@playwright/test";

test.describe("social authentication initiation", () => {
  for (const provider of ["Google", "GitHub"] as const) {
    test(`${provider} login starts Better Auth OAuth flow`, async ({ page }) => {
      let requested = false;
      await page.route("**/api/auth/sign-in/social", async (route) => {
        requested = true;
        const request = route.request();
        expect(request.method()).toBe("POST");
        const body = request.postDataJSON();
        expect(body.provider).toBe(provider.toLowerCase());
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: `https://oauth.test/${provider.toLowerCase()}`, redirect: true }) });
      });
      await page.goto("/sign-in");
      await page.getByRole("button", { name: provider }).click();
      await expect.poll(() => requested).toBe(true);
    });
  }
});
