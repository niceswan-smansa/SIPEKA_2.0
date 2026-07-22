"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import type { NavigationItem } from "../navigation";
import type { AccountProfile } from "../permissions";

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
  const [open, setOpen] = useState(false);
  return (
    <div className="app-shell flex bg-slate-50 text-slate-900">
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-72 border-r border-slate-200 bg-white p-5 transition-transform lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="mb-8">
          <p className="text-lg font-black tracking-wide text-[var(--brand)]">SIPEKA</p>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <nav className="grid gap-1" aria-label="Navigasi utama">
          {items.map((item) =>
            item.available ? (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-blue-50 hover:text-[var(--brand)]"
              >
                {item.label}
              </a>
            ) : (
              <span
                key={item.href}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-slate-400"
                aria-disabled="true"
              >
                <span>{item.label}</span>
                <span className="text-[10px] uppercase">Segera</span>
              </span>
            ),
          )}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            className="rounded-lg border px-3 py-2 text-sm lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Buka navigasi"
          >
            Menu
          </button>
          <div className="hidden text-sm font-semibold text-slate-700 lg:block">{title}</div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold">{profile.fullName}</p>
              <p className="text-xs text-slate-500">{profile.role}</p>
            </div>
            <form action={logoutAction}>
              <button
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
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
          className="fixed inset-0 z-20 bg-slate-950/30 lg:hidden"
          type="button"
          aria-label="Tutup navigasi"
          onClick={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
