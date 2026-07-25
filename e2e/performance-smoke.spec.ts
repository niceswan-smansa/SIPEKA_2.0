import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

type Credentials = {
  password: string;
  users: { admin: { username: string } };
};

const credentials = () =>
  JSON.parse(readFileSync(resolve(".local/test-credentials.json"), "utf8")) as Credentials;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(credentials().users.admin.username);
  await page.getByLabel("Password", { exact: true }).fill(credentials().password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

function percentile(values: number[], fraction: number) {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * fraction) - 1)];
}

test("authenticated read load stays inside the local performance budget", async ({ page }) => {
  test.setTimeout(180_000);

  const concurrency = Number(process.env.PERF_CONCURRENCY ?? "5");
  const rounds = Number(process.env.PERF_ROUNDS ?? "3");
  const p95LimitMs = Number(process.env.PERF_P95_MS ?? "6000");
  const routes = ["/dashboard", "/siswa", "/reports", "/presensi/input"];

  expect(concurrency).toBeGreaterThan(0);
  expect(rounds).toBeGreaterThan(0);
  expect(p95LimitMs).toBeGreaterThan(0);

  await login(page);
  const request = page.context().request;

  for (const route of routes) {
    await page.goto(route);
    await expect(page.getByText("Application error")).toHaveCount(0);

    const durations: number[] = [];
    for (let round = 0; round < rounds; round += 1) {
      const batch = await Promise.all(
        Array.from({ length: concurrency }, async () => {
          const started = performance.now();
          const response = await request.get(route);
          const body = await response.body();
          expect(response.ok(), `${route} returned ${response.status()}`).toBeTruthy();
          expect(body.byteLength).toBeGreaterThan(0);
          return performance.now() - started;
        }),
      );
      durations.push(...batch);
    }

    const p50 = percentile(durations, 0.5);
    const p95 = percentile(durations, 0.95);
    // SIPEKA: percentile results are defined before numeric formatting.
    if (p50 === undefined || p95 === undefined) {
      throw new Error(`[performance] ${route} did not collect percentile samples`);
    }
    console.log(
      `[performance] ${route} requests=${durations.length} p50=${p50.toFixed(0)}ms p95=${p95.toFixed(0)}ms limit=${p95LimitMs}ms`,
    );
    expect(p95, `${route} p95 terlalu lambat`).toBeLessThanOrEqual(p95LimitMs);
  }
});
