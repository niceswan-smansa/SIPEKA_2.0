import Image from "next/image";
import Link from "next/link";

import { LoginForm } from "@/modules/authentication";
import { SITE_DESCRIPTION, SITE_NAME } from "@/shared/constants";

type LoginPageProps = { searchParams: Promise<{ error?: string; redirectTo?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-7 text-center">
          <Image
            src="/assets/smansa-logo.webp"
            alt="Logo SMAN 1 Pamekasan"
            width={80}
            height={80}
            className="mx-auto h-20 w-20 object-contain"
            priority
          />
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-[var(--brand)]">
            {SITE_NAME}
          </p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">Masuk ke SIPEKA</h1>
          <p className="mt-2 text-sm text-slate-600">{SITE_DESCRIPTION}</p>
        </div>
        {params.error ? (
          <p
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            Username atau password tidak valid.
          </p>
        ) : null}
        <LoginForm {...(params.redirectTo ? { redirectTo: params.redirectTo } : {})} />
        <Link
          className="mt-6 block text-center text-sm font-semibold text-[var(--brand)] hover:underline"
          href="/"
        >
          Kembali ke halaman utama
        </Link>
      </div>
    </main>
  );
}
