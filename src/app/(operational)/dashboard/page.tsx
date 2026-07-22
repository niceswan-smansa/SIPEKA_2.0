import { requirePageAccess } from "@/modules/authorization";
import { logoutAction } from "@/modules/authentication";

export default async function DashboardPlaceholderPage() {
  const profile = await requirePageAccess("OPERATIONAL");

  return (
    <main>
      <h1>Area Operasional</h1>
      <p>Guard aktif untuk akun {profile.role}. Dashboard dibuat pada fase berikutnya.</p>
      <form action={logoutAction}>
        <button type="submit">Keluar</button>
      </form>
    </main>
  );
}
