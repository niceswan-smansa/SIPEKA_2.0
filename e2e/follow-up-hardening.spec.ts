import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

type Credentials = {
  password: string;
  users: { admin: { username: string } };
};

const credentials = () =>
  JSON.parse(readFileSync(resolve(".local/test-credentials.json"), "utf8")) as Credentials;

test("ADMIN can open the alumni page without a parser failure", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill(credentials().users.admin.username);
  await page.getByLabel("Password", { exact: true }).fill(credentials().password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/alumni");
  await expect(page).toHaveURL(/\/alumni$/);
  await expect(page.getByRole("heading", { name: "Alumni" })).toBeVisible();
  await expect(page.getByText("Application error")).toHaveCount(0);
});
