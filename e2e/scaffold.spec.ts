import { expect, test } from "@playwright/test";

test("public scaffold renders without later-phase features", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "SIPEKA", level: 1 })).toBeVisible();
  await expect(page.getByText("Sistem Presensi SMANSA Pamekasan")).toBeVisible();
  await expect(page.getByText(/Fitur presensi belum diaktifkan/)).toBeVisible();
});
