import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

test.setTimeout(150_000);

type Role = "admin" | "user" | "superAdmin";
type Credentials = {
  password: string;
  users: Record<Role, { username: string }>;
};

const credentials = () =>
  JSON.parse(readFileSync(resolve(".local/test-credentials.json"), "utf8")) as Credentials;

const todayJakarta = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

async function login(page: Page, role: Role) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(credentials().users[role].username);
  await page.getByLabel("Password", { exact: true }).fill(credentials().password);
  await page.getByRole("button", { name: "Masuk" }).click();

  await expect(page).toHaveURL(role === "superAdmin" ? /\/super-admin\/accounts$/ : /\/dashboard$/);
}

async function createStudent(
  page: Page,
  input: {
    name: string;
    nis: string;
    nisn: string;
    grade: "X" | "XI" | "XII";
    className: string;
  },
) {
  await page.goto("/manajemen-siswa");
  await page.locator("#create-full-name").fill(input.name);
  await page.locator("#create-nis").fill(input.nis);
  await page.locator("#create-nisn").fill(input.nisn);
  await page.locator("#create-gender").selectOption("P");
  await page.locator("#create-year-entered").fill("2026");
  await page.locator("#create-grade").selectOption(input.grade);
  await page.locator("#create-class").selectOption({ label: input.className });
  await page.getByRole("button", { name: "Tambah siswa" }).click();
  await expect(page).toHaveURL(/\/siswa\/[0-9a-f-]+\?success=created$/);

  const id = new URL(page.url()).pathname.split("/").pop();
  if (!id) throw new Error(`Student id tidak ditemukan untuk ${input.name}.`);
  return id;
}

async function expectPlacement(
  page: Page,
  input: {
    id: string;
    name: string;
    grade: "X" | "XI" | "XII" | "ALUMNI";
    className: string;
  },
) {
  await page.goto(`/siswa/${input.id}`);
  await expect(page.getByRole("heading", { name: input.name })).toBeVisible();

  const grade = page
    .locator("dt")
    .filter({ hasText: /^Grade$/ })
    .locator("..")
    .locator("dd");
  const className = page
    .locator("dt")
    .filter({ hasText: /^Kelas$/ })
    .locator("..")
    .locator("dd");

  await expect(grade).toHaveText(input.grade);
  await expect(className).toHaveText(input.className);
}

async function previewAndApplyPromotion(page: Page, targetYearName: string) {
  await page.goto("/naik-turun-grade");
  await page.locator('select[name="academicYearId"]').selectOption({ label: targetYearName });
  await page.getByRole("button", { name: "Preview promotion" }).click();

  await expect(page).toHaveURL(/\/naik-turun-grade\?preview=/);
  await expect(
    page.getByText(`2026/2027 → ${targetYearName}`, { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText(/X → XI:/)).toBeVisible();
  await expect(page.getByText(/XI → XII:/)).toBeVisible();
  await expect(page.getByText(/XII → Alumni:/)).toBeVisible();
  await expect(
    page.getByText("Kelas tujuan belum lengkap. Promotion belum dapat dijalankan."),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Konfirmasi dan jalankan promotion" }).click();
  const dialog = page.getByRole("dialog", { name: "Jalankan promotion" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Ya, jalankan promotion" }).click();

  await expect(page).toHaveURL(/\/naik-turun-grade\?success=\d+$/);
  await expect(page.getByText(/siswa berhasil dipromosikan/)).toBeVisible();
}

test("USER and SUPER_ADMIN are blocked from every ADMIN-only operational route", async ({
  page,
}) => {
  const adminOnlyRoutes = [
    "/alumni",
    "/import-siswa",
    "/manajemen-kelas",
    "/manajemen-siswa",
    "/naik-turun-grade",
    "/pengaturan-awal",
    "/presensi/input",
    "/reports",
    "/riwayat-aktivitas",
  ];

  await login(page, "user");
  for (const route of adminOnlyRoutes) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/dashboard$/);
  }

  await page.getByRole("button", { name: "Keluar" }).click();
  await login(page, "superAdmin");

  for (const route of ["/dashboard", "/pencarian", "/siswa", ...adminOnlyRoutes]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/super-admin\/accounts$/);
  }
});

test("ADMIN sees browser validation for malformed, invalid, and oversized CSV imports", async ({
  page,
}) => {
  const suffix = Date.now().toString().slice(-7);
  const validName = `Import Tidak Tersimpan ${suffix}`;

  await login(page, "admin");
  await page.goto("/import-siswa");
  await page.getByLabel("Tahun ajaran aktif").selectOption({ label: "2026/2027" });
  await page.getByLabel("Kelas tujuan").selectOption({ label: "X-5" });
  await page.getByRole("button", { name: "Tambah file" }).click();

  const fileInput = page.locator('input[type="file"]');

  await fileInput.setInputFiles({
    name: "kutip-rusak.csv",
    mimeType: "text/csv",
    buffer: Buffer.from('NIS,NISN,NAMA,JENIS_KELAMIN\n950001,9950000001,"Nama Rusak,P\n'),
  });
  await expect(
    page.getByText("CSV tidak valid. Periksa header, kutip, dan jumlah baris."),
  ).toBeVisible();

  await fileInput.setInputFiles({
    name: "campuran-invalid.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      [
        "NIS,NISN,NAMA,JENIS_KELAMIN",
        `950${suffix},995${suffix},${validName},P`,
        "=1,9960000001,Siswa Formula,L",
      ].join("\n"),
    ),
  });

  await expect(page.getByRole("cell", { name: validName, exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Valid", exact: true })).toBeVisible();
  await expect(
    page.getByRole("cell", {
      name: "Data wajib valid dan tidak boleh berupa formula.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Simpan bulk import/ })).toBeDisabled();

  await fileInput.setInputFiles({
    name: "terlalu-besar.csv",
    mimeType: "text/csv",
    buffer: Buffer.alloc(1_000_001, "a"),
  });
  await expect(page.getByText("Ukuran file maksimum 1 MB.")).toBeVisible();

  await page.goto(`/siswa?q=${encodeURIComponent(validName)}&status=`);
  await expect(page.getByText("Tidak ada siswa yang sesuai filter.")).toBeVisible();
});

test("ADMIN exports a monthly grade workbook and filters its operational audit", async ({
  page,
}) => {
  const month = todayJakarta().slice(0, 7);

  await login(page, "admin");
  await page.goto("/reports");
  await expect(page.getByLabel("Jenis periode")).toHaveValue("monthly");
  await page.getByLabel("Grade").selectOption("XI");
  await page.getByLabel("Bulan").fill(month);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Excel" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe(`laporan-presensi_grade-XI_${month}.xlsx`);

  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    (await readFile(downloadPath!)) as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );

  expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
    "Ringkasan",
    ...Array.from({ length: 10 }, (_, index) => `XI-${index + 1}`),
  ]);

  await page.goto("/riwayat-aktivitas");
  await page.getByPlaceholder("Filter action").fill("GRADE_ATTENDANCE_EXPORT");
  await page.getByRole("button", { name: "Filter" }).click();

  await expect(page).toHaveURL(/action=GRADE_ATTENDANCE_EXPORT/);
  await expect(page.getByText("GRADE_ATTENDANCE_EXPORT", { exact: true }).first()).toBeVisible();

  await page.locator("summary").filter({ hasText: "Detail aman" }).first().click();
  await expect(page.locator("pre").first()).toContainText('"format": "xlsx"');
  await expect(page.locator("pre").first()).toContainText('"academic_year_name"');
});

test("ADMIN promotes, rolls back, archives, tombstones, and audits lifecycle changes", async ({
  page,
}) => {
  const suffix = Date.now().toString().slice(-7);
  const targetYearName = `2027/${suffix}`;

  const xStudent = {
    name: `Promotion X ${suffix}`,
    nis: `91${suffix}`,
    nisn: `991${suffix}`,
    grade: "X" as const,
    className: "X-4",
  };
  const xiStudent = {
    name: `Promotion XI ${suffix}`,
    nis: `92${suffix}`,
    nisn: `992${suffix}`,
    grade: "XI" as const,
    className: "XI-4",
  };
  const xiiStudent = {
    name: `Promotion XII ${suffix}`,
    nis: `93${suffix}`,
    nisn: `993${suffix}`,
    grade: "XII" as const,
    className: "XII-4",
  };

  await login(page, "admin");

  await page.goto("/naik-turun-grade");
  await page.getByLabel("Nama tahun tujuan").fill(targetYearName);
  await page.getByLabel("Tanggal mulai tahun tujuan").fill("2027-07-01");
  await page.getByLabel("Tanggal selesai tahun tujuan").fill("2028-06-30");
  await page.getByRole("button", { name: "Buat tahun tujuan dan preview" }).click();
  await expect(page).toHaveURL(/\/naik-turun-grade\?preview=.*created=year-created/);
  await expect(
    page.getByText("Tahun tujuan dan 30 kelas berhasil dibuat.", { exact: false }),
  ).toBeVisible();

  const xId = await createStudent(page, xStudent);
  const xiId = await createStudent(page, xiStudent);
  const xiiId = await createStudent(page, xiiStudent);

  await previewAndApplyPromotion(page, targetYearName);

  await expectPlacement(page, {
    id: xId,
    name: xStudent.name,
    grade: "XI",
    className: "XI-4",
  });
  await expectPlacement(page, {
    id: xiId,
    name: xiStudent.name,
    grade: "XII",
    className: "XII-4",
  });
  await expectPlacement(page, {
    id: xiiId,
    name: xiiStudent.name,
    grade: "ALUMNI",
    className: "Tidak ada",
  });

  await page.goto("/alumni");
  await expect(page.getByRole("link", { name: xiiStudent.name, exact: true })).toBeVisible();
  await expect(page.getByText("Lulus 2027").first()).toBeVisible();

  await page.goto("/naik-turun-grade");
  const completedBatch = page
    .getByText("COMPLETED", { exact: true })
    .locator("xpath=ancestor::section[1]");
  await completedBatch.getByRole("button", { name: "Rollback snapshot batch" }).click();

  const rollbackDialog = page.getByRole("dialog", { name: "Rollback promotion" });
  await expect(rollbackDialog).toBeVisible();
  await rollbackDialog.getByRole("button", { name: "Ya, rollback batch" }).click();

  await expect(page).toHaveURL(/\/naik-turun-grade\?rollback=\d+$/);
  await expect(page.getByText(/siswa berhasil dipulihkan/)).toBeVisible();

  const revertedBatch = page
    .getByText("REVERTED", { exact: true })
    .locator("xpath=ancestor::section[1]");
  await expect(revertedBatch).toBeVisible();
  await expect(revertedBatch.getByRole("button", { name: "Rollback snapshot batch" })).toHaveCount(
    0,
  );

  await expectPlacement(page, {
    id: xId,
    name: xStudent.name,
    grade: "X",
    className: "X-4",
  });
  await expectPlacement(page, {
    id: xiId,
    name: xiStudent.name,
    grade: "XI",
    className: "XI-4",
  });
  await expectPlacement(page, {
    id: xiiId,
    name: xiiStudent.name,
    grade: "XII",
    className: "XII-4",
  });

  await page.goto("/alumni");
  await expect(page.getByRole("link", { name: xiiStudent.name, exact: true })).toHaveCount(0);

  await page.goto("/riwayat-aktivitas");
  await page.getByPlaceholder("Filter action").fill("STUDENT_PROMOTION_ROLLBACK");
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(page.getByText("STUDENT_PROMOTION_ROLLBACK", { exact: true }).first()).toBeVisible();

  await previewAndApplyPromotion(page, targetYearName);

  await page.goto("/alumni");
  let alumniCard = page
    .getByRole("link", { name: xiiStudent.name, exact: true })
    .locator("xpath=ancestor::section[1]");
  await expect(alumniCard.getByText(/Aktif/)).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await alumniCard.getByRole("button", { name: "Arsipkan" }).click();
  await expect(page).toHaveURL(/\/alumni\?success=archived$/);
  await expect(page.getByText("Alumni berhasil diarsipkan.")).toBeVisible();

  alumniCard = page
    .getByRole("link", { name: xiiStudent.name, exact: true })
    .locator("xpath=ancestor::section[1]");
  await expect(alumniCard).toContainText("Diarsipkan");

  page.once("dialog", (dialog) => dialog.accept());
  await alumniCard.getByRole("button", { name: "Hapus identitas permanen" }).click();
  await expect(page).toHaveURL(/\/alumni\?success=tombstoned$/);
  await expect(
    page.getByText("Identitas alumni berhasil ditombstone. Histori tetap dipertahankan."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: xiiStudent.name, exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Alumni dihapus", exact: true })).toBeVisible();

  await page.goto("/riwayat-aktivitas");
  await page.getByPlaceholder("Filter action").fill("ALUMNI_TOMBSTONE");
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(page.getByText("ALUMNI_TOMBSTONE", { exact: true }).first()).toBeVisible();

  await page.locator("summary").filter({ hasText: "Detail aman" }).first().click();
  const safeDetail = page.locator("pre").first();
  await expect(safeDetail).toContainText('"tombstoned": true');
  await expect(safeDetail).not.toContainText(xiiStudent.name);
  await expect(safeDetail).not.toContainText(xiiStudent.nis);
  await expect(safeDetail).not.toContainText(xiiStudent.nisn);
});
