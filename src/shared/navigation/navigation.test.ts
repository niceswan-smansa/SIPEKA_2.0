import { describe, expect, it } from "vitest";

import { getNavigationForRole } from ".";

describe("role-aware navigation", () => {
  it("keeps Super Admin portal isolated without an audit route", () => {
    expect(getNavigationForRole("SUPER_ADMIN").map((item) => item.href)).toEqual([
      "/super-admin/accounts",
    ]);
  });

  it("does not expose mutation labels to USER", () => {
    const labels = getNavigationForRole("USER").map((item) => item.label);
    expect(labels).toEqual(["Dashboard", "Pencarian", "Profil"]);
    expect(labels).not.toContain("Input Presensi");
    expect(labels).not.toContain("Manajemen Siswa");
    expect(labels).not.toContain("Pengaturan Tahun Ajaran & Kelas");
  });

  it("exposes available operational mutation routes only to ADMIN", () => {
    const routes = getNavigationForRole("ADMIN")
      .filter((item) => item.available)
      .map((item) => item.href);

    expect(routes).toEqual([
      "/dashboard",
      "/presensi/input",
      "/pencarian",
      "/manajemen-siswa",
      "/manajemen-kelas",
      "/import-siswa",
      "/naik-turun-grade",
      "/alumni",
      "/reports",
    ]);
  });

  it("provides a vector icon for every navigation item", () => {
    for (const role of ["SUPER_ADMIN", "ADMIN", "USER"] as const) {
      expect(getNavigationForRole(role).every((item) => item.icon.length > 0)).toBe(true);
    }
  });
});
