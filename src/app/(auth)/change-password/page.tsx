import { requirePageAccess } from "@/modules/authorization";
import { changePasswordAction, logoutAction } from "@/modules/authentication";

type ChangePasswordPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ChangePasswordPage({ searchParams }: ChangePasswordPageProps) {
  await requirePageAccess("AUTHENTICATED");
  const params = await searchParams;

  return (
    <main>
      <h1>Ganti Password</h1>
      <p>Password minimal 12 karakter dengan huruf besar, huruf kecil, angka, dan simbol.</p>
      {params.error ? <p role="alert">Password tidak dapat diperbarui.</p> : null}
      <form action={changePasswordAction}>
        <label htmlFor="password">Password baru</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required />
        <label htmlFor="confirmation">Konfirmasi password</label>
        <input
          id="confirmation"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
        />
        <button type="submit">Simpan Password</button>
      </form>
      <form action={logoutAction}>
        <button type="submit">Keluar</button>
      </form>
    </main>
  );
}
