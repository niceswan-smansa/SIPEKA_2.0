import { expect, test } from "@playwright/test";

test("landing page renders with the approved visual assets", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "SIPEKA", level: 1 })).toBeVisible();
  await expect(page.getByText("Sistem Presensi SMANSA Pamekasan").first()).toBeVisible();
  await expect(page.getByAltText("Logo SMAN 1 Pamekasan")).toBeVisible();
  await expect(page.locator(".hero-background")).toHaveCSS("background-image", /smansa-hero\.webp/);
  await expect(page.getByRole("link", { name: "Mulai" })).toHaveAttribute("href", "/login");
  await page.getByRole("link", { name: "Pelajari Lebih Lanjut" }).click();
  await expect(page.locator("#overview")).toBeInViewport();
});
