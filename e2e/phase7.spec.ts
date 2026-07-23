import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Credentials = { password: string; users: { admin: { username: string } } };
const credentials = () =>
  JSON.parse(readFileSync(resolve(".local/test-credentials.json"), "utf8")) as Credentials;

test("ADMIN previews and imports a synthetic CSV all-or-none", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill(credentials().users.admin.username);
  await page.getByLabel("Password", { exact: true }).fill(credentials().password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/import-siswa");
  await page.locator("select[name=classId]").selectOption({ label: "X-1" });
  await page.locator("input[name=yearEntered]").fill("2026");
  await page.locator("input[type=file]").setInputFiles({
    name: "synthetic-phase7.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("NIS,NISN,NAMA,JENIS_KELAMIN\n710001,7710000001,Nabila E2E,P\n"),
  });
  await expect(page.getByText("Valid", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Konfirmasi import 1 siswa" }).click();
  await expect(page).toHaveURL(/\/import-siswa\?success=1$/);
  await expect(page.getByText("1 siswa berhasil diimport.")).toBeVisible();
});
