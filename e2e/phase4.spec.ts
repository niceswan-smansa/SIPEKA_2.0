import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

type Credentials = { password: string; users: { admin: { username: string } } };
const credentials = () =>
  JSON.parse(readFileSync(resolve(".local/test-credentials.json"), "utf8")) as Credentials;
const todayJakarta = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

test("ADMIN previews mixed attendance and All Jam writes one record per period", async ({
  page,
}) => {
  const suffix = Date.now().toString().slice(-7);
  const name = `Attendance Sintetis ${suffix}`;
  const nis = `E2E-P4-${suffix}`;
  const nisn = `E2E-N-P4-${suffix}`;

  await page.goto("/login");
  await page.getByLabel("Username").fill(credentials().users.admin.username);
  await page.getByLabel("Password", { exact: true }).fill(credentials().password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/manajemen-siswa");
  await page.locator("#create-full-name").fill(name);
  await page.locator("#create-nis").fill(nis);
  await page.locator("#create-nisn").fill(nisn);
  await page.locator("#create-gender").selectOption("P");
  await page.locator("#create-year-entered").fill("2026");
  await page.locator("#create-grade").selectOption("X");
  await page.locator("#create-class").selectOption({ label: "X-1" });
  await page.getByRole("button", { name: "Tambah siswa" }).click();
  await expect(page).toHaveURL(/\/siswa\/[0-9a-f-]+\?success=created$/);

  await page.goto("/presensi/input");
  await page.locator("#attendance-date").fill(todayJakarta());
  await page.locator("#attendance-class").selectOption({ label: "X-1" });
  await page.getByRole("button", { name: "Muat data" }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();

  await page.getByLabel(`${name} Jam 1`, { exact: true }).selectOption("IZIN");
  await page.getByLabel(`${name} Jam 2`, { exact: true }).selectOption("SAKIT");
  await page.getByRole("button", { name: "Preview Presensi" }).click();
  await expect(page.getByText(/Baru 2/)).toBeVisible();
  await page.getByRole("button", { name: "Konfirmasi dan Simpan" }).click();
  await expect(page.getByText(/Presensi berhasil disimpan/)).toBeVisible();

  await page.getByLabel("Pilih Semua Siswa").check();
  await page.getByLabel("Status terpilih").selectOption("TANPA_KETERANGAN");
  await page.getByLabel("Jam terpilih").selectOption("all");
  await page.getByRole("button", { name: "Terapkan Status" }).click();
  await page.getByRole("button", { name: "Preview Presensi" }).click();
  await expect(page.getByText(/Baru 8/)).toBeVisible();
  await page.getByRole("button", { name: "Konfirmasi dan Simpan" }).click();
  await expect(page.getByText(/Presensi berhasil disimpan/)).toBeVisible();
});
