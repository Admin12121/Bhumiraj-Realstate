import { expect, test } from "@playwright/test";

test("marketplace navigation adapts between desktop and phone layouts", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");

  const mobileNavigation = page.getByRole("navigation", {
    name: "Marketplace navigation",
  });
  const desktopSidebar = page.locator('[data-slot="sidebar"]');

  if (isMobile) {
    await expect(mobileNavigation).toBeVisible();
    await expect(desktopSidebar).toBeHidden();
    await expect(
      mobileNavigation.getByRole("link", { name: "Home", exact: true }),
    ).toHaveAttribute("aria-current", "page");

    await mobileNavigation.getByRole("button", { name: "More" }).click();
    await expect(
      page.getByRole("heading", { name: "More options" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  } else {
    await expect(mobileNavigation).toBeHidden();
    await expect(desktopSidebar).toBeVisible();
    await expect(
      desktopSidebar.getByRole("link", { name: "Home", exact: true }),
    ).toBeVisible();
  }
});

test("agent directory keeps the shared marketplace shell", async ({
  page,
  isMobile,
}) => {
  await page.goto("/agents");
  await expect(
    page.getByRole("heading", { name: "Find a trusted property agent" }),
  ).toBeVisible();

  if (isMobile) {
    await expect(
      page
        .getByRole("navigation", { name: "Marketplace navigation" })
        .getByRole("link", { name: "Agents", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  } else {
    await expect(page.locator('[data-slot="sidebar"]')).toBeVisible();
  }
});

test("navigation has no dead zone at the 800px shell breakpoint", async ({
  page,
}) => {
  const mobileNavigation = page.getByRole("navigation", {
    name: "Marketplace navigation",
  });
  const desktopSidebar = page.locator('[data-slot="sidebar"]');

  await page.setViewportSize({ width: 799, height: 900 });
  await page.goto("/");
  await expect(mobileNavigation).toBeVisible();
  await expect(desktopSidebar).toBeHidden();

  await page.setViewportSize({ width: 800, height: 900 });
  await expect(mobileNavigation).toBeHidden();
  await expect(desktopSidebar).toBeVisible();
});
