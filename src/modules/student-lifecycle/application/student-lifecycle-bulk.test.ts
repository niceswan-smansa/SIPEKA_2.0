import { describe, expect, it, vi } from "vitest";

import {
  createStudentLifecycleService,
  type StudentLifecycleRepository,
} from "./student-lifecycle-service";

const repository = (): StudentLifecycleRepository => ({
  importStudents: vi.fn(async () => 0),
  importStudentsBulk: vi.fn(async () => 2),
  promote: vi.fn(async () => 0),
  previewPromotion: vi.fn(async () => ({
    from_year_id: "10000000-0000-4000-8000-000000000001",
    from_year_name: "2026/2027",
    to_year_id: "10000000-0000-4000-8000-000000000002",
    to_year_name: "2027/2028",
    total: 0,
    x_to_xi: 0,
    xi_to_xii: 0,
    xii_to_alumni: 0,
    missing_destination_classes: [],
    safe_to_apply: true,
  })),
  rollback: vi.fn(async () => 0),
  archive: vi.fn(async () => undefined),
  tombstone: vi.fn(async () => undefined),
  listPromotionBatches: vi.fn(async () => []),
});

describe("student lifecycle bulk import", () => {
  it("validates and delegates a bulk import", async () => {
    const target = repository();
    const service = createStudentLifecycleService(target);
    const input = [
      {
        academicYearId: "10000000-0000-4000-8000-000000000001",
        classId: "20000000-0000-4000-8000-000000000001",
        fileName: "x-1.csv",
        rows: [
          {
            nis: "10001",
            nisn: "0091234567",
            name: "Nabila",
            gender: "P",
          },
        ],
      },
    ];

    await expect(service.importStudentsBulk(input)).resolves.toBe(2);
    expect(target.importStudentsBulk).toHaveBeenCalledWith(input);
  });

  it("fails closed when the repository has no bulk implementation", async () => {
    const target = repository();
    delete target.importStudentsBulk;
    const service = createStudentLifecycleService(target);

    await expect(
      service.importStudentsBulk([
        {
          academicYearId: "10000000-0000-4000-8000-000000000001",
          classId: "20000000-0000-4000-8000-000000000001",
          fileName: "x-1.csv",
          rows: [
            {
              nis: "10001",
              nisn: "0091234567",
              name: "Nabila",
              gender: "P",
            },
          ],
        },
      ]),
    ).rejects.toThrow("BULK_IMPORT_UNSUPPORTED");
  });
});
