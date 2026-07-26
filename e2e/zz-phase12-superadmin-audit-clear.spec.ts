import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

type Credentials = {
  password: string;
  users: {
    importAdmin: { username: string };
    superAdmin: { username: string };
  };
};

const credentials = () =>
  JSON.parse(readFileSync(resolve(".local/test-credentials.json"), "utf8")) as Credentials;

async function login(page: Page, identifier: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(identifier);
  await page.getByLabel("Password", { exact: true }).fill(credentials().password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/(dashboard|super-admin\/accounts)$/);
}

async function logout(page: Page) {
  const clearAuditDialog = page.getByRole("dialog", {
    name: "Hapus semua riwayat operasional",
  });
  if (await clearAuditDialog.isVisible()) {
    const dismissButton = clearAuditDialog.getByRole("button", {
      name: /Batal|Tutup|Selesai/i,
    });
    if (await dismissButton.count()) {
      await dismissButton.first().click();
    } else {
      await page.keyboard.press("Escape");
    }
    await expect(clearAuditDialog).toBeHidden();
  }

  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

test("SUPER_ADMIN membersihkan audit operasional tanpa menghapus histori siswa", async ({
  page,
}) => {
  const suffix = Date.now().toString().slice(-7);

  await login(page, credentials().users.importAdmin.username);
  await page.goto("/manajemen-siswa");
  await page.locator("#create-full-name").fill(`Riwayat Sintetis ${suffix}`);
  await page.locator("#create-gender").selectOption("L");
  await page.locator("#create-year-entered").fill("2026");
  await page.locator("#create-grade").selectOption("X");
  await page.locator("#create-class").selectOption({ label: "X-3" });
  await page.getByRole("button", { name: "Tambah siswa" }).click();
  await expect(page).toHaveURL(/\/siswa\/[0-9a-f-]+/);
  const studentId = new URL(page.url()).pathname.split("/").pop()!;
  await logout(page);

  await login(page, credentials().users.superAdmin.username);
  await page.goto("/super-admin/account-audit");
  await expect(
    page.getByRole("heading", { name: "Pembersihan riwayat operasional" }),
  ).toBeVisible();

  const countText = await page
    .getByText("catatan operasional tersimpan")
    .locator("..")
    .locator("p")
    .nth(1)
    .textContent();
  expect(Number(countText)).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Hapus riwayat operasional" }).click();
  const dialog = page.getByRole("dialog", { name: "Hapus semua riwayat operasional" });
  await expect(dialog.getByRole("button", { name: "Hapus permanen" })).toBeDisabled();
  await dialog
    .getByLabel(/Ketik HAPUS SEMUA RIWAYAT OPERASIONAL/)
    .fill("HAPUS SEMUA RIWAYAT OPERASIONAL");
  await dialog.getByRole("button", { name: "Hapus permanen" }).click();

  await expect(page).toHaveURL(
    /\/super-admin\/account-audit\?success=operational-cleared&count=\d+$/,
  );
  await expect(page.getByText(/\d+ riwayat operasional berhasil dihapus\./)).toBeVisible();
  await expect(
    page.getByRole("article").getByText("Menghapus riwayat operasional", { exact: true }),
  ).toBeVisible();
  await logout(page);

  await login(page, credentials().users.importAdmin.username);
  await page.goto("/riwayat-aktivitas");
  await expect(page.getByText("Belum ada aktivitas operasional.")).toBeVisible();

  await page.goto(`/siswa/${studentId}`);
  await expect(page.getByRole("heading", { name: "Histori enrollment" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "X-3", exact: true })).toBeVisible();
});
