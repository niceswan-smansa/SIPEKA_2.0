import Image from "next/image";
import type { Metadata } from "next";

import { authorizeRequest } from "@/modules/authorization";
import { defaultPathForRole } from "@/modules/authorization";
import { SITE_DESCRIPTION, SITE_NAME } from "@/shared/constants";
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
  "Dashboard Presensi",
  "Input Presensi Massal",
  "Kalender dan Statistik",
  "Pencarian Siswa",
  "Detail Presensi Siswa",
  "Laporan dan Ekspor",
  "Keamanan dan Pencatatan Perubahan",
];

export default async function HomePage() {
  const { context } = await authorizeRequest("AUTHENTICATED");
  const startPath = context.profile?.role ? defaultPathForRole(context.profile.role) : "/login";
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="hero-background flex min-h-[min(760px,100vh)] items-center text-white">
        <ResponsiveContainer className="py-20">
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
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300"
              >
                Mulai
              </a>
              <a
                href="#overview"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/60 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
              >
                Pelajari Lebih Lanjut
              </a>
            </div>
          </div>
        </ResponsiveContainer>
      </section>
      <section id="overview" className="scroll-mt-10 bg-white py-20">
        <ResponsiveContainer>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-[var(--brand)]">
              Overview
            </p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">
              Satu ruang kerja untuk presensi yang lebih rapi
            </h2>
            <p className="mt-4 text-slate-600">
              Fitur akan dibuka bertahap sesuai roadmap dan kewenangan setiap peran.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {overview.map((title) => (
              <Card key={title} className="min-h-32">
                <h3 className="font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Disiapkan sebagai bagian dari fondasi SIPEKA.
                </p>
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
