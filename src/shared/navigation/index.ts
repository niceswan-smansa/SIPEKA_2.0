import type { AppRole } from "../permissions";

export type NavigationItem = {
  label: string;
  href: string;
  available: boolean;
  readOnly?: boolean;
};
const OPERATIONAL: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard", available: true },
  { label: "Input Presensi", href: "/attendance", available: false },
  { label: "Cari Siswa", href: "/students/search", available: false, readOnly: true },
  { label: "Manajemen Siswa", href: "/students", available: false },
  { label: "Manajemen Kelas", href: "/classes", available: false },
  { label: "Import Siswa", href: "/imports", available: false },
  { label: "Naik/Turun Grade", href: "/promotion", available: false },
  { label: "Alumni", href: "/alumni", available: false },
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
