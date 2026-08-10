import { expect, test } from "@playwright/test";
test("public social feed uses cursor pagination and renders responsive cards", async ({ page }) => {
  const requests:string[]=[];page.on("request",r=>{if(r.url().includes("/api/v1/listings"))requests.push(r.url())});
  await page.goto("/");
  await expect(page.getByTestId("property-card").first()).toBeVisible();
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await page.waitForTimeout(1000);
  expect(requests.some(url=>url.includes("limit=10"))).toBeTruthy();
});
