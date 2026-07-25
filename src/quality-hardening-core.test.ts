import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/infrastructure/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(),
}));

import { createAdminSupabaseClient } from "@/infrastructure/supabase/admin";
import { createAcademicYearService } from "@/modules/academic-years";
import { createAttendanceService } from "@/modules/attendance";
import { createClassService } from "@/modules/classes";
import { createDashboardService } from "@/modules/dashboard";
import { createOperationalAuditService } from "@/modules/operational-audit";
import { createStudentAttendanceService } from "@/modules/student-attendance";
import { createStudentLifecycleService } from "@/modules/student-lifecycle";
import { createStudentSearchService } from "@/modules/student-search";
import { createStudentService } from "@/modules/students";
import { allowRateLimited } from "@/shared/security/rate-limit";

const uuid = "00000000-0000-4000-8000-000000000001";

describe("quality hardening core coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed without a production secret", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_SECRET", "");

    await expect(allowRateLimited("127.0.0.1", "login-address")).resolves.toBe(false);
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("uses the configured or local secret and trusts only a true RPC result", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data: true, error: { message: "db-error" } });

    vi.mocked(createAdminSupabaseClient).mockReturnValue({ rpc } as never);
    vi.stubEnv("RATE_LIMIT_SECRET", "configured-secret");

    await expect(allowRateLimited("admin", "login-account", 3, 120)).resolves.toBe(true);
    await expect(allowRateLimited("admin", "login-account", 3, 120)).resolves.toBe(false);
    await expect(allowRateLimited("admin", "login-account", 3, 120)).resolves.toBe(false);

    expect(rpc).toHaveBeenNthCalledWith(
      1,
      "consume_auth_rate_limit",
      expect.objectContaining({
        p_key_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        p_scope: "login-account",
        p_limit: 3,
        p_window_seconds: 120,
      }),
    );

    vi.clearAllMocks();
    vi.stubEnv("RATE_LIMIT_SECRET", "");
    vi.stubEnv("NODE_ENV", "test");
    vi.mocked(createAdminSupabaseClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    } as never);

    await expect(allowRateLimited("local", "login-address")).resolves.toBe(true);
  });

  it("validates inputs and delegates application operations to repositories", async () => {
    const academicRepository = {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      activate: vi.fn().mockResolvedValue(undefined),
    };
    const academic = createAcademicYearService(academicRepository as never);

    await expect(academic.list()).resolves.toEqual([]);
    await academic.create({
      name: "2026/2027",
      startDate: "2026-07-01",
      endDate: "2027-06-30",
      isActive: true,
    });
    await academic.update("year-1", {
      name: "2027/2028",
      startDate: "2027-07-01",
      endDate: "2028-06-30",
    });
    await academic.activate("year-1");

    expect(academicRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true }),
    );
    expect(academicRepository.update).toHaveBeenCalledWith("year-1", {
      name: "2027/2028",
      startDate: "2027-07-01",
      endDate: "2028-06-30",
    });

    const attendanceRepository = {
      getClassAttendance: vi.fn().mockResolvedValue({}),
      preview: vi.fn().mockResolvedValue({}),
      apply: vi.fn().mockResolvedValue({}),
    };
    const attendance = createAttendanceService(attendanceRepository as never);
    await attendance.getClassAttendance("class-1", "2026-07-25", "Nina");
    await attendance.preview({} as never);
    await attendance.apply({ token: "preview-token" } as never);

    expect(attendanceRepository.getClassAttendance).toHaveBeenCalledWith(
      "class-1",
      "2026-07-25",
      "Nina",
    );
    expect(attendanceRepository.preview).toHaveBeenCalledTimes(1);
    expect(attendanceRepository.apply).toHaveBeenCalledTimes(1);

    const classRepository = {
      list: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    };
    const classService = createClassService(classRepository as never);
    await classService.list();
    await classService.update({
      id: uuid,
      homeroomTeacher: "  Ibu Guru  ",
      notes: "  Catatan  ",
      isActive: true,
    });
    expect(classRepository.update).toHaveBeenCalledWith({
      id: uuid,
      homeroomTeacher: "Ibu Guru",
      notes: "Catatan",
      isActive: true,
    });

    const dashboardRepository = {
      get: vi.fn().mockResolvedValue({}),
    };
    await createDashboardService(dashboardRepository as never).get("2026-07-25");
    expect(dashboardRepository.get).toHaveBeenCalledWith("2026-07-25");

    const auditRepository = {
      list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    await createOperationalAuditService(auditRepository as never).list({ action: "  LOGIN  " });
    expect(auditRepository.list).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      action: "LOGIN",
    });

    const lifecycleRepository = {
      importStudents: vi.fn(),
      previewPromotion: vi.fn().mockResolvedValue({}),
      promote: vi.fn().mockResolvedValue(1),
      rollback: vi.fn().mockResolvedValue(1),
      archive: vi.fn().mockResolvedValue(undefined),
      tombstone: vi.fn().mockResolvedValue(undefined),
      listPromotionBatches: vi.fn().mockResolvedValue([]),
    };
    const lifecycle = createStudentLifecycleService(lifecycleRepository as never);
    await lifecycle.previewPromotion(uuid);
    await lifecycle.promote(uuid);
    await lifecycle.rollback(uuid);
    await lifecycle.archive(uuid);
    await lifecycle.tombstone(uuid);
    await expect(lifecycle.listPromotionBatches()).resolves.toEqual([]);

    const studentAttendanceRepository = {
      get: vi.fn(),
      getReport: vi.fn(),
      recordExport: vi.fn(),
    };
    const studentAttendance = createStudentAttendanceService(studentAttendanceRepository as never);
    expect(studentAttendance.get).toBe(studentAttendanceRepository.get);
    expect(studentAttendance.getReport).toBe(studentAttendanceRepository.getReport);
    expect(studentAttendance.recordExport).toBe(studentAttendanceRepository.recordExport);

    const searchRepository = {
      search: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    const search = createStudentSearchService(searchRepository as never);
    const searchResult = await search.search({
      q: "  Nina   Sari  ",
      status: "active",
      page: "2",
      pageSize: "10",
    });
    expect(searchRepository.search).toHaveBeenCalledWith({
      search: "Nina Sari",
      active: true,
      page: 2,
      pageSize: 10,
    });
    expect(searchResult.params).toMatchObject({
      q: "Nina Sari",
      status: "active",
      page: 2,
      pageSize: 10,
    });

    const studentRepository = {
      search: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      getDetail: vi.fn().mockResolvedValue(null),
    };
    const students = createStudentService(studentRepository as never);
    await students.search({ page: 1, pageSize: 20 } as never);
    await students.getDetail("student-1");
    expect(studentRepository.search).toHaveBeenCalledTimes(1);
    expect(studentRepository.getDetail).toHaveBeenCalledWith("student-1");
  });
});
