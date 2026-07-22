import type { ReactNode } from "react";

import { logoutAction } from "@/modules/authentication";
import { requirePageAccess } from "@/modules/authorization";
import { getNavigationForRole } from "@/shared/navigation";
import { NavigationShell } from "@/shared/ui/navigation-shell";

export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  const profile = await requirePageAccess("SUPER_ADMIN");
  return (
    <NavigationShell
      profile={profile}
      items={getNavigationForRole(profile.role)}
      title="Portal Super Admin"
      subtitle="Portal Super Admin"
      logoutAction={logoutAction}
    >
      {children}
    </NavigationShell>
  );
}
