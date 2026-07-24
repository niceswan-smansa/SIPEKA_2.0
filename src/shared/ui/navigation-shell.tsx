"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

import { AppIcon } from "../icons";
import type { NavigationItem } from "../navigation";
import type { AccountProfile } from "../permissions";

function accountInitials(fullName: string) {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavigationShell({
  profile,
  items,
  title,
  subtitle,
  logoutAction,
  children,
}: {
  profile: AccountProfile;
  items: NavigationItem[];
  title: string;
  subtitle: string;
  logoutAction: (formData: FormData) => void;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const initials = accountInitials(profile.fullName);

  return (
    <div className="app-shell flex bg-slate-50 text-slate-900">
      <aside
        className={`batik-sidebar fixed inset-y-0 left-0 z-30 flex w-72 flex-col overflow-y-auto border-r border-blue-950/10 bg-white p-5 shadow-xl shadow-slate-950/5 transition-transform lg:static lg:translate-x-0 lg:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="relative z-10 mb-7 flex items-center justify-between lg:justify-start">
          <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-amber-300/70 bg-white shadow-sm">
              <Image
                src="/assets/smansa-logo.webp"
                alt=""
                width={38}
                height={38}
                className="h-9 w-9 object-contain"
              />
            </span>
            <span>
              <span className="block text-lg font-black tracking-wide text-[var(--brand)]">
                SIPEKA
              </span>
              <span className="block text-xs text-slate-500">{subtitle}</span>
            </span>
          </Link>

          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Tutup navigasi"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="relative z-10 mb-4 flex items-center gap-3 rounded-2xl border border-blue-100 bg-white/85 p-3 shadow-sm backdrop-blur">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--brand)] text-sm font-black text-white">
            {initials}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-slate-900">
              {profile.fullName}
            </span>
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {profile.role.replaceAll("_", " ")}
            </span>
          </span>
        </div>

        <nav className="relative z-10 grid gap-1.5" aria-label="Navigasi utama">
          {items.map((item) => {
            const active = item.available && isActiveRoute(pathname, item.href);

            return item.available ? (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "bg-[var(--brand)] text-white shadow-md shadow-blue-950/15"
                    : "text-slate-700 hover:bg-blue-50 hover:text-[var(--brand)]"
                }`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${
                    active
                      ? "bg-white/15 text-amber-200"
                      : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-[var(--brand)]"
                  }`}
                >
                  <AppIcon name={item.icon} className="h-4.5 w-4.5" />
                </span>
                <span>{item.label}</span>
              </Link>
            ) : (
              <span
                key={item.href}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400"
                aria-disabled="true"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100">
                  <AppIcon name={item.icon} className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0 flex-1">{item.label}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                  Segera
                </span>
              </span>
            );
          })}
        </nav>

        <div className="relative z-10 mt-auto pt-6">
          <div className="h-px bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
          <p className="mt-4 text-center text-[11px] leading-5 text-slate-500">
            Sistem Presensi SMANSA Pamekasan
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="batik-header sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            className="relative z-10 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Buka navigasi"
          >
            <span className="grid gap-1" aria-hidden="true">
              <span className="h-0.5 w-4 bg-current" />
              <span className="h-0.5 w-4 bg-current" />
              <span className="h-0.5 w-4 bg-current" />
            </span>
            Menu
          </button>

          <div className="relative z-10 hidden lg:block">
            <p className="text-sm font-bold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">SMAN 1 Pamekasan</p>
          </div>

          <div className="relative z-10 flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-48 truncate text-sm font-semibold">{profile.fullName}</p>
              <p className="text-xs text-slate-500">{profile.role.replaceAll("_", " ")}</p>
            </div>
            <form action={logoutAction}>
              <button
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                type="submit"
              >
                Keluar
              </button>
            </form>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6">{children}</main>
      </div>

      {open ? (
        <button
          className="fixed inset-0 z-20 bg-slate-950/40 backdrop-blur-[1px] lg:hidden"
          type="button"
          aria-label="Tutup navigasi"
          onClick={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
