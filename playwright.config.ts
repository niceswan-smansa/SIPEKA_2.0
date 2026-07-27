import { defineConfig, devices } from "@playwright/test";

const crossBrowserSmoke = /cross-browser-smoke\.spec\.ts/;
const performanceSmoke = /performance-smoke\.spec\.ts/;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: [crossBrowserSmoke, performanceSmoke],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox-smoke",
      testMatch: crossBrowserSmoke,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit-smoke",
      testMatch: crossBrowserSmoke,
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "performance",
      testMatch: performanceSmoke,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: process.env.PLAYWRIGHT_WEBSERVER_COMMAND ?? "npm run dev:local",
    url: process.env.PLAYWRIGHT_WEBSERVER_URL ?? "http://127.0.0.1:3000",
    ignoreHTTPSErrors: true,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "true",
  },
});
