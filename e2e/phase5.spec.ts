import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

type Credentials = { password: string; users: { user: { username: string } } };
const credentials = () =>
  JSON.parse(readFileSync(resolve(".local/test-credentials.json"), "utf8")) as Credentials;

test("USER uses the date-driven dashboard and monthly calendar", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username atau Email").fill(credentials().users.user.username);
  await page.getByLabel("Password", { exact: true }).fill(credentials().password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await expect(page.getByText("Siswa Tidak Hadir", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bulan sebelumnya" })).toBeVisible();
  await expect(page.getByText("Kembali ke hari ini", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Riwayat aktivitas", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Bulan sebelumnya" }).click();
  await expect(page).toHaveURL(/month=\d{4}-\d{2}-01/);
  await page.getByText("Tabel data grafik", { exact: true }).first().click();
  await expect(page.getByRole("columnheader", { name: "Tanpa Keterangan" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("Kalender dashboard")).toBeVisible();
});
