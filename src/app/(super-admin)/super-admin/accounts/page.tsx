import { requirePageAccess } from "@/modules/authorization";
import { logoutAction } from "@/modules/authentication";

export default async function AccountPortalPlaceholderPage() {
  await requirePageAccess("SUPER_ADMIN");

  return (
    <main>
      <h1>Portal Super Admin</h1>
      <p>Guard portal aktif. Pengelolaan akun final dibuat pada Phase 2.</p>
      <form action={logoutAction}>
        <button type="submit">Keluar</button>
      </form>
    </main>
  );
}
