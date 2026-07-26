import { redirect } from "next/navigation";

import {
  createAcademicYearService,
  createSupabaseAcademicYearRepository,
} from "@/modules/academic-years";
import { requirePageAccess } from "@/modules/authorization";
import {
  CategoryChart,
  createDashboardService,
  createSupabaseDashboardRepository,
  DashboardCalendar,
  MonthlyChart,
  todayJakarta,
} from "@/modules/dashboard";
import { isIsoDate, isMonthStart } from "@/shared/domain/dates";
import { Alert, Card, PageHeader } from "@/shared/ui";

type Props = { searchParams: Promise<{ date?: string; month?: string; setup?: string }> };

export default async function DashboardPage({ searchParams }: Props) {
  const profile = await requirePageAccess("OPERATIONAL");
  const params = await searchParams;
  const years = await createAcademicYearService(createSupabaseAcademicYearRepository()).list();

  if (years.length === 0) {
    if (profile.role === "ADMIN") {
      redirect("/pengaturan-awal");
    }

    return (
      <>
        <PageHeader title="Dashboard" description="SIPEKA belum dikonfigurasi." />
        <Alert>
          Belum ada tahun ajaran. Minta Admin menyelesaikan Pengaturan Awal sebelum data operasional
          digunakan.
        </Alert>
      </>
    );
  }

  const selectedDate = isIsoDate(params.date) ? params.date : todayJakarta();
  const visibleMonth = isMonthStart(params.month) ? params.month : `${selectedDate.slice(0, 7)}-01`;
  const data = await createDashboardService(createSupabaseDashboardRepository()).get(selectedDate);
  const cards = [
    ["Siswa Tidak Hadir", data.summary.total],
    ["Izin", data.summary.izin],
    ["Sakit", data.summary.sakit],
    ["Tanpa Keterangan", data.summary.tanpaKeterangan],
  ] as const;

  return (
    <>
      <PageHeader title="Dashboard" description={`Ringkasan presensi untuk ${selectedDate}.`} />
      {params.setup === "complete" ? (
        <Alert tone="success">
          Pengaturan awal selesai. Tahun ajaran aktif dan 30 kelas telah dibuat.
        </Alert>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
        <Card>
          <DashboardCalendar selectedDate={selectedDate} visibleMonth={visibleMonth} />
        </Card>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cards.map(([label, value]) => (
            <Card key={label}>
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-black">{value}</p>
            </Card>
          ))}
        </div>
      </div>
      <div className="mt-5 grid gap-5">
        <CategoryChart title="Ketidakhadiran per kelas" data={data.daily} />
        <CategoryChart title="Ketidakhadiran mingguan" data={data.weekly} />
        <MonthlyChart data={data.monthly} />
      </div>
    </>
  );
}
