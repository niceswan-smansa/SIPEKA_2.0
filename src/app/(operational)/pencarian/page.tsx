import Link from "next/link";

import {
  createAcademicYearService,
  createSupabaseAcademicYearRepository,
} from "@/modules/academic-years";
import { requirePageAccess } from "@/modules/authorization";
import {
  classDisplayName,
  createClassService,
  createSupabaseClassRepository,
} from "@/modules/classes";
import {
  CategoryChart,
  DashboardCalendar,
  getClassDashboard,
  todayJakarta,
  type ClassDashboardStudent,
} from "@/modules/dashboard";
import {
  createStudentSearchRepository,
  createStudentSearchService,
  StudentFilters,
} from "@/modules/student-search";
import { StudentList } from "@/modules/students";
import { isIsoDate, isMonthStart } from "@/shared/domain/dates";
import { Button, Card, EmptyState, FormField, PageHeader, Pagination, Select } from "@/shared/ui";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

function clampDate(date: string, startDate: string, endDate: string) {
  if (date < startDate) return startDate;
  if (date > endDate) return endDate;
  return date;
}

function PersonList({
  people,
  showPeriods,
}: {
  people: ClassDashboardStudent[];
  showPeriods: boolean;
}) {
  if (people.length === 0) {
    return <p className="text-sm text-slate-500">Tidak ada.</p>;
  }

  return (
    <ul className="grid gap-2">
      {people.map((person) => (
        <li key={person.id} className="rounded-lg border border-slate-200 p-3">
          <p className="font-semibold">{person.name}</p>
          {showPeriods && person.periods?.length ? (
            <p className="text-xs text-slate-500">Jam {person.periods.join(", ")}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default async function SearchPage({ searchParams }: Props) {
  const profile = await requirePageAccess("OPERATIONAL");
  const params = await searchParams;
  const tab = params.tab === "kelas" ? "kelas" : "siswa";

  if (tab === "siswa") {
    const classes = (await createClassService(createSupabaseClassRepository()).list()).filter(
      (item) => item.isActive && item.academicYearActive,
    );
    const search = await createStudentSearchService(createStudentSearchRepository()).search({
      ...params,
      status: params.status ?? "active",
    });
    const totalPages = Math.max(1, Math.ceil(search.result.total / search.result.pageSize));
    const pageHref = (page: number) => {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value && key !== "page") query.set(key, value);
      }
      query.set("tab", "siswa");
      query.set("page", String(page));
      return `/pencarian?${query.toString()}`;
    };

    return (
      <>
        <PageHeader
          title="Pencarian"
          description="Cari siswa atau buka ringkasan presensi berdasarkan kelas."
        />
        <div className="mb-5 flex gap-2">
          <Link
            className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"
            href="/pencarian?tab=siswa"
          >
            Siswa
          </Link>
          <Link
            className="rounded-lg border px-4 py-2 text-sm font-semibold"
            href="/pencarian?tab=kelas"
          >
            Kelas
          </Link>
        </div>
        <Card className="mb-5">
          <StudentFilters classes={classes} />
        </Card>
        <StudentList students={search.result.items} showManagement={profile.role === "ADMIN"} />
        <div className="mt-5">
          <Pagination
            page={search.result.page}
            totalPages={totalPages}
            {...(search.result.page > 1 ? { previousHref: pageHref(search.result.page - 1) } : {})}
            {...(search.result.page < totalPages
              ? { nextHref: pageHref(search.result.page + 1) }
              : {})}
          />
        </div>
      </>
    );
  }

  const yearService = createAcademicYearService(createSupabaseAcademicYearRepository());
  const years = await yearService.list();

  if (years.length === 0) {
    return (
      <>
        <PageHeader
          title="Pencarian"
          description="Cari siswa atau buka ringkasan presensi berdasarkan kelas."
        />
        <EmptyState>Belum ada tahun ajaran.</EmptyState>
      </>
    );
  }

  const selectedYear =
    years.find((year) => year.id === params.year) ??
    years.find((year) => year.isActive) ??
    years[0]!;
  const classes = await createClassService(createSupabaseClassRepository()).list({
    academicYearId: selectedYear.id,
  });
  const selectedClass =
    classes.find((item) => item.id === params.classId) ??
    classes.find((item) => item.isActive) ??
    classes[0];

  const today = todayJakarta();
  const defaultDate =
    today < selectedYear.startDate
      ? selectedYear.startDate
      : today > selectedYear.endDate
        ? selectedYear.endDate
        : today;
  const selectedDate = clampDate(
    isIsoDate(params.date) ? params.date : defaultDate,
    selectedYear.startDate,
    selectedYear.endDate,
  );
  const visibleMonth = isMonthStart(params.month) ? params.month : `${selectedDate.slice(0, 7)}-01`;
  const data = selectedClass ? await getClassDashboard(selectedClass.id, selectedDate) : null;

  const columns = data
    ? ([
        ["Total", data.total, false],
        ["Sakit", data.sakit, true],
        ["Izin", data.izin, true],
        ["Tanpa Keterangan", data.tanpaKeterangan, true],
      ] as const)
    : [];

  return (
    <>
      <PageHeader
        title="Pencarian"
        description="Cari siswa atau buka ringkasan presensi berdasarkan kelas."
      />
      <div className="mb-5 flex gap-2">
        <Link
          className="rounded-lg border px-4 py-2 text-sm font-semibold"
          href="/pencarian?tab=siswa"
        >
          Siswa
        </Link>
        <Link
          className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"
          href="/pencarian?tab=kelas"
        >
          Kelas
        </Link>
      </div>

      <Card className="mb-5">
        <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto]" method="get">
          <input type="hidden" name="tab" value="kelas" />
          <FormField id="search-class-year" label="Tahun ajaran">
            <Select id="search-class-year" name="year" defaultValue={selectedYear.id}>
              {years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="search-class-id" label="Kelas">
            <Select id="search-class-id" name="classId" defaultValue={selectedClass?.id ?? ""}>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {classDisplayName(item.grade, item.classNumber)}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="flex items-end">
            <Button type="submit">Tampilkan kelas</Button>
          </div>
        </form>
      </Card>

      {!selectedClass || !data ? (
        <EmptyState>Belum ada kelas untuk tahun ajaran ini.</EmptyState>
      ) : (
        <div className="grid gap-5">
          <Card className="max-w-md">
            <DashboardCalendar
              selectedDate={selectedDate}
              visibleMonth={visibleMonth}
              basePath="/pencarian"
              fixedParams={{
                tab: "kelas",
                year: selectedYear.id,
                classId: selectedClass.id,
              }}
              minDate={selectedYear.startDate}
              maxDate={selectedYear.endDate}
            />
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {columns.map(([label, people, showPeriods]) => (
              <Card key={label}>
                <h2 className="mb-3 text-lg font-bold">
                  {label} ({people.length})
                </h2>
                <PersonList people={people} showPeriods={showPeriods} />
              </Card>
            ))}
          </div>

          <CategoryChart title="Tren bulanan kelas" data={data.monthly} />
        </div>
      )}
    </>
  );
}
