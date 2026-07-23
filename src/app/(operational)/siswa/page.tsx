import { requirePageAccess } from "@/modules/authorization";
import { createClassService, createSupabaseClassRepository } from "@/modules/classes";
import {
  createStudentSearchRepository,
  createStudentSearchService,
  StudentFilters,
} from "@/modules/student-search";
import { StudentList } from "@/modules/students";
import { Card, PageHeader, Pagination } from "@/shared/ui";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function StudentSearchPage({ searchParams }: Props) {
  const profile = await requirePageAccess("OPERATIONAL");
  const params = await searchParams;
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
    for (const [key, value] of Object.entries(params))
      if (value && key !== "page") query.set(key, value);
    query.set("page", String(page));
    return `/siswa?${query.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Cari Siswa"
        description="Pencarian partial berdasarkan nama, NIS, atau NISN dengan filter opsional."
      />
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
