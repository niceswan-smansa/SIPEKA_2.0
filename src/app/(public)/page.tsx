import type { Metadata } from "next";
import Image from "next/image";

import { authorizeRequest, defaultPathForRole } from "@/modules/authorization";
import { SITE_DESCRIPTION, SITE_NAME } from "@/shared/constants";
import { AppIcon, type AppIconName } from "@/shared/icons";
import { Card, ResponsiveContainer } from "@/shared/ui";

export const metadata: Metadata = {
  title: `${SITE_NAME} | Presensi SMANSA`,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ["/assets/smansa-logo.webp"],
  },
};

const overview = [
  {
    description: "Ringkasan kehadiran siswa yang mudah dibaca sesuai tanggal dan kewenangan.",
    icon: "dashboard",
    title: "Dashboard Presensi",
  },
  {
    description: "Pencatatan ketidakhadiran per siswa dan jam pelajaran dalam satu ruang kerja.",
    icon: "attendance",
    title: "Input Presensi Massal",
  },
  {
    description: "Tinjau pola kehadiran melalui kalender, statistik, dan histori yang terstruktur.",
    icon: "report",
    title: "Kalender dan Statistik",
  },
  {
    description: "Temukan siswa dengan cepat berdasarkan nama, NIS, NISN, kelas, atau angkatan.",
    icon: "search",
    title: "Pencarian Siswa",
  },
  {
    description:
      "Lihat identitas, kelas aktif, riwayat enrollment, dan catatan presensi individual.",
    icon: "students",
    title: "Detail Presensi Siswa",
  },
  {
    description: "Siapkan laporan individual serta ekspor workbook untuk kebutuhan administrasi.",
    icon: "import",
    title: "Laporan dan Ekspor",
  },
  {
    description:
      "Kontrol akses berbasis peran dan pencatatan perubahan untuk menjaga akuntabilitas.",
    icon: "security",
    title: "Keamanan dan Audit",
  },
] satisfies Array<{
  description: string;
  icon: AppIconName;
  title: string;
}>;

export default async function HomePage() {
  const { context } = await authorizeRequest("AUTHENTICATED");
  const startPath = context.profile?.role ? defaultPathForRole(context.profile.role) : "/login";

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="hero-background flex min-h-[min(760px,100vh)] items-center text-white">
        <ResponsiveContainer className="hero-content py-20">
          <div className="max-w-2xl">
            <Image
              src="/assets/smansa-logo.webp"
              alt="Logo SMAN 1 Pamekasan"
              width={136}
              height={136}
              className="mb-7 h-28 w-28 object-contain sm:h-34 sm:w-34"
              priority
            />
            <p className="mb-3 text-sm font-bold uppercase tracking-[.24em] text-amber-300">
              SMANSA Pamekasan
            </p>
            <h1 className="text-5xl font-black tracking-tight sm:text-7xl">SIPEKA</h1>
            <p className="mt-3 text-xl font-semibold sm:text-2xl">
              Sistem Presensi SMANSA Pamekasan
            </p>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-200">
              Fondasi presensi sekolah yang tertib, transparan, dan aman untuk mendukung aktivitas
              akademik.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={startPath}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:-translate-y-0.5 hover:bg-amber-300"
              >
                Mulai
              </a>
              <a
                href="#overview"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/60 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Pelajari Lebih Lanjut
              </a>
            </div>
          </div>
        </ResponsiveContainer>
      </section>

      <section id="overview" className="overview-section scroll-mt-10 bg-white py-20">
        <ResponsiveContainer>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-[var(--brand)]">
              Overview
            </p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">
              Satu ruang kerja untuk presensi yang lebih rapi
            </h2>
            <p className="mt-4 text-slate-600">
              Fitur utama SIPEKA dirancang untuk membantu pencatatan, pencarian, pelaporan, dan
              pengawasan presensi secara terpadu.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {overview.map((item) => (
              <Card key={item.title} className="feature-card min-h-48">
                <div className="feature-icon">
                  <AppIcon name={item.icon} className="h-6 w-6" />
                </div>
                <h3 className="mt-5 font-bold text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
              </Card>
            ))}
          </div>
        </ResponsiveContainer>
      </section>

      <footer className="border-t border-slate-200 bg-slate-50 py-8">
        <ResponsiveContainer className="flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold text-slate-900">SIPEKA</p>
            <p>Sistem Presensi SMANSA Pamekasan</p>
          </div>
          <div className="flex gap-4">
            <span>© {new Date().getFullYear()}</span>
            <a className="font-semibold text-[var(--brand)] hover:underline" href="/login">
              Masuk
            </a>
          </div>
        </ResponsiveContainer>
      </footer>
    </main>
  );
}
