import { expect, test } from "@playwright/test";

test("verified agent directory is reachable and cursor-ready", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/profiles/agents")) {
      requests.push(request.url());
    }
  });

  await page.goto("/agents");
  await expect(
    page.getByRole("heading", { name: "Find a trusted property agent" }),
  ).toBeVisible();
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  expect(requests[0]).toContain("limit=18");
});
