import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Credentials = { password: string; users: { admin: { email: string } } };
const credentials = () =>
  JSON.parse(readFileSync(resolve(".local/test-credentials.json"), "utf8")) as Credentials;

test("ADMIN previews and imports a synthetic CSV all-or-none", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username atau Email").fill(credentials().users.admin.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials().password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/import-siswa");
  await page.locator("select[name=classId]").selectOption({ label: "X-1" });
  await page.locator("input[name=yearEntered]").fill("2026");
  await page.locator("input[type=file]").setInputFiles({
    name: "synthetic-phase7.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("NIS,NISN,NAMA,JENIS_KELAMIN\nP7-E2E-001,P7N-E2E-001,Nabila E2E,P\n"),
  });
  await expect(page.getByText("Valid", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Konfirmasi import 1 siswa" }).click();
  await expect(page).toHaveURL(/\/import-siswa\?success=1$/);
  await expect(page.getByText("1 siswa berhasil diimport.")).toBeVisible();
});
