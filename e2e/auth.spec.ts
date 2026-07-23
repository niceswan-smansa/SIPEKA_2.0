import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

type TestUser = { username: string };

type Credentials = {
  password: string;
  nextPassword: string;
  users: {
    user: TestUser;
    admin: TestUser;
    superAdmin: TestUser;
    inactive: TestUser;
    mustChange: TestUser;
  };
};

function loadCredentials(): Credentials {
  return JSON.parse(readFileSync(resolve(".local/test-credentials.json"), "utf8")) as Credentials;
}

async function login(page: Page, identifier: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(identifier);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
}

test("anonymous protected route redirects to login and report API returns 401", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);

  const response = await page.request.get(
    "/api/students/00000000-0000-4000-8000-000000000001/report?from=2026-01-01&to=2026-01-31",
  );
  expect(response.status()).toBe(401);
});

test("USER logs in, reads operational data, and cannot mutate or export", async ({ page }) => {
  const credentials = loadCredentials();
  await login(page, credentials.users.user.username, credentials.password);

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Siswa Tidak Hadir", { exact: true })).toBeVisible();

  const mutationResponse = await page.request.post("/api/test/mutation");
  expect(mutationResponse.status()).toBe(403);

  const exportResponse = await page.request.get(
    "/api/students/00000000-0000-4000-8000-000000000001/report?from=2026-01-01&to=2026-01-31",
  );
  expect(exportResponse.status()).toBe(403);

  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("ADMIN logs in with username and is redirected away from Super Admin portal", async ({
  page,
}) => {
  const credentials = loadCredentials();
  await login(page, credentials.users.admin.username, credentials.password);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/super-admin/accounts");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("SUPER_ADMIN is isolated to the account portal", async ({ page }) => {
  const credentials = loadCredentials();
  await login(page, credentials.users.superAdmin.username, credentials.password);
  await expect(page).toHaveURL(/\/super-admin\/accounts$/);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/super-admin\/accounts$/);
});

test("login failures stay generic for missing, wrong-password, and inactive accounts", async ({
  page,
}) => {
  const credentials = loadCredentials();

  await login(page, "missing.account", credentials.password);
  await expect(
    page.getByText("Username atau password tidak valid.", { exact: true }),
  ).toBeVisible();

  await login(page, credentials.users.user.username, "Wrong!Password123");
  await expect(
    page.getByText("Username atau password tidak valid.", { exact: true }),
  ).toBeVisible();

  await login(page, credentials.users.inactive.username, credentials.password);
  await expect(
    page.getByText("Username atau password tidak valid.", { exact: true }),
  ).toBeVisible();
});

test("mandatory password change rejects reuse and accepts only the new password", async ({
  page,
}) => {
  const credentials = loadCredentials();
  await login(page, credentials.users.mustChange.username, credentials.password);
  await expect(page).toHaveURL(/\/change-password$/);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/change-password$/);

  await page.getByLabel("Password baru").fill(credentials.password);
  await page.getByLabel("Konfirmasi password").fill(credentials.password);
  await page.getByRole("button", { name: "Simpan Password" }).click();
  await expect(page).toHaveURL(/\/change-password\?error=same-password$/);
  await expect(
    page.getByText("Password baru harus berbeda dari password sementara atau password saat ini.", {
      exact: true,
    }),
  ).toBeVisible();

  await page.getByLabel("Password baru").fill(credentials.nextPassword);
  await page.getByLabel("Konfirmasi password").fill(credentials.nextPassword);
  await page.getByRole("button", { name: "Simpan Password" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await login(page, credentials.users.mustChange.username, credentials.password);
  await expect(
    page.getByText("Username atau password tidak valid.", { exact: true }),
  ).toBeVisible();

  await login(page, credentials.users.mustChange.username, credentials.nextPassword);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("external redirect target is rejected after login", async ({ page }) => {
  const credentials = loadCredentials();
  await page.goto("/login?redirectTo=https://example.test/steal");
  await page.getByLabel("Username").fill(credentials.users.admin.username);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Masuk" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
});

test("mobile operational navigation opens for USER without mutation menu", async ({ page }) => {
  const credentials = loadCredentials();
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, credentials.users.user.username, credentials.password);
  await page.getByRole("button", { name: "Buka navigasi" }).click();
  await expect(page.getByRole("navigation", { name: "Navigasi utama" })).toBeVisible();
  await expect(page.getByText("Input Presensi", { exact: true })).toHaveCount(0);
});
