import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Database } from "../src/infrastructure/supabase/database.types";

test.setTimeout(7_200_000);
expect.configure({ timeout: 30_000 });
const simulationEnabled = process.env.SIPEKA_REALISTIC_SCHOOL_SIMULATION === "true";

type Grade = "X" | "XI" | "XII";
type DbClient = SupabaseClient<Database>;
type AttendanceInsert = Database["public"]["Tables"]["attendance_records"]["Insert"];
type PublicTableName = keyof Database["public"]["Tables"];
type ClassRow = {
  id: string;
  grade: Grade;
  class_number: number;
  academic_year_id: string;
};
type StudentRow = {
  id: string;
  full_name: string;
  nis: string | null;
  nisn: string | null;
  current_class_id: string | null;
  current_grade: Grade | "ALUMNI";
  is_active: boolean;
};
type EnrollmentRow = {
  id: string;
  student_id: string;
  academic_year_id: string;
  class_id: string;
  started_on: string;
  ended_on: string | null;
  is_current: boolean;
};
type Credentials = {
  password: string;
  users: { admin: { id: string; username: string } };
};
type YearSpec = {
  name: string;
  startDate: string;
  endDate: string;
  cohort: number;
  breaks: Array<[string, string]>;
};
type MovementRecord = {
  studentId: string;
  effectiveDate: string;
  fromClassId?: string;
  toClassId?: string;
};

const REPO_ROOT = resolve(".");
const credentials = () =>
  JSON.parse(readFileSync(resolve(".local/test-credentials.json"), "utf8")) as Credentials;

const years: YearSpec[] = [
  {
    name: "2023/2024",
    startDate: "2023-07-17",
    endDate: "2024-06-14",
    cohort: 1,
    breaks: [
      ["2023-12-18", "2024-01-05"],
      ["2024-04-08", "2024-04-19"],
    ],
  },
  {
    name: "2024/2025",
    startDate: "2024-07-15",
    endDate: "2025-06-13",
    cohort: 2,
    breaks: [
      ["2024-12-16", "2025-01-03"],
      ["2025-03-24", "2025-04-04"],
    ],
  },
  {
    name: "2025/2026",
    startDate: "2025-07-14",
    endDate: "2026-06-12",
    cohort: 3,
    breaks: [
      ["2025-12-15", "2026-01-02"],
      ["2026-03-16", "2026-03-27"],
    ],
  },
  {
    name: "2026/2027",
    startDate: "2026-07-01",
    endDate: "2027-06-30",
    cohort: 4,
    breaks: [],
  },
];

const gradeCode = (grade: Grade) => ({ X: 1, XI: 2, XII: 3 })[grade];
const classLabel = (grade: Grade, classNumber: number) => `${grade}-${classNumber}`;
const studentName = (cohort: number, grade: Grade, classNumber: number, index: number) =>
  `Simulasi C${cohort} ${grade}-${classNumber} S${String(index).padStart(2, "0")}`;

function identifiers(cohort: number, grade: Grade, classNumber: number, index: number) {
  const serial = `${cohort}${gradeCode(grade)}${String(classNumber).padStart(2, "0")}${String(
    index,
  ).padStart(2, "0")}`;
  return {
    nis: `7${serial}`,
    nisn: `9${serial}000`,
  };
}

function parseEnvironment(output: string) {
  return Object.fromEntries(
    output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1).replace(/^"|"$/g, "")];
      }),
  );
}

function localSupabaseEnvironment() {
  const executable = resolve(
    "node_modules",
    ".bin",
    process.platform === "win32" ? "supabase.cmd" : "supabase",
  );
  const result = spawnSync(executable, ["status", "-o", "env"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      SUPABASE_TELEMETRY_DISABLED: "1",
      DO_NOT_TRACK: "1",
    },
  });

  if (result.status !== 0) {
    throw new Error(`Supabase lokal tidak dapat dibaca: ${result.stderr}`);
  }

  const environment = parseEnvironment(result.stdout);
  const url = environment.API_URL;
  const serviceRoleKey = environment.SERVICE_ROLE_KEY ?? environment.SECRET_KEY;
  const publicKey = environment.ANON_KEY ?? environment.PUBLISHABLE_KEY;

  if (!url || !serviceRoleKey || !publicKey) {
    throw new Error("Environment Supabase lokal tidak lengkap.");
  }

  const hostname = new URL(url).hostname;
  if (!["127.0.0.1", "localhost"].includes(hostname)) {
    throw new Error("Simulasi hanya boleh memakai Supabase lokal.");
  }

  return { url, serviceRoleKey, publicKey };
}

function unwrap<T>(
  label: string,
  result: { data: T | null; error: { message: string } | null },
): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${label}: data kosong`);
  return result.data;
}

function previousDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function inRange(date: string, [start, end]: [string, string]) {
  return date >= start && date <= end;
}

function schoolDays(spec: YearSpec, limit = 180) {
  const days: string[] = [];
  const current = new Date(`${spec.startDate}T00:00:00Z`);
  const end = new Date(`${spec.endDate}T00:00:00Z`);

  while (current <= end && days.length < limit) {
    const iso = current.toISOString().slice(0, 10);
    const day = current.getUTCDay();
    if (day !== 0 && day !== 6 && !spec.breaks.some((range) => inRange(iso, range))) {
      days.push(iso);
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  if (days.length !== limit) {
    throw new Error(`${spec.name} hanya menghasilkan ${days.length} hari sekolah.`);
  }
  return days;
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(credentials().users.admin.username);
  await page.getByLabel("Password", { exact: true }).fill(credentials().password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function createAuthenticatedAdminClient() {
  const local = localSupabaseEnvironment();
  const service = createClient<Database>(local.url, local.serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const admin = credentials().users.admin;
  const authResult = await service.auth.admin.getUserById(admin.id);
  if (authResult.error) {
    throw new Error(`Membaca Auth Admin: ${authResult.error.message}`);
  }
  const authUser = authResult.data.user;

  if (!authUser?.email) throw new Error("Synthetic email Admin tidak ditemukan.");

  const session = createClient<Database>(local.url, local.publicKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const signIn = await session.auth.signInWithPassword({
    email: authUser.email,
    password: credentials().password,
  });
  if (signIn.error) throw new Error(`Login API Admin gagal: ${signIn.error.message}`);

  return { service, session, adminId: admin.id };
}

async function ensureSimulationYears(session: DbClient) {
  for (const spec of years.slice(0, 3)) {
    const existing = await session
      .from("academic_years")
      .select("id")
      .eq("name", spec.name)
      .maybeSingle();
    if (existing.error) throw new Error(`Lookup ${spec.name}: ${existing.error.message}`);

    if (!existing.data) {
      const result = await session.rpc("phase3_create_academic_year", {
        p_name: spec.name,
        p_start_date: spec.startDate,
        p_end_date: spec.endDate,
        p_is_active: false,
      });
      if (result.error) throw new Error(`Membuat ${spec.name}: ${result.error.message}`);
    }
  }

  const firstYear = unwrap<{ id: string }>(
    "Membaca tahun awal",
    await session.from("academic_years").select("id").eq("name", years[0]!.name).single(),
  );

  const activate = await session.rpc("phase3_activate_academic_year", {
    p_id: firstYear.id,
  });
  if (activate.error) throw new Error(`Aktivasi ${years[0]!.name}: ${activate.error.message}`);
}

async function getYearId(service: DbClient, yearName: string): Promise<string> {
  const selectedYear = unwrap<{ id: string }>(
    `Membaca tahun ${yearName}`,
    await service.from("academic_years").select("id").eq("name", yearName).single(),
  );

  return selectedYear.id;
}

async function getClasses(service: DbClient, yearName: string): Promise<ClassRow[]> {
  const yearId = await getYearId(service, yearName);
  const rows = unwrap(
    `Membaca kelas ${yearName}`,
    await service
      .from("classes")
      .select("id, grade, class_number, academic_year_id")
      .eq("academic_year_id", yearId)
      .order("grade")
      .order("class_number"),
  ) as ClassRow[];

  if (rows.length !== 30) throw new Error(`${yearName} memiliki ${rows.length} kelas.`);
  return rows;
}

function buildCsv(cohort: number, grade: Grade, classNumber: number, count = 34) {
  const rows = ["NIS,NISN,NAMA,JENIS_KELAMIN"];
  for (let index = 1; index <= count; index += 1) {
    const id = identifiers(cohort, grade, classNumber, index);
    rows.push(
      [
        id.nis,
        id.nisn,
        studentName(cohort, grade, classNumber, index),
        index % 2 === 0 ? "L" : "P",
      ].join(","),
    );
  }
  return rows.join("\n");
}

async function importClassThroughUi(page: Page, spec: YearSpec, grade: Grade, classNumber: number) {
  await page.goto("/import-siswa");
  await page.getByLabel("Tahun ajaran aktif").selectOption({ label: spec.name });
  await page.getByLabel("Kelas tujuan").selectOption({ label: classLabel(grade, classNumber) });
  await page.getByRole("button", { name: "Tambah file" }).click();

  await page.getByLabel("File CSV").setInputFiles({
    name: `simulasi-${spec.name.replace("/", "-")}-${grade}-${classNumber}.csv`,
    mimeType: "text/csv",
    buffer: Buffer.from(buildCsv(spec.cohort, grade, classNumber)),
  });

  await expect(page.getByText("34 baris dipreview.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Simpan bulk import 34 siswa dari 1 file" }).click();
  await expect(page).toHaveURL(/\/import-siswa\?success=34$/);
  await expect(page.getByText("34 siswa berhasil diimport.", { exact: true })).toBeVisible();
}

async function importGradesThroughUi(page: Page, spec: YearSpec, grades: Grade[]) {
  for (const grade of grades) {
    for (let classNumber = 1; classNumber <= 10; classNumber += 1) {
      console.log(`[simulation] UI import ${spec.name} ${classLabel(grade, classNumber)}`);
      await importClassThroughUi(page, spec, grade, classNumber);
    }
  }
}

async function classRoster(service: DbClient, classId: string): Promise<StudentRow[]> {
  return unwrap(
    `Membaca roster ${classId}`,
    await service
      .from("students")
      .select("id, full_name, nis, nisn, current_class_id, current_grade, is_active")
      .eq("current_class_id", classId)
      .eq("is_active", true)
      .order("nis"),
  ) as StudentRow[];
}

async function rosterMap(
  service: DbClient,
  classes: ClassRow[],
): Promise<Map<string, StudentRow[]>> {
  const result = new Map<string, StudentRow[]>();
  for (const item of classes) {
    const roster = await classRoster(service, item.id);
    if (roster.length < 3) {
      throw new Error(
        `${classLabel(item.grade, item.class_number)} hanya memiliki ${roster.length}.`,
      );
    }
    result.set(item.id, roster);
  }
  return result;
}

function absenceRows(
  date: string,
  classes: ClassRow[],
  rosters: Map<string, StudentRow[]>,
  adminId: string,
) {
  const rows: AttendanceInsert[] = [];

  for (const item of classes) {
    const roster = rosters.get(item.id)!;
    const dateNumber = Number(date.replaceAll("-", ""));
    const base = (dateNumber + item.class_number * 7 + gradeCode(item.grade) * 11) % roster.length;
    const sick = roster[base]!;
    const permit = roster[(base + 7) % roster.length]!;
    const unexplained = roster[(base + 13) % roster.length]!;

    for (let period = 1; period <= 10; period += 1) {
      rows.push({
        student_id: sick.id,
        class_id: item.id,
        attendance_date: date,
        period_number: period,
        status: "SAKIT",
        note: "Simulasi harian: sakit",
        version: 1,
        created_by: adminId,
        updated_by: adminId,
      });
    }
    for (let period = 1; period <= 4; period += 1) {
      rows.push({
        student_id: permit.id,
        class_id: item.id,
        attendance_date: date,
        period_number: period,
        status: "IZIN",
        note: "Simulasi harian: izin",
        version: 1,
        created_by: adminId,
        updated_by: adminId,
      });
    }
    for (let period = 5; period <= 10; period += 1) {
      rows.push({
        student_id: unexplained.id,
        class_id: item.id,
        attendance_date: date,
        period_number: period,
        status: "TANPA_KETERANGAN",
        note: "Simulasi harian: tanpa keterangan",
        version: 1,
        created_by: adminId,
        updated_by: adminId,
      });
    }
  }

  return rows;
}

async function seedAttendanceDates(
  service: DbClient,
  classes: ClassRow[],
  dates: string[],
  adminId: string,
) {
  const rosters = await rosterMap(service, classes);

  for (const [index, date] of dates.entries()) {
    const rows = absenceRows(date, classes, rosters, adminId);
    const insert = await service.from("attendance_records").insert(rows);
    if (insert.error) throw new Error(`Fixture presensi ${date}: ${insert.error.message}`);

    if ((index + 1) % 15 === 0 || index + 1 === dates.length) {
      console.log(`[simulation] fixture presensi ${index + 1}/${dates.length} hari`);
    }
  }
}

async function inputAttendanceAllClassesThroughUi(
  page: Page,
  service: DbClient,
  classes: ClassRow[],
  date: string,
) {
  for (const item of classes) {
    const roster = await classRoster(service, item.id);
    const [sick, permit, unexplained] = roster;

    await page.goto(`/presensi/input?date=${date}&classId=${item.id}`);
    await expect(page.getByRole("heading", { name: "Input Presensi" })).toBeVisible();

    for (let period = 1; period <= 10; period += 1) {
      await page
        .getByLabel(`${sick!.full_name} Jam ${period}`, { exact: true })
        .selectOption("SAKIT");
    }
    for (let period = 1; period <= 4; period += 1) {
      await page
        .getByLabel(`${permit!.full_name} Jam ${period}`, { exact: true })
        .selectOption("IZIN");
    }
    for (let period = 5; period <= 10; period += 1) {
      await page
        .getByLabel(`${unexplained!.full_name} Jam ${period}`, { exact: true })
        .selectOption("TANPA_KETERANGAN");
    }

    await page
      .getByLabel(`Catatan ${sick!.full_name}`, { exact: true })
      .fill("Verifikasi UI harian");
    await expect(page.getByText("20 perubahan", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Preview Presensi" }).click();
    await expect(page.getByRole("heading", { name: "Preview perubahan" })).toBeVisible();
    await expect(page.getByText(/Baru 20/)).toBeVisible();
    await page.getByRole("button", { name: "Konfirmasi dan Simpan" }).click();
    await expect(page.getByText(/Presensi berhasil disimpan/)).toBeVisible();

    console.log(`[simulation] UI presensi ${date} ${classLabel(item.grade, item.class_number)}`);
  }
}

async function studentByName(service: DbClient, name: string): Promise<StudentRow> {
  return unwrap(
    `Membaca siswa ${name}`,
    await service
      .from("students")
      .select("id, full_name, nis, nisn, current_class_id, current_grade, is_active")
      .eq("full_name", name)
      .single(),
  ) as StudentRow;
}

async function createIncomingThroughUi(
  page: Page,
  spec: YearSpec,
  grade: Grade,
  classNumber: number,
  cycle: number,
) {
  const code = gradeCode(grade);
  const name = `Simulasi Masuk Tahun ${cycle} Grade ${grade}`;
  const nis = `78${cycle}${code}500`;
  const nisn = `98${cycle}${code}500000`;

  await page.goto("/manajemen-siswa");
  await page.locator("#create-full-name").fill(name);
  await page.locator("#create-nis").fill(nis);
  await page.locator("#create-nisn").fill(nisn);
  await page.locator("#create-gender").selectOption(code % 2 === 0 ? "L" : "P");
  await page
    .locator("#create-year-entered")
    .fill(String(Number(spec.startDate.slice(0, 4)) - code + 1));
  await page.locator("#create-grade").selectOption(grade);
  await page.locator("#create-class").selectOption({ label: classLabel(grade, classNumber) });
  await page.getByRole("button", { name: "Tambah siswa" }).click();
  await expect(page).toHaveURL(/\/siswa\/[0-9a-f-]+\?success=created$/);

  const studentId = new URL(page.url()).pathname.split("/").pop();
  if (!studentId) throw new Error(`ID siswa masuk ${name} tidak ditemukan.`);
  return { studentId, name };
}

async function openStudentEditor(page: Page, name: string) {
  await page.goto(`/manajemen-siswa?q=${encodeURIComponent(name)}&status=active`);
  const nameCell = page.getByRole("cell", { name, exact: true });
  await expect(nameCell).toBeVisible();
  const row = nameCell.locator("..");
  await row.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("heading", { name: `Edit ${name}` })).toBeVisible();
}

async function readStudentMutationState(service: DbClient, studentId: string) {
  const result = await service
    .from("students")
    .select("current_class_id, current_grade, is_active")
    .eq("id", studentId)
    .single();

  if (result.error) {
    throw new Error(`Membaca state siswa ${studentId}: ${result.error.message}`);
  }

  return result.data as {
    current_class_id: string | null;
    current_grade: Grade | "ALUMNI";
    is_active: boolean;
  };
}

async function transferThroughUi(
  page: Page,
  service: DbClient,
  studentId: string,
  name: string,
  grade: Grade,
  destinationClass: string,
  destinationClassId: string,
) {
  await openStudentEditor(page, name);
  await page.locator("#edit-grade").selectOption(grade);
  await page.locator("#edit-class").selectOption({ label: destinationClass });
  await page.getByRole("button", { name: "Simpan grade / kelas" }).click();

  await expect
    .poll(
      async () => {
        const state = await readStudentMutationState(service, studentId);
        return {
          classId: state.current_class_id,
          grade: state.current_grade,
          isActive: state.is_active,
        };
      },
      {
        message: `Menunggu hasil pindah kelas ${name}`,
        timeout: 30_000,
      },
    )
    .toEqual({
      classId: destinationClassId,
      grade,
      isActive: true,
    });

  await page.goto(`/manajemen-siswa?student=${studentId}&status=active`);
  await expect(page.getByRole("heading", { name: `Edit ${name}` })).toBeVisible();
  await expect(page.locator("#edit-grade")).toHaveValue(grade);
  await expect(page.locator("#edit-class")).toHaveValue(destinationClassId);
}

async function deactivateThroughUi(page: Page, service: DbClient, studentId: string, name: string) {
  await openStudentEditor(page, name);
  await page.getByRole("button", { name: "Nonaktifkan siswa" }).click();
  const dialog = page.getByRole("dialog", { name: "Nonaktifkan siswa" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Konfirmasi" }).click();

  await expect
    .poll(async () => (await readStudentMutationState(service, studentId)).is_active, {
      message: `Menunggu hasil nonaktifkan ${name}`,
      timeout: 30_000,
    })
    .toBe(false);

  await page.goto(`/manajemen-siswa?student=${studentId}&status=inactive`);
  await expect(page.getByRole("heading", { name: `Edit ${name}` })).toBeVisible();
  await expect(page.getByRole("button", { name: "Aktifkan siswa" })).toBeVisible();
}

async function currentEnrollment(service: DbClient, studentId: string): Promise<EnrollmentRow> {
  return unwrap(
    `Membaca current enrollment ${studentId}`,
    await service
      .from("student_enrollments")
      .select("id, student_id, academic_year_id, class_id, started_on, ended_on, is_current")
      .eq("student_id", studentId)
      .eq("is_current", true)
      .single(),
  ) as EnrollmentRow;
}

async function backdateIncoming(service: DbClient, studentId: string, effectiveDate: string) {
  const enrollment = await currentEnrollment(service, studentId);
  const update = await service
    .from("student_enrollments")
    .update({ started_on: effectiveDate })
    .eq("id", enrollment.id);
  if (update.error) throw new Error(`Backdate siswa masuk: ${update.error.message}`);
}

async function closeOutgoingEnrollment(
  service: DbClient,
  studentId: string,
  effectiveDate: string,
) {
  const enrollment = await currentEnrollment(service, studentId);
  const update = await service
    .from("student_enrollments")
    .update({ is_current: false, ended_on: previousDate(effectiveDate) })
    .eq("id", enrollment.id);
  if (update.error) throw new Error(`Menutup enrollment siswa keluar: ${update.error.message}`);
}

async function backdateTransfer(
  service: DbClient,
  studentId: string,
  fromClassId: string,
  toClassId: string,
  effectiveDate: string,
) {
  const enrollments = unwrap(
    `Membaca enrollment transfer ${studentId}`,
    await service
      .from("student_enrollments")
      .select("id, student_id, academic_year_id, class_id, started_on, ended_on, is_current")
      .eq("student_id", studentId),
  ) as EnrollmentRow[];

  const oldEnrollment = enrollments.find((item) => item.class_id === fromClassId);
  const newEnrollment = enrollments.find((item) => item.class_id === toClassId && item.is_current);
  if (!oldEnrollment || !newEnrollment) throw new Error("Enrollment transfer tidak lengkap.");

  const close = await service
    .from("student_enrollments")
    .update({ is_current: false, ended_on: previousDate(effectiveDate) })
    .eq("id", oldEnrollment.id);
  if (close.error) throw new Error(`Backdate kelas lama: ${close.error.message}`);

  const open = await service
    .from("student_enrollments")
    .update({ is_current: true, started_on: effectiveDate, ended_on: null })
    .eq("id", newEnrollment.id);
  if (open.error) throw new Error(`Backdate kelas baru: ${open.error.message}`);
}

async function applyMidyearMovementsThroughUi(
  page: Page,
  service: DbClient,
  spec: YearSpec,
  classes: ClassRow[],
  cycle: number,
  effectiveDate: string,
) {
  const incoming: MovementRecord[] = [];
  const outgoing: MovementRecord[] = [];
  const transfers: MovementRecord[] = [];

  for (const grade of ["X", "XI", "XII"] as const) {
    const class1 = classes.find((item) => item.grade === grade && item.class_number === 1)!;
    const class2 = classes.find((item) => item.grade === grade && item.class_number === 2)!;
    const class5 = classes.find((item) => item.grade === grade && item.class_number === 5)!;
    const class5RosterBeforeIncoming = await classRoster(service, class5.id);
    const outgoingStudent = class5RosterBeforeIncoming.at(-1)!;

    const incomingUi = await createIncomingThroughUi(page, spec, grade, 5, cycle);
    await backdateIncoming(service, incomingUi.studentId, effectiveDate);
    expect(
      outgoingStudent.id,
      "Siswa masuk dan keluar tidak boleh sama pada satu siklus.",
    ).not.toBe(incomingUi.studentId);
    incoming.push({ studentId: incomingUi.studentId, effectiveDate, toClassId: class5.id });

    const class1Roster = await classRoster(service, class1.id);
    const transferStudent = class1Roster[0]!;
    await transferThroughUi(
      page,
      service,
      transferStudent.id,
      transferStudent.full_name,
      grade,
      classLabel(grade, 2),
      class2.id,
    );
    await backdateTransfer(service, transferStudent.id, class1.id, class2.id, effectiveDate);
    transfers.push({
      studentId: transferStudent.id,
      effectiveDate,
      fromClassId: class1.id,
      toClassId: class2.id,
    });

    await deactivateThroughUi(page, service, outgoingStudent.id, outgoingStudent.full_name);
    await closeOutgoingEnrollment(service, outgoingStudent.id, effectiveDate);
    outgoing.push({
      studentId: outgoingStudent.id,
      effectiveDate,
      fromClassId: class5.id,
    });
  }

  return { incoming, outgoing, transfers };
}

async function verifyClassDashboardUi(
  page: Page,
  service: DbClient,
  yearName: string,
  classRow: ClassRow,
  date: string,
) {
  const yearId = await getYearId(service, yearName);
  await page.goto(
    `/pencarian?tab=kelas&year=${yearId}&classId=${classRow.id}&date=${date}&month=${date.slice(
      0,
      7,
    )}-01`,
  );
  await expect(page.getByRole("heading", { name: "Total (3)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sakit (1)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Izin (1)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tanpa Keterangan (1)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tren bulanan kelas" })).toBeVisible();
}

async function promoteThroughUi(page: Page, targetYearName: string, expectedCount: number) {
  await page.goto("/naik-turun-grade");
  await page.locator('select[name="academicYearId"]').selectOption({ label: targetYearName });
  await page.getByRole("button", { name: "Preview promotion" }).click();

  await expect(page).toHaveURL(/\/naik-turun-grade\?preview=/);
  await expect(page.getByText(`Total: ${expectedCount}`, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Konfirmasi dan jalankan promotion" }).click();

  const dialog = page.getByRole("dialog", { name: "Jalankan promotion" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Ya, jalankan promotion" }).click();

  await expect(page).toHaveURL(new RegExp(`/naik-turun-grade\\?success=${expectedCount}$`));
  await expect(
    page.getByText(`${expectedCount} siswa berhasil dipromosikan.`, { exact: true }),
  ).toBeVisible();
}

async function exactCount(
  service: DbClient,
  table: PublicTableName,
  filters: Array<[string, string | boolean]> = [],
) {
  let query = service.from(table).select("*", { count: "exact", head: true });
  for (const [column, value] of filters) query = query.eq(column, value);
  const result = await query;
  if (result.error) throw new Error(`Count ${table}: ${result.error.message}`);
  return result.count ?? 0;
}

async function verifyMovementAttendanceBoundaries(
  service: DbClient,
  movements: {
    incoming: MovementRecord[];
    outgoing: MovementRecord[];
    transfers: MovementRecord[];
  },
) {
  for (const item of movements.incoming) {
    const count = await exactCount(service, "attendance_records", [["student_id", item.studentId]]);
    const before = await service
      .from("attendance_records")
      .select("*", { count: "exact", head: true })
      .eq("student_id", item.studentId)
      .lt("attendance_date", item.effectiveDate);
    if (before.error) throw new Error(before.error.message);
    expect(before.count ?? 0).toBe(0);
    expect(count).toBeGreaterThan(0);
  }

  for (const item of movements.outgoing) {
    const after = await service
      .from("attendance_records")
      .select("*", { count: "exact", head: true })
      .eq("student_id", item.studentId)
      .gte("attendance_date", item.effectiveDate);
    if (after.error) throw new Error(after.error.message);
    expect(after.count ?? 0).toBe(0);
  }

  for (const item of movements.transfers) {
    const oldClassAfter = await service
      .from("attendance_records")
      .select("*", { count: "exact", head: true })
      .eq("student_id", item.studentId)
      .eq("class_id", item.fromClassId!)
      .gte("attendance_date", item.effectiveDate);
    if (oldClassAfter.error) throw new Error(oldClassAfter.error.message);
    expect(oldClassAfter.count ?? 0).toBe(0);
  }
}

async function attachMilestone(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(`${name}.png`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

test("ADMIN menjalankan simulasi realistis tiga tahun melalui UI dan data harian", async ({
  page,
}, testInfo) => {
  test.skip(
    !simulationEnabled,
    "Simulasi sekolah tiga tahun hanya berjalan melalui command khusus database disposable.",
  );

  const { service, session, adminId } = await createAuthenticatedAdminClient();
  await ensureSimulationYears(session);
  await login(page);

  const allMovements: {
    incoming: MovementRecord[];
    outgoing: MovementRecord[];
    transfers: MovementRecord[];
  } = { incoming: [], outgoing: [], transfers: [] };

  await importGradesThroughUi(page, years[0]!, ["X", "XI", "XII"]);

  for (let cycle = 0; cycle < 3; cycle += 1) {
    const spec = years[cycle]!;
    const target = years[cycle + 1]!;
    const classes = await getClasses(service, spec.name);
    const dates = schoolDays(spec);
    const uiDate = dates[10]!;
    const movementDate = dates[90]!;

    await seedAttendanceDates(
      service,
      classes,
      dates.slice(0, 90).filter((date) => date !== uiDate),
      adminId,
    );
    await inputAttendanceAllClassesThroughUi(page, service, classes, uiDate);
    await verifyClassDashboardUi(
      page,
      service,
      spec.name,
      classes.find((item) => item.grade === "X" && item.class_number === 1)!,
      uiDate,
    );

    const movements = await applyMidyearMovementsThroughUi(
      page,
      service,
      spec,
      classes,
      cycle + 1,
      movementDate,
    );
    allMovements.incoming.push(...movements.incoming);
    allMovements.outgoing.push(...movements.outgoing);
    allMovements.transfers.push(...movements.transfers);

    await seedAttendanceDates(service, classes, dates.slice(90), adminId);
    await verifyMovementAttendanceBoundaries(service, movements);

    await promoteThroughUi(page, target.name, 1020);
    expect(
      await exactCount(service, "students", [
        ["current_grade", "X"],
        ["is_active", true],
      ]),
    ).toBe(0);

    await importGradesThroughUi(page, target, ["X"]);

    await page.goto("/pencarian?tab=siswa&grade=X&status=active");
    await expect(
      page.getByRole("cell", { name: studentName(target.cohort, "X", 1, 1), exact: true }),
    ).toBeVisible();
    await attachMilestone(page, testInfo, `tahun-${cycle + 1}-selesai`);
  }

  const finalClasses = await getClasses(service, years[3]!.name);
  const finalDays = schoolDays(
    {
      ...years[3]!,
      endDate: "2026-07-24",
    },
    15,
  );
  await seedAttendanceDates(service, finalClasses, finalDays, adminId);

  expect(await exactCount(service, "students")).toBe(2049);
  expect(
    await exactCount(service, "students", [
      ["is_active", true],
      ["current_grade", "X"],
    ]),
  ).toBe(340);
  expect(
    await exactCount(service, "students", [
      ["is_active", true],
      ["current_grade", "XI"],
    ]),
  ).toBe(340);
  expect(
    await exactCount(service, "students", [
      ["is_active", true],
      ["current_grade", "XII"],
    ]),
  ).toBe(340);
  expect(
    await exactCount(service, "students", [
      ["is_active", true],
      ["current_grade", "ALUMNI"],
    ]),
  ).toBe(1020);
  expect(await exactCount(service, "students", [["is_active", false]])).toBe(9);
  expect(await exactCount(service, "import_batches")).toBe(60);
  expect(await exactCount(service, "promotion_batches", [["status", "COMPLETED"]])).toBe(3);
  expect(await exactCount(service, "promotion_batch_items")).toBe(3060);
  expect(await exactCount(service, "student_enrollments", [["is_current", true]])).toBe(1020);
  expect(await exactCount(service, "student_enrollments")).toBe(4098);

  const expectedAttendance = 333_000;
  expect(await exactCount(service, "attendance_records")).toBe(expectedAttendance);
  expect(await exactCount(service, "attendance_records", [["status", "SAKIT"]])).toBe(166_500);
  expect(await exactCount(service, "attendance_records", [["status", "IZIN"]])).toBe(66_600);
  expect(await exactCount(service, "attendance_records", [["status", "TANPA_KETERANGAN"]])).toBe(
    99_900,
  );

  await verifyMovementAttendanceBoundaries(service, allMovements);

  const survivor = await studentByName(service, studentName(1, "X", 3, 2));
  await page.goto(`/siswa/${survivor.id}`);
  await expect(page.getByRole("heading", { name: survivor.full_name })).toBeVisible();
  await expect(
    page
      .locator("dt")
      .filter({ hasText: /^Grade$/ })
      .locator("..")
      .locator("dd"),
  ).toHaveText("ALUMNI");
  await expect(
    page
      .locator("dt")
      .filter({ hasText: /^Kelas$/ })
      .locator("..")
      .locator("dd"),
  ).toHaveText("Tidak ada");

  const firstAlumni = unwrap(
    "Membaca alumni pertama",
    await service
      .from("students")
      .select("id, full_name")
      .eq("current_grade", "ALUMNI")
      .eq("is_active", true)
      .order("normalized_name")
      .limit(1)
      .single(),
  ) as { id: string; full_name: string };

  await page.goto("/alumni");
  await expect(page.getByRole("link", { name: firstAlumni.full_name, exact: true })).toBeVisible();
  await expect(page.getByText("Lulus 2026").first()).toBeVisible();

  await page.goto("/reports");
  await page.getByLabel("Grade").selectOption("X");
  await page.getByLabel("Bulan").fill("2026-07");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Excel" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    (await readFile(downloadPath!)) as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
    "Ringkasan",
    ...Array.from({ length: 10 }, (_, index) => `X-${index + 1}`),
  ]);

  await page.goto("/riwayat-aktivitas");
  await page.getByPlaceholder("Filter action").fill("STUDENT_PROMOTION_APPLY");
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(page.getByText("STUDENT_PROMOTION_APPLY", { exact: true }).first()).toBeVisible();

  await attachMilestone(page, testInfo, "simulasi-final");

  const summary = {
    academicYears: 4,
    importedClasses: 60,
    importedStudents: 2040,
    incomingStudents: allMovements.incoming.length,
    outgoingStudents: allMovements.outgoing.length,
    classTransfers: allMovements.transfers.length,
    promotions: 3,
    attendanceDaysPerCompletedYear: 180,
    attendanceRecords: expectedAttendance,
    students: 2049,
    activeOperationalStudents: 1020,
    alumni: 1020,
    enrollments: 4098,
  };
  await testInfo.attach("simulation-summary.json", {
    body: Buffer.from(JSON.stringify(summary, null, 2)),
    contentType: "application/json",
  });
});
