import type { ReactNode } from "react";

import { logoutAction } from "@/modules/authentication";
import { requirePageAccess } from "@/modules/authorization";
import { getNavigationForRole } from "@/shared/navigation";
import { NavigationShell } from "@/shared/ui/navigation-shell";

export default async function OperationalLayout({ children }: { children: ReactNode }) {
  const profile = await requirePageAccess("OPERATIONAL");
  return (
    <NavigationShell
      profile={profile}
      items={getNavigationForRole(profile.role)}
      title="Area Operasional"
      subtitle="Area Operasional"
      logoutAction={logoutAction}
    >
      {children}
    </NavigationShell>
  );
}
