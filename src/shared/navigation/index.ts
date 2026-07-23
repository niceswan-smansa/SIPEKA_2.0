import type { AppRole } from "../permissions";

export type NavigationItem = {
  label: string;
  href: string;
  available: boolean;
  readOnly?: boolean;
};
const OPERATIONAL: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard", available: true },
  { label: "Input Presensi", href: "/presensi/input", available: true },
  { label: "Cari Siswa", href: "/siswa", available: true, readOnly: true },
  { label: "Manajemen Siswa", href: "/manajemen-siswa", available: true },
  { label: "Manajemen Kelas", href: "/manajemen-kelas", available: true },
  { label: "Import Siswa", href: "/import-siswa", available: true },
  { label: "Naik/Turun Grade", href: "/naik-turun-grade", available: true },
  { label: "Alumni", href: "/alumni", available: true },
  { label: "Laporan", href: "/reports", available: false, readOnly: true },
  { label: "Riwayat Aktivitas", href: "/activity", available: false },
  { label: "Profil", href: "/profile", available: false },
];

export function getNavigationForRole(role: AppRole) {
  if (role === "SUPER_ADMIN")
    return [
      { label: "Akun", href: "/super-admin/accounts", available: true },
      { label: "Riwayat Akun", href: "/super-admin/account-audit", available: true },
    ];
  return role === "ADMIN"
    ? OPERATIONAL
    : OPERATIONAL.filter((item) =>
        ["Dashboard", "Cari Siswa", "Laporan", "Profil"].includes(item.label),
      );
}
