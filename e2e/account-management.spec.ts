import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

test("SUPER_ADMIN creates, edits, resets, deactivates, and audits a synthetic account", async ({
  page,
}) => {
  const credentials = JSON.parse(readFileSync(resolve(".local/test-credentials.json"), "utf8")) as {
    password: string;
    users: { superAdmin: { username: string } };
  };
  const suffix = Date.now().toString().slice(-7);
  const username = `phase2.${suffix}`;
  await page.goto("/login");
  await page.getByLabel("Username").fill(credentials.users.superAdmin.username);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/super-admin\/accounts$/);
  await page.goto("/super-admin/accounts/new");
  await page.getByLabel("Nama lengkap").fill("Akun Sintetis Phase 2");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password sementara").fill(credentials.password);
  await page.getByLabel("Konfirmasi password").fill(credentials.password);
  await page.getByRole("button", { name: "Buat Akun" }).click();
  await expect(page).toHaveURL(/\/super-admin\/accounts\?success=created/);

  await page.getByLabel("Cari nama atau username").fill(username);
  await page.getByRole("button", { name: "Terapkan" }).click();
  await page
    .getByRole("row", { name: new RegExp(username) })
    .getByRole("link", { name: "Detail" })
    .click();
  await page.getByLabel("Nama lengkap").fill("Akun Sintetis Diperbarui");
  await page.getByLabel("Role").selectOption("ADMIN");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByText("Operasi akun berhasil diproses.")).toBeVisible();

  await page.getByRole("button", { name: "Reset Password" }).click();
  await page.getByLabel("Password baru").fill(credentials.password);
  await page.getByLabel("Konfirmasi password").fill(credentials.password);
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page).toHaveURL(/success=reset/);

  await page.getByRole("button", { name: /Force Logout/ }).click();
  await page.getByRole("button", { name: "Konfirmasi" }).click();
  await expect(page.getByText(/Sesi akun belum dapat dicabut secara langsung/)).toBeVisible();
  await expect(page.getByText("Operasi akun berhasil diproses.")).toHaveCount(0);

  await page.getByRole("button", { name: "Nonaktifkan" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Nonaktifkan akun" })).toHaveCount(0);
  await page.getByRole("button", { name: "Nonaktifkan" }).click();
  await page.getByRole("button", { name: "Konfirmasi" }).click();
  await expect(page).toHaveURL(/success=status/);
  await expect(page.getByText("Nonaktif", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Hapus Akses" }).click();
  await page.getByRole("button", { name: "Konfirmasi" }).click();
  await expect(page).toHaveURL(/\/super-admin\/accounts\?success=deleted/);

  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByText("Username atau password tidak valid.")).toBeVisible();

  await page.getByLabel("Username").fill(credentials.users.superAdmin.username);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/super-admin\/accounts$/);

  const reusedUsername = `reuse.${suffix}`;
  await page.goto("/super-admin/accounts/new");
  await page.getByLabel("Nama lengkap").fill("Akun Reuse Sintetis");
  await page.getByLabel("Username").fill(reusedUsername);
  await page.getByLabel("Password sementara").fill(credentials.password);
  await page.getByLabel("Konfirmasi password").fill(credentials.password);
  await page.getByRole("button", { name: "Buat Akun" }).click();
  await expect(page).toHaveURL(/\/super-admin\/accounts\?success=created/);

  await page.goto(
    `/super-admin/account-audit?action=CREATE&search=${encodeURIComponent(username)}`,
  );
  await expect(page.getByRole("cell", { name: "CREATE", exact: true }).first()).toBeVisible();
  await page.goto(
    `/super-admin/account-audit?action=FORCE_LOGOUT_FAILED&search=${encodeURIComponent(username)}`,
  );
  await expect(
    page.getByRole("cell", { name: "FORCE_LOGOUT_FAILED", exact: true }).first(),
  ).toBeVisible();
});
