import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

type Credentials = { password: string; users: { user: { username: string } } };
const credentials = () =>
  JSON.parse(readFileSync(resolve(".local/test-credentials.json"), "utf8")) as Credentials;

test("USER uses the date-driven dashboard and monthly calendar", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill(credentials().users.user.username);
  await page.getByLabel("Password", { exact: true }).fill(credentials().password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await expect(page.getByText("Siswa Tidak Hadir", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bulan sebelumnya" })).toBeVisible();
  await expect(page.getByText("Kembali ke hari ini", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Riwayat aktivitas", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Bulan sebelumnya" }).click();
  await expect(page).toHaveURL(/month=\d{4}-\d{2}-01/);
  await page.getByText("Tabel data grafik", { exact: true }).first().click();
  await expect(page.getByRole("columnheader", { name: "Tanpa Keterangan" })).toBeVisible();
  await page.getByText("Tabel data grafik", { exact: true }).first().click();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("Kalender dashboard")).toBeVisible();

  const renderedCharts = page.locator(".chart-scroll[data-chart-label-count]");
  await expect(renderedCharts.first()).toBeVisible();

  const renderedChartCount = await renderedCharts.count();
  expect(renderedChartCount).toBeGreaterThan(0);

  for (let index = 0; index < renderedChartCount; index += 1) {
    const chart = renderedCharts.nth(index);
    const expectedTickCount = Number(await chart.getAttribute("data-chart-label-count"));

    expect(expectedTickCount).toBeGreaterThan(0);

    // Recharts 3.x merender label X-axis pada z-index tick-label layer,
    // bukan sebagai descendant langsung dari .recharts-xAxis.
    await expect
      .poll(() =>
        chart.locator(".recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-label").count(),
      )
      .toBe(expectedTickCount);
  }

  for (let index = 0; index < renderedChartCount; index += 1) {
    const chart = renderedCharts.nth(index);

    // Grafik sudah aria-hidden dan memiliki tabel alternatif, sehingga Recharts
    // tidak boleh menambahkan application role atau tab stop pada SVG-nya.
    await expect(chart.locator('[role="application"]')).toHaveCount(0);
    await expect(chart.locator('[tabindex="0"]')).toHaveCount(0);

    const focusVisuals = await chart.evaluate((element) => {
      const selectors = [
        ".recharts-wrapper",
        "svg.recharts-surface",
        ".recharts-layer",
        ".recharts-rectangle",
      ];

      return selectors.flatMap((selector) => {
        const target = element.querySelector(selector);
        if (!(target instanceof SVGElement || target instanceof HTMLElement)) {
          return [];
        }

        const previousTabIndex = target.getAttribute("tabindex");
        target.setAttribute("tabindex", "0");
        target.focus();

        const style = getComputedStyle(target);
        const result = {
          selector,
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          outlineColor: style.outlineColor,
        };

        if (previousTabIndex === null) {
          target.removeAttribute("tabindex");
        } else {
          target.setAttribute("tabindex", previousTabIndex);
        }

        return [result];
      });
    });

    expect(focusVisuals.length).toBeGreaterThan(0);

    for (const visual of focusVisuals) {
      expect(
        visual.outlineStyle === "none" ||
          visual.outlineWidth === "0px" ||
          visual.outlineColor === "rgba(0, 0, 0, 0)",
      ).toBe(true);
    }
  }

  const chartScroll = page.locator('.chart-scroll[data-chart-title="Ketidakhadiran per kelas"]');
  await expect(chartScroll).toBeVisible();

  const chartMetrics = await chartScroll.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowX: getComputedStyle(element).overflowX,
  }));

  expect(chartMetrics.overflowX).toBe("auto");
  expect(chartMetrics.scrollWidth).toBeGreaterThan(chartMetrics.clientWidth);

  const chartBox = await chartScroll.boundingBox();
  expect(chartBox).not.toBeNull();

  if (chartBox) {
    await page.mouse.click(chartBox.x + chartBox.width / 2, chartBox.y + chartBox.height / 2);
  }

  await expect(chartScroll.locator('[role="application"]')).toHaveCount(0);
  await expect(chartScroll.locator('[tabindex="0"]')).toHaveCount(0);

  const focusedRechartsElements = await chartScroll.evaluate(
    (element) =>
      Array.from(element.querySelectorAll(":focus")).filter((focused) =>
        (focused.getAttribute("class") ?? "").includes("recharts"),
      ).length,
  );
  expect(focusedRechartsElements).toBe(0);

  await chartScroll.evaluate((element) => {
    element.scrollLeft = 160;
  });

  await expect.poll(() => chartScroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

  const pageMetrics = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  expect(pageMetrics.documentScrollWidth).toBeLessThanOrEqual(pageMetrics.viewportWidth + 1);
  expect(pageMetrics.bodyScrollWidth).toBeLessThanOrEqual(pageMetrics.viewportWidth + 1);
});
