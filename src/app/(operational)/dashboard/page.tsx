import { requirePageAccess } from "@/modules/authorization";
import { PageHeader, Card } from "@/shared/ui";

export default async function DashboardPlaceholderPage() {
  const profile = await requirePageAccess("OPERATIONAL");

  return (
    <>
      <PageHeader title="Dashboard" description={`Area operasional untuk akun ${profile.role}.`} />
      <Card>
        <p className="text-sm text-slate-600">
          Guard aktif untuk akun {profile.role}. Dashboard statistik dan modul presensi akan
          tersedia pada fase berikutnya.
        </p>
      </Card>
    </>
  );
}
