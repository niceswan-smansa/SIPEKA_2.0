import type { AppIconName } from "../icons";
import type { AppRole } from "../permissions";

export type NavigationItem = {
  label: string;
  href: string;
  available: boolean;
  icon: AppIconName;
  readOnly?: boolean;
};

const OPERATIONAL: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard", available: true, icon: "dashboard" },
  { label: "Input Presensi", href: "/presensi/input", available: true, icon: "attendance" },
  { label: "Cari Siswa", href: "/siswa", available: true, icon: "search", readOnly: true },
  { label: "Manajemen Siswa", href: "/manajemen-siswa", available: true, icon: "students" },
  { label: "Manajemen Kelas", href: "/manajemen-kelas", available: true, icon: "classes" },
  { label: "Import Siswa", href: "/import-siswa", available: true, icon: "import" },
  { label: "Naik/Turun Grade", href: "/naik-turun-grade", available: true, icon: "promotion" },
  { label: "Alumni", href: "/alumni", available: true, icon: "alumni" },
  { label: "Laporan", href: "/reports", available: false, icon: "report", readOnly: true },
  { label: "Riwayat Aktivitas", href: "/riwayat-aktivitas", available: true, icon: "audit" },
  { label: "Profil", href: "/profile", available: false, icon: "profile" },
];

export function getNavigationForRole(role: AppRole): NavigationItem[] {
  if (role === "SUPER_ADMIN") {
    return [
      {
        label: "Akun",
        href: "/super-admin/accounts",
        available: true,
        icon: "accounts",
      },
      {
        label: "Riwayat Akun",
        href: "/super-admin/account-audit",
        available: true,
        icon: "audit",
      },
    ];
  }

  return role === "ADMIN"
    ? OPERATIONAL
    : OPERATIONAL.filter((item) =>
        ["Dashboard", "Cari Siswa", "Laporan", "Profil"].includes(item.label),
      );
}
