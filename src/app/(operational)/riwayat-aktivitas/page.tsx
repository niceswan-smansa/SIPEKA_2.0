import { requirePageAccess } from "@/modules/authorization";
import {
  createOperationalAuditService,
  createSupabaseOperationalAuditRepository,
} from "@/modules/operational-audit";
import { formatJakartaDateTime } from "@/shared/domain/dates";
import { Badge, Card, EmptyState, Input, PageHeader, Pagination } from "@/shared/ui";

type BadgeTone = "neutral" | "success" | "warning" | "danger";

export default async function OperationalAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePageAccess("ADMIN_MUTATION");
  const params = await searchParams;
  const result = await createOperationalAuditService(
    createSupabaseOperationalAuditRepository(),
  ).list(params);
  const page = Number(params.page ?? 1);
  const makeHref = (nextPage: number) => {
    const query = new URLSearchParams({ page: String(nextPage) });
    if (params.search) query.set("search", params.search);
    if (params.action) query.set("action", params.action);
    return `/riwayat-aktivitas?${query}`;
  };

  return (
    <>
      <PageHeader
        title="Riwayat Aktivitas"
        description="Ringkasan aktivitas operasional yang dilakukan ADMIN."
      />

      <Card className="mb-5">
        <form className="grid gap-3 md:grid-cols-[1fr_240px_auto] md:items-end">
          <label className="grid gap-1 text-sm font-semibold">
            Cari pelaku atau target
            <Input
              name="search"
              defaultValue={params.search}
              placeholder="Nama admin atau ID target"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Jenis aktivitas
            <Input
              name="action"
              defaultValue={params.action}
              placeholder="Contoh: STUDENT_IMPORT"
            />
          </label>
          <button
            className="min-h-10 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"
            type="submit"
          >
            Terapkan
          </button>
        </form>
      </Card>

      <div className="grid gap-3">
        {!result.items.length ? <EmptyState>Belum ada aktivitas operasional.</EmptyState> : null}

        {result.items.map((item) => {
          const changes = summarizeChanges(item.beforeData, item.afterData);
          const metadata = summarizeMetadata(item.metadata);
          return (
            <Card key={item.id}>
              <article>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Badge tone={actionTone(item.action)}>{actionLabel(item.action)}</Badge>
                    <p className="mt-2 font-semibold text-slate-900">
                      {item.actor} · {entityLabel(item.entityType)}
                    </p>
                  </div>
                  <time className="text-xs text-slate-500" dateTime={item.createdAt}>
                    {formatJakartaDateTime(item.createdAt)}
                  </time>
                </div>

                <p className="mt-2 text-sm text-slate-600">
                  {item.actor} melakukan {actionLabel(item.action).toLowerCase()} pada{" "}
                  {entityLabel(item.entityType).toLowerCase()}.
                </p>

                {changes.length ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {changes.map((change) => (
                      <div key={change.label} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <p className="text-xs font-semibold uppercase text-slate-500">
                          {change.label}
                        </p>
                        <p className="mt-1">
                          {change.before} <span aria-hidden="true">→</span> {change.after}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : metadata.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {metadata.map((item) => (
                      <span
                        key={item}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Aktivitas ini tidak memiliki perubahan data yang perlu ditampilkan.
                  </p>
                )}

                {item.entityId ? (
                  <p className="mt-3 text-xs text-slate-400">
                    Referensi: {shortReference(item.entityId)}
                  </p>
                ) : null}
              </article>
            </Card>
          );
        })}
      </div>

      <div className="mt-5">
        <Pagination
          page={page}
          totalPages={Math.max(1, Math.ceil(result.total / 20))}
          {...(page > 1 ? { previousHref: makeHref(page - 1) } : {})}
          {...(page * 20 < result.total ? { nextHref: makeHref(page + 1) } : {})}
        />
      </div>
    </>
  );
}

const ACTION_LABELS: Record<string, string> = {
  ACADEMIC_YEAR_CREATE: "Membuat tahun ajaran",
  ACADEMIC_YEAR_UPDATE: "Mengubah tahun ajaran",
  CLASS_UPDATE: "Mengubah kelas",
  STUDENT_CREATE: "Menambah siswa",
  STUDENT_UPDATE: "Mengubah siswa",
  STUDENT_MOVE: "Memindahkan siswa",
  STUDENT_DEACTIVATE: "Menonaktifkan siswa",
  ATTENDANCE_BATCH_APPLY: "Menyimpan presensi",
  STUDENT_REPORT_EXPORT: "Mengekspor laporan siswa",
  STUDENT_IMPORT: "Mengimpor siswa",
  STUDENT_PROMOTION_APPLY: "Menjalankan kenaikan grade",
  STUDENT_PROMOTION_ROLLBACK: "Membatalkan kenaikan grade",
  ALUMNI_ARCHIVE: "Mengarsipkan alumni",
  ALUMNI_TOMBSTONE: "Menghapus identitas alumni",
};

const ENTITY_LABELS: Record<string, string> = {
  academic_year: "Tahun ajaran",
  class: "Kelas",
  student: "Siswa",
  students: "Siswa",
  attendance_batch: "Presensi",
  import_batch: "Import siswa",
  promotion_batch: "Kenaikan grade",
};

const FIELD_LABELS: Record<string, string> = {
  name: "Nama",
  grade: "Grade",
  class_number: "Nomor kelas",
  homeroom_teacher: "Wali kelas",
  notes: "Catatan",
  is_active: "Status aktif",
  status: "Status",
  attendance_date: "Tanggal",
  period_number: "Jam",
  year_entered: "Tahun masuk",
  graduation_year: "Tahun lulus",
};

const IGNORED_FIELDS = new Set([
  "id",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by",
  "request_id",
  "normalized_name",
  "nis",
  "nisn",
  "full_name",
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readableValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (value === true) return "Aktif";
  if (value === false) return "Nonaktif";
  if (value === "IZIN") return "Izin";
  if (value === "SAKIT") return "Sakit";
  if (value === "TANPA_KETERANGAN") return "Tanpa Keterangan";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "Data diperbarui";
}

function summarizeChanges(beforeValue: unknown, afterValue: unknown) {
  const before = asRecord(beforeValue);
  const after = asRecord(afterValue);
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];

  return keys
    .filter((key) => !IGNORED_FIELDS.has(key))
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .slice(0, 4)
    .map((key) => ({
      label: FIELD_LABELS[key] ?? key.replaceAll("_", " "),
      before: readableValue(before[key]),
      after: readableValue(after[key]),
    }));
}

function summarizeMetadata(value: unknown) {
  const metadata = asRecord(value);
  const summaries: string[] = [];
  const known: Array<[string, string]> = [
    ["row_count", "Jumlah siswa"],
    ["student_count", "Jumlah siswa"],
    ["class_slots_created", "Kelas dibuat"],
    ["attendance_date", "Tanggal"],
    ["format", "Format"],
  ];

  for (const [key, label] of known) {
    if (metadata[key] !== undefined && metadata[key] !== null) {
      summaries.push(`${label}: ${readableValue(metadata[key])}`);
    }
  }
  return summaries.slice(0, 4);
}

function actionLabel(action: string) {
  return (
    ACTION_LABELS[action] ??
    action
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function entityLabel(entityType: string) {
  return ENTITY_LABELS[entityType] ?? entityType.replaceAll("_", " ");
}

function actionTone(action: string): BadgeTone {
  if (action.includes("DELETE") || action.includes("TOMBSTONE")) return "danger";
  if (action.includes("UPDATE") || action.includes("ROLLBACK")) return "warning";
  if (
    action.includes("CREATE") ||
    action.includes("IMPORT") ||
    action.includes("APPLY") ||
    action.includes("EXPORT")
  ) {
    return "success";
  }
  return "neutral";
}

function shortReference(value: string) {
  return value.length > 16 ? `…${value.slice(-12)}` : value;
}
