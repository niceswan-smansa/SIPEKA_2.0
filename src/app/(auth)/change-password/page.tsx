import Image from "next/image";

import { ChangePasswordForm, logoutAction } from "@/modules/authentication";
import { requirePageAccess } from "@/modules/authorization";

type ChangePasswordPageProps = { searchParams: Promise<{ error?: string }> };

export default async function ChangePasswordPage({ searchParams }: ChangePasswordPageProps) {
  await requirePageAccess("AUTHENTICATED");
  const params = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        <Image
          src="/assets/smansa-logo.webp"
          alt="Logo SMAN 1 Pamekasan"
          width={64}
          height={64}
          className="mx-auto h-16 w-16 object-contain"
        />
        <h1 className="mt-5 text-center text-2xl font-black">Ganti Password</h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          Buat password baru untuk melanjutkan ke aplikasi.
        </p>
        <div className="mt-6">
          <ChangePasswordForm {...(params.error ? { error: params.error } : {})} />
        </div>
        <form className="mt-3 text-center" action={logoutAction}>
          <button className="text-sm font-semibold text-slate-600 hover:underline" type="submit">
            Keluar
          </button>
        </form>
      </div>
    </main>
  );
}
