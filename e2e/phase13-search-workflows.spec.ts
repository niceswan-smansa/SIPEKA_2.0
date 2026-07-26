import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Credentials = {
  password: string;
  users: { user: { username: string }; admin: { username: string } };
};

const credentials = () =>
  JSON.parse(readFileSync(resolve(".local/test-credentials.json"), "utf8")) as Credentials;

async function login(page: import("@playwright/test").Page, role: "user" | "admin") {
  await page.goto("/login");
  await page.getByLabel("Username").fill(credentials().users[role].username);
  await page.getByLabel("Password", { exact: true }).fill(credentials().password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("USER opens class search calendar, daily names, and monthly trend", async ({ page }) => {
  await login(page, "user");
  await page.goto("/pencarian?tab=kelas");

  await expect(page.getByRole("heading", { name: "Pencarian" })).toBeVisible();
  await expect(page.getByLabel("Tahun ajaran")).toHaveValue("10000000-0000-4000-8000-000000000001");
  await expect(page.getByLabel("Kelas")).toContainText("X-1");
  await expect(page.getByLabel("Kalender dashboard")).toBeVisible();

  for (const heading of ["Total", "Sakit", "Izin", "Tanpa Keterangan"]) {
    await expect(page.getByRole("heading", { name: new RegExp(`^${heading} \\(`) })).toBeVisible();
  }

  await expect(page.getByRole("heading", { name: "Tren bulanan kelas" })).toBeVisible();
});

test("ADMIN sees the integrated target-year wizard", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/naik-turun-grade");

  await expect(page.getByLabel("Nama tahun tujuan")).toBeVisible();
  await expect(page.getByLabel("Tanggal mulai tahun tujuan")).toBeVisible();
  await expect(page.getByLabel("Tanggal selesai tahun tujuan")).toBeVisible();
  await expect(page.getByRole("button", { name: "Buat tahun tujuan dan preview" })).toBeVisible();
});
