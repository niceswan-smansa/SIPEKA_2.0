import { describe, expect, it } from "vitest";

import { getNavigationForRole } from ".";

describe("role-aware navigation", () => {
  it("keeps Super Admin portal isolated", () => {
    expect(getNavigationForRole("SUPER_ADMIN").map((item) => item.href)).toEqual([
      "/super-admin/accounts",
      "/super-admin/account-audit",
    ]);
  });
  it("does not expose mutation labels to USER", () => {
    const labels = getNavigationForRole("USER").map((item) => item.label);
    expect(labels).toEqual(["Dashboard", "Cari Siswa", "Laporan", "Profil"]);
    expect(labels).not.toContain("Input Presensi");
  });
});
