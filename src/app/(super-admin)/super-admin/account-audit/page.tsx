import {
  clearOperationalAuditAction,
  createAccountService,
  createSupabaseAccountRepository,
  OperationalAuditClearControl,
} from "@/modules/account-management";
import { requirePageAccess } from "@/modules/authorization";
import { formatJakartaDateTime } from "@/shared/domain/dates";
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  Pagination,
  Select,
} from "@/shared/ui";

type Props = {
  searchParams: Promise<{
    page?: string;
    action?: string;
    search?: string;
    success?: string;
    error?: string;
    count?: string;
  }>;
};

export default async function AccountAuditPage({ searchParams }: Props) {
  await requirePageAccess("SUPER_ADMIN");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const service = createAccountService(createSupabaseAccountRepository());
  const [result, operationalAuditCount] = await Promise.all([
    service.listAccountAudit({
      page,
      ...(params.action ? { action: params.action } : {}),
      ...(params.search ? { search: params.search } : {}),
    }),
    service.getOperationalAuditCount(),
  ]);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  const makeHref = (nextPage: number) => {
    const query = new URLSearchParams({ page: String(nextPage) });
    if (params.action) query.set("action", params.action);
    if (params.search) query.set("search", params.search);
    return `/super-admin/account-audit?${query}`;
  };

  return (
    <>
      <PageHeader
        title="Riwayat Akun"
        description="Riwayat akun tetap terpisah dari aktivitas operasional."
      />

      {params.success === "operational-cleared" ? (
        <div className="mb-4">
          <Alert tone="success">
            {Number(params.count ?? 0)} riwayat operasional berhasil dihapus.
          </Alert>
        </div>
      ) : null}

      {params.error === "operational-clear" ? (
        <div className="mb-4">
          <Alert tone="error">
            Riwayat operasional belum dapat dihapus. Pastikan konfirmasi diketik tepat.
          </Alert>
        </div>
      ) : null}

      <Card className="mb-5 border-red-200 bg-red-50/40">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-slate-900">Pembersihan riwayat operasional</h2>
            <p className="mt-1 text-sm text-slate-600">
              SUPER_ADMIN hanya melihat jumlah catatan, bukan isi aktivitas operasional.
            </p>
            <p className="mt-2 text-2xl font-bold">{operationalAuditCount}</p>
            <p className="text-xs uppercase text-slate-500">catatan operasional tersimpan</p>
          </div>
          <OperationalAuditClearControl
            action={clearOperationalAuditAction}
            count={operationalAuditCount}
          />
        </div>
      </Card>

      <Card className="mb-5">
        <form className="grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end" method="get">
          <FormField id="audit-search" label="Cari pelaku atau target">
            <Input id="audit-search" name="search" defaultValue={params.search} />
          </FormField>

          <FormField id="audit-action" label="Tindakan">
            <Select id="audit-action" name="action" defaultValue={params.action ?? ""}>
              <option value="">Semua tindakan</option>
              {[
                "CREATE",
                "UPDATE",
                "ROLE_CHANGE",
                "RESET_PASSWORD",
                "RESET_PASSWORD_FAILED",
                "ACTIVATE",
                "DEACTIVATE",
                "FORCE_LOGOUT",
                "FORCE_LOGOUT_FAILED",
                "DELETE",
                "DELETE_FAILED",
                "OPERATIONAL_AUDIT_CLEAR",
              ].map((action) => (
                <option key={action} value={action}>
                  {accountActionLabel(action)}
                </option>
              ))}
            </Select>
          </FormField>

          <button
            className="min-h-10 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"
            type="submit"
          >
            Terapkan
          </button>
        </form>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState>Belum ada riwayat akun.</EmptyState>
      ) : (
        <div className="grid gap-3">
          {result.items.map((entry) => {
            const changes = accountChanges(entry.before, entry.after);
            return (
              <Card key={entry.id}>
                <article>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Badge tone={entry.metadata.status === "FAILED" ? "danger" : "success"}>
                        {accountActionLabel(entry.action)}
                      </Badge>
                      <p className="mt-2 font-semibold">{entry.actorName}</p>
                    </div>
                    <time className="text-xs text-slate-500" dateTime={entry.createdAt}>
                      {formatJakartaDateTime(entry.createdAt)}
                    </time>
                  </div>

                  {changes.length ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {changes.map((change) => (
                        <div
                          key={change.label}
                          className="rounded-lg bg-slate-50 px-3 py-2 text-sm"
                        >
                          <p className="text-xs font-semibold uppercase text-slate-500">
                            {change.label}
                          </p>
                          <p className="mt-1">
                            {change.before} <span aria-hidden="true">→</span> {change.after}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-600">
                      {entry.action === "OPERATIONAL_AUDIT_CLEAR"
                        ? `${Number(entry.metadata.deleted_count ?? 0)} riwayat operasional dihapus.`
                        : "Tidak ada perubahan identitas yang perlu ditampilkan."}
                    </p>
                  )}

                  {entry.entityId ? (
                    <p className="mt-3 text-xs text-slate-400">
                      Referensi:{" "}
                      {entry.entityId.length > 16
                        ? `…${entry.entityId.slice(-12)}`
                        : entry.entityId}
                    </p>
                  ) : null}
                </article>
              </Card>
            );
          })}

          <div className="mt-2">
            <Pagination
              page={result.page}
              totalPages={totalPages}
              {...(result.page > 1 ? { previousHref: makeHref(result.page - 1) } : {})}
              {...(result.page < totalPages ? { nextHref: makeHref(result.page + 1) } : {})}
            />
          </div>
        </div>
      )}
    </>
  );
}

const ACCOUNT_FIELD_LABELS: Record<string, string> = {
  full_name: "Nama",
  username: "Username",
  role: "Role",
  is_active: "Status akun",
  must_change_password: "Wajib ganti password",
};

function accountValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (value === true) return "Ya";
  if (value === false) return "Tidak";
  return String(value);
}

function accountChanges(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) {
  const left = before ?? {};
  const right = after ?? {};
  return Object.keys(ACCOUNT_FIELD_LABELS)
    .filter((key) => JSON.stringify(left[key]) !== JSON.stringify(right[key]))
    .map((key) => ({
      label: ACCOUNT_FIELD_LABELS[key] ?? key,
      before: accountValue(left[key]),
      after: accountValue(right[key]),
    }));
}

const ACCOUNT_ACTION_LABELS: Record<string, string> = {
  CREATE: "Membuat akun",
  UPDATE: "Mengubah akun",
  ROLE_CHANGE: "Mengubah role",
  RESET_PASSWORD: "Reset password",
  RESET_PASSWORD_FAILED: "Reset password gagal",
  ACTIVATE: "Mengaktifkan akun",
  DEACTIVATE: "Menonaktifkan akun",
  FORCE_LOGOUT: "Mengeluarkan sesi",
  FORCE_LOGOUT_FAILED: "Pengeluaran sesi gagal",
  DELETE: "Menghapus akses",
  DELETE_FAILED: "Penghapusan akses gagal",
  OPERATIONAL_AUDIT_CLEAR: "Menghapus riwayat operasional",
};

function accountActionLabel(action: string) {
  return ACCOUNT_ACTION_LABELS[action] ?? action.replaceAll("_", " ");
}
