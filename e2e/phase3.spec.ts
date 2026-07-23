import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

type Credentials = {
  password: string;
  users: {
    admin: { username: string };
    user: { username: string };
  };
};

const credentials = () =>
  JSON.parse(readFileSync(resolve(".local/test-credentials.json"), "utf8")) as Credentials;

async function login(page: Page, identifier: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(identifier);
  await page.getByLabel("Password", { exact: true }).fill(credentials().password);
  await page.getByRole("button", { name: "Masuk" }).click();
}

test("ADMIN manages fixed classes and a synthetic student; USER remains read-only", async ({
  page,
}) => {
  const suffix = Date.now().toString().slice(-7);
  const nis = `E2E-P3-${suffix}`;
  const nisn = `E2E-N-P3-${suffix}`;
  const name = `Nabila Sintetis ${suffix}`;

  await login(page, credentials().users.admin.username);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/manajemen-kelas");
  await expect(page.getByRole("heading", { name: "X-1", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "XII-10", exact: true })).toBeVisible();

  const academicYearName = `2098/${suffix}`;
  await page.getByLabel("Nama", { exact: true }).fill(academicYearName);
  await page.getByLabel("Tanggal mulai").fill("2098-07-01");
  await page.getByLabel("Tanggal selesai").fill("2099-06-30");
  await page.getByRole("button", { name: "Buat tahun dan 30 kelas" }).click();
  await page.getByRole("link", { name: academicYearName, exact: true }).click();
  await expect(page.getByText("0 siswa aktif", { exact: true })).toHaveCount(30);
  await page.goto("/manajemen-kelas");

  const teacher = page.getByLabel("Wali kelas").first();
  await teacher.fill("Wali Kelas Sintetis");
  await teacher
    .locator("xpath=ancestor::form")
    .getByRole("button", { name: "Simpan metadata" })
    .click();
  await expect(page.getByText("Perubahan berhasil disimpan dan diaudit.")).toBeVisible();

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
  const studentId = new URL(page.url()).pathname.split("/").pop();
  if (!studentId) throw new Error("Student id was not returned after creation.");
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "X-1" })).toBeVisible();
  await expect(page.getByText("Current", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Edit siswa" }).click();
  await page.locator("#edit-class").selectOption({ label: "X-2" });
  await page.getByRole("button", { name: "Simpan grade / kelas" }).click();
  await expect(page.getByText("Perubahan siswa berhasil disimpan dan diaudit.")).toBeVisible();

  await page.getByRole("button", { name: "Nonaktifkan siswa" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Nonaktifkan siswa" })).toHaveCount(0);
  await page.getByRole("button", { name: "Nonaktifkan siswa" }).click();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && response.url().includes("manajemen-siswa"),
    ),
    page.getByRole("button", { name: "Konfirmasi" }).click(),
  ]);
  await page.reload();
  await expect(page.getByRole("button", { name: "Aktifkan siswa" })).toBeVisible();

  await page.goto("/manajemen-kelas");
  const x2Card = page
    .getByRole("heading", { name: "X-2", exact: true })
    .locator("xpath=ancestor::section[1]");
  await expect(x2Card.getByText("0 siswa aktif", { exact: true })).toBeVisible();
  await x2Card.getByRole("button", { name: "Nonaktifkan", exact: true }).click();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && response.url().includes("manajemen-kelas"),
    ),
    page.getByRole("button", { name: "Konfirmasi" }).click(),
  ]);
  await page.reload();
  await expect(x2Card.getByText("Nonaktif", { exact: true })).toBeVisible();

  await page.goto(`/manajemen-siswa?student=${studentId}`);
  await page.getByRole("button", { name: "Aktifkan siswa" }).click();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && response.url().includes("manajemen-siswa"),
    ),
    page.getByRole("button", { name: "Konfirmasi" }).click(),
  ]);
  await expect(page.getByText("Kelas tidak aktif atau tidak ditemukan.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Aktifkan siswa" })).toBeVisible();

  await page.goto("/manajemen-kelas");
  await x2Card.getByRole("button", { name: "Aktifkan", exact: true }).click();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && response.url().includes("manajemen-kelas"),
    ),
    page.getByRole("button", { name: "Konfirmasi" }).click(),
  ]);

  await page.goto(`/manajemen-siswa?student=${studentId}`);
  await page.getByRole("button", { name: "Aktifkan siswa" }).click();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && response.url().includes("manajemen-siswa"),
    ),
    page.getByRole("button", { name: "Konfirmasi" }).click(),
  ]);
  await page.reload();
  await expect(page.getByRole("button", { name: "Nonaktifkan siswa" })).toBeVisible();

  await page.goto("/manajemen-siswa");
  await page.locator("#create-full-name").fill("Duplikat Sintetis");
  await page.locator("#create-nis").fill(nis);
  await page.locator("#create-nisn").fill(`${nisn}-2`);
  await page.locator("#create-year-entered").fill("2026");
  await page.locator("#create-class").selectOption({ label: "X-1" });
  await page.getByRole("button", { name: "Tambah siswa" }).click();
  await expect(page.getByText("NIS sudah digunakan siswa lain.")).toBeVisible();

  await page.goto("/siswa");
  await page.getByLabel("Cari nama, NIS, atau NISN").fill("nabil");
  await expect(page).toHaveURL(/q=nabil/);
  await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();
  await page.getByLabel("Grade").selectOption("X");
  await expect(page).toHaveURL(/grade=X/);
  await page.getByLabel("Kelas").selectOption({ label: "X-2" });
  await expect(page).toHaveURL(/classId=/);
  await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Keluar" }).click();
  await login(page, credentials().users.user.username);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto(`/siswa?q=${encodeURIComponent("nabil")}`);
  await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
  await page.getByRole("link", { name: "Detail" }).first().click();
  await expect(page.getByRole("link", { name: "Edit siswa" })).toHaveCount(0);
  await page.goto("/manajemen-siswa");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/siswa?q=${encodeURIComponent("nabil")}`);
  await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();
});
