import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

test.setTimeout(60_000);

type Credentials = {
  password: string;
  users: {
    admin: { email: string };
    user: { username: string };
    superAdmin: { username: string };
  };
};
const credentials = () =>
  JSON.parse(readFileSync(resolve(".local/test-credentials.json"), "utf8")) as Credentials;
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

async function login(page: Page, identifier: string) {
  await page.goto("/login");
  await page.getByLabel("Username atau Email").fill(identifier);
  await page.getByLabel("Password", { exact: true }).fill(credentials().password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/(dashboard|super-admin\/accounts)$/);
}

test("student attendance detail reuses attendance mutation and exports a safe report", async ({
  page,
}) => {
  const suffix = Date.now().toString().slice(-7);
  const name = `@Laporan Sintetis ${suffix}`;
  const nis = `=P6-${suffix}`;
  const nisn = `+N-P6-${suffix}`;

  await login(page, credentials().users.admin.email);
  await page.goto("/manajemen-siswa");
  await page.locator("#create-full-name").fill(name);
  await page.locator("#create-nis").fill(nis);
  await page.locator("#create-nisn").fill(nisn);
  await page.locator("#create-gender").selectOption("P");
  await page.locator("#create-year-entered").fill("2026");
  await page.locator("#create-grade").selectOption("X");
  await page.locator("#create-class").selectOption({ label: "X-1" });
  await page.getByRole("button", { name: "Tambah siswa" }).click();
  await expect(page).toHaveURL(/\/siswa\/[0-9a-f-]+/);
  const studentId = new URL(page.url()).pathname.split("/").pop()!;

  await expect(page.getByRole("cell", { name: "Hadir", exact: true })).toHaveCount(10);
  await page.locator("#student-period-1").selectOption("IZIN");
  await page.locator("#student-period-2").selectOption("SAKIT");
  await page.getByRole("button", { name: "Preview koreksi" }).click();
  await expect(page.getByText(/Baru 2/)).toBeVisible();
  await page.getByRole("button", { name: "Konfirmasi koreksi" }).click();
  await expect(page.getByText(/Koreksi tersimpan/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Jam Izin").locator("..").getByText("1", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Jam Sakit").locator("..").getByText("1", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "CREATE", exact: true })).toHaveCount(2);

  await page.locator("#student-period-1").selectOption("TANPA_KETERANGAN");
  await page.locator("#student-period-2").selectOption("");
  await page.getByRole("button", { name: "Preview koreksi" }).click();
  await expect(page.getByText(/Diperbarui 1 · Dihapus 1/)).toBeVisible();
  await page.getByRole("button", { name: "Konfirmasi koreksi" }).click();
  await page.reload();
  await expect(page.getByRole("cell", { name: "UPDATE", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "DELETE", exact: true })).toBeVisible();

  const month = today().slice(0, 7);
  const response = await page.request.get(
    `/api/students/${studentId}/report?from=${month}-01&to=${today()}`,
  );
  expect(response.ok()).toBe(true);
  expect(response.headers()["cache-control"]).toBe("no-store");
  const workbook = new ExcelJS.Workbook();
  const report = await response.body();
  await workbook.xlsx.load(report as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const row = workbook.getWorksheet("Presensi")!.getRow(2);
  expect(row.getCell(3).value).toBe(`'${nis}`);
  expect(row.getCell(4).value).toBe(`'${nisn}`);
  expect(row.getCell(5).value).toBe(`'${name}`);

  await page.goto(`/siswa/${studentId}/laporan?from=${month}-01&to=${today()}`);
  await expect(page.getByRole("button", { name: "Cetak / Simpan PDF" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: name })).toBeVisible();

  await page.getByRole("button", { name: "Keluar" }).click();
  await login(page, credentials().users.user.username);
  await page.goto(`/siswa/${studentId}`);
  await expect(page.getByText("Koreksi beberapa jam")).toHaveCount(0);
  await expect(page.getByText("Export Excel")).toHaveCount(0);

  await page.getByRole("button", { name: "Keluar" }).click();
  await login(page, credentials().users.superAdmin.username);
  await page.goto(`/siswa/${studentId}`);
  await expect(page).toHaveURL(/\/super-admin\/accounts$/);
});
