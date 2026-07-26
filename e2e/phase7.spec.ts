import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Credentials = { password: string; users: { importAdmin: { username: string } } };
const credentials = () =>
  JSON.parse(readFileSync(resolve(".local/test-credentials.json"), "utf8")) as Credentials;

test("ADMIN previews and bulk imports a synthetic CSV all-or-none", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill(credentials().users.importAdmin.username);
  await page.getByLabel("Password", { exact: true }).fill(credentials().password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/import-siswa");
  await page.getByLabel("Tahun ajaran aktif").selectOption({ label: "2026/2027" });
  await page.getByLabel("Kelas tujuan").selectOption({ label: "X-1" });
  await page.getByRole("button", { name: "Tambah file" }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "synthetic-phase7.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("NIS,NISN,NAMA,JENIS_KELAMIN\n710001,7710000001,Nabila E2E,P\n"),
  });

  await expect(page.getByText("Valid", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Simpan bulk import 1 siswa dari 1 file" }).click();

  await expect(page).toHaveURL(/\/import-siswa\?success=1$/);
  await expect(page.getByText("1 siswa berhasil diimport.")).toBeVisible();
});
