import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

test.setTimeout(90_000);

type Credentials = {
  password: string;
  users: {
    admin: { username: string };
    user: { username: string };
  };
};

const credentials = () =>
  JSON.parse(readFileSync(resolve(".local/test-credentials.json"), "utf8")) as Credentials;

const todayJakarta = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

async function login(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(credentials().password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("ADMIN exports grade workbook with daily and summarize tables", async ({ page }) => {
  const suffix = Date.now().toString().slice(-7);
  const name = `Export Massal ${suffix}`;
  const today = todayJakarta();

  await login(page, credentials().users.admin.username);

  await page.goto("/manajemen-siswa");
  await page.locator("#create-full-name").fill(name);
  await page.locator("#create-gender").selectOption("P");
  await page.locator("#create-year-entered").fill("2026");
  await page.locator("#create-grade").selectOption("X");
  await page.locator("#create-class").selectOption({ label: "X-10" });
  await page.getByRole("button", { name: "Tambah siswa" }).click();
  await expect(page).toHaveURL(/\/siswa\/[0-9a-f-]+\?success=created$/);

  await page.goto("/presensi/input");
  await page.locator("#attendance-date").fill(today);
  await page.locator("#attendance-class").selectOption({ label: "X-10" });
  await page.getByRole("button", { name: "Muat data" }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();

  await page.getByLabel(`${name} Jam 1`, { exact: true }).selectOption("SAKIT");
  await page.getByLabel(`${name} Jam 2`, { exact: true }).selectOption("IZIN");
  await page.getByRole("button", { name: "Preview Presensi" }).click();
  await expect(page.getByText(/Baru 2/)).toBeVisible();
  await page.getByRole("button", { name: "Konfirmasi dan Simpan" }).click();
  await expect(page.getByText(/Presensi berhasil disimpan/)).toBeVisible();

  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Export Laporan Presensi" })).toBeVisible();
  await page.getByLabel("Jenis periode").selectOption("custom");
  await page.getByLabel("Grade").selectOption("X");
  await page.getByLabel("Tanggal mulai").fill(today);
  await page.getByLabel("Tanggal akhir").fill(today);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Excel" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe(
    `laporan-presensi_grade-X_${today}_sampai_${today}.xlsx`,
  );

  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    (await readFile(downloadPath!)) as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );

  expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
    "Ringkasan",
    "X-1",
    "X-2",
    "X-3",
    "X-4",
    "X-5",
    "X-6",
    "X-7",
    "X-8",
    "X-9",
    "X-10",
  ]);

  const classSheet = workbook.getWorksheet("X-10")!;
  const studentRows: ExcelJS.Row[] = [];
  classSheet.eachRow((row) => {
    if (row.getCell(4).text === name) studentRows.push(row);
  });

  expect(studentRows).toHaveLength(2);

  const dailyRow = studentRows[0]!;
  expect(dailyRow.getCell(6).text).toBe("S/I");
  expect(dailyRow.getCell(7).value).toBe(1);
  expect(dailyRow.getCell(8).value).toBe(0);
  expect(dailyRow.getCell(9).value).toBe(1);
  expect(dailyRow.getCell(10).value).toBe(1);

  const summarizeRow = studentRows[1]!;
  expect(summarizeRow.getCell(5).text).toContain(today);
  expect(summarizeRow.getCell(6).text).toContain(today);
  expect(summarizeRow.getCell(7).text).toBe("—");
  expect(summarizeRow.getCell(8).value).toBe(1);
  expect(summarizeRow.getCell(9).value).toBe(0);
  expect(summarizeRow.getCell(10).value).toBe(1);
  expect(summarizeRow.getCell(11).value).toBe(1);

  await page.getByRole("button", { name: "Keluar" }).click();
  await login(page, credentials().users.user.username);
  await page.goto("/reports");
  await expect(page).toHaveURL(/\/dashboard$/);
});
