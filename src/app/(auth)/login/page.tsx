import { GENERIC_LOGIN_ERROR, loginAction } from "@/modules/authentication";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main>
      <h1>Masuk SIPEKA</h1>
      <p>Gunakan akun yang diberikan oleh administrator.</p>
      {params.error ? <p role="alert">{GENERIC_LOGIN_ERROR}</p> : null}
      <form action={loginAction}>
        <label htmlFor="identifier">Username atau Email</label>
        <input id="identifier" name="identifier" autoComplete="username" required />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {params.redirectTo ? (
          <input name="redirectTo" type="hidden" value={params.redirectTo} />
        ) : null}
        <button type="submit">Masuk</button>
      </form>
    </main>
  );
}
