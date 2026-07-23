import {
  AttendanceInput,
  createAttendanceService,
  createSupabaseAttendanceRepository,
  todayJakarta,
} from "@/modules/attendance";
import { requirePageAccess } from "@/modules/authorization";
import {
  classDisplayName,
  createClassService,
  createSupabaseClassRepository,
} from "@/modules/classes";
import { isIsoDate } from "@/shared/domain/dates";
import { Alert, Button, Card, FormField, PageHeader, Select } from "@/shared/ui";

type Props = { searchParams: Promise<{ classId?: string; date?: string }> };

function attendanceInputKey(initial: {
  classId: string;
  attendanceDate: string;
  items: Array<{
    id: string;
    attendance: Array<{ id: string; version: number }>;
  }>;
}) {
  const records = initial.items
    .flatMap((student) =>
      student.attendance.map((item) => `${student.id}:${item.id}:${item.version}`),
    )
    .sort()
    .join("|");

  return `${initial.classId}:${initial.attendanceDate}:${records}`;
}

export default async function AttendanceInputPage({ searchParams }: Props) {
  await requirePageAccess("ADMIN_MUTATION");

  const params = await searchParams;
  const date = isIsoDate(params.date) ? params.date : todayJakarta();
  const classes = (await createClassService(createSupabaseClassRepository()).list()).filter(
    (item) => item.academicYearActive && item.isActive,
  );
  const selectedClass = classes.find((item) => item.id === params.classId) ?? classes[0];
  const initial = selectedClass
    ? await createAttendanceService(createSupabaseAttendanceRepository()).getClassAttendance(
        selectedClass.id,
        date,
      )
    : null;

  return (
    <>
      <PageHeader
        title="Input Presensi"
        description="Catat ketidakhadiran per siswa dan jam pelajaran."
      />

      <Card className="mb-5">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <FormField id="attendance-date" label="Tanggal">
            <input
              id="attendance-date"
              name="date"
              type="date"
              max={todayJakarta()}
              defaultValue={date}
              className="min-h-10 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </FormField>

          <FormField id="attendance-class" label="Kelas">
            <Select
              id="attendance-class"
              name="classId"
              defaultValue={selectedClass?.id ?? ""}
              required
            >
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {classDisplayName(item.grade, item.classNumber)}
                </option>
              ))}
            </Select>
          </FormField>

          <Button type="submit">Muat data</Button>
        </form>
      </Card>

      {!selectedClass || !initial ? (
        <Alert tone="info">Belum ada kelas aktif pada tahun ajaran aktif.</Alert>
      ) : (
        <AttendanceInput key={attendanceInputKey(initial)} initial={initial} />
      )}
    </>
  );
}
