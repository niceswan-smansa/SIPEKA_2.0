import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

type Role = "admin" | "user";
type Credentials = {
  password: string;
  users: Record<Role, { username: string }>;
};

const credentials = () =>
  JSON.parse(readFileSync(resolve(".local/test-credentials.json"), "utf8")) as Credentials;

async function login(page: Page, role: Role) {
  const fixture = credentials();

  await page.goto("/login", { waitUntil: "networkidle" });

  const usernameInput = page.getByLabel("Username");
  const passwordInput = page.getByLabel("Password", { exact: true });

  await usernameInput.fill(fixture.users[role].username);
  await passwordInput.fill(fixture.password);

  await expect(usernameInput).toHaveValue(fixture.users[role].username);
  await expect(passwordInput).toHaveValue(fixture.password);

  const submitButton = page.getByRole("button", { name: "Masuk" });
  await expect(submitButton).toBeEnabled();

  const loginForm = page.locator("form").filter({ has: submitButton });
  await expect(loginForm).toHaveCount(1);

  await loginForm.evaluate((element) => {
    if (!(element instanceof HTMLFormElement)) {
      throw new Error("Login form tidak ditemukan.");
    }
    element.requestSubmit();
  });

  await waitForPathname(page, "/dashboard");
}

async function waitForPathname(page: Page, expectedRoute: string) {
  await expect
    .poll(() => new URL(page.url()).pathname, {
      timeout: 7_500,
    })
    .toBe(expectedRoute);
}

async function navigateCrossBrowser(page: Page, route: string, expectedRoute = route) {
  if (new URL(page.url()).pathname === expectedRoute) {
    await page.waitForLoadState("domcontentloaded");
    return;
  }

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(route, { waitUntil: "domcontentloaded" });
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      if (!error.message.includes("NS_BINDING_ABORTED")) throw error;
      lastError = error;
    }

    try {
      await waitForPathname(page, expectedRoute);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    if (attempt === 0) {
      await page.waitForTimeout(250);
    }
  }

  throw lastError ?? new Error(`Navigasi ${route} tidak mencapai ${expectedRoute}`);
}

async function expectHealthyPage(page: Page, route: string) {
  await navigateCrossBrowser(page, route);
  await waitForPathname(page, route);
  await expect(page.getByText("Application error")).toHaveCount(0);
}

test("public landing, login, and anonymous guard work across browsers", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "SIPEKA" })).toBeVisible();
  const startLink = page.getByRole("link", { name: "Mulai" });
  await expect(startLink).toHaveAttribute("href", "/login");
  await navigateCrossBrowser(page, "/login");
  await waitForPathname(page, "/login");

  await navigateCrossBrowser(page, "/dashboard", "/login");
  await expect(page).toHaveURL(/\/login/);
});

test("ADMIN read-only page rendering and native controls work across browsers", async ({
  page,
}) => {
  await login(page, "admin");

  for (const route of [
    "/dashboard",
    "/siswa",
    "/presensi/input",
    "/import-siswa",
    "/reports",
    "/naik-turun-grade",
    "/alumni",
    "/riwayat-aktivitas",
  ])
    await expectHealthyPage(page, route);

  await navigateCrossBrowser(page, "/import-siswa");
  await expect(page.getByLabel("Tahun ajaran aktif")).toBeVisible();
  await page.getByLabel("Kelas tujuan").selectOption({ label: "X-1" });
  await page.getByRole("button", { name: "Tambah file" }).click();
  await expect(page.getByLabel("File CSV")).toBeVisible();

  await navigateCrossBrowser(page, "/reports");
  await expect(page.getByLabel("Jenis periode")).toBeVisible();
  await expect(page.getByLabel("Bulan")).toHaveAttribute("type", "month");

  await navigateCrossBrowser(page, "/naik-turun-grade");
  await expect(page.locator('select[name="academicYearId"]')).toBeVisible();
});

test("USER read-only routes work and ADMIN-only route remains blocked across browsers", async ({
  page,
}) => {
  await login(page, "user");
  await expectHealthyPage(page, "/dashboard");
  await expectHealthyPage(page, "/siswa");

  await navigateCrossBrowser(page, "/presensi/input", "/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
});
