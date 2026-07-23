import {
  createAccountService,
  createSupabaseAccountRepository,
} from "@/modules/account-management";
import { requirePageAccess } from "@/modules/authorization";
import { formatJakartaDateTime } from "@/shared/domain/dates";
import {
  Card,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  Pagination,
  Select,
  Table,
} from "@/shared/ui";

type Props = { searchParams: Promise<{ page?: string; action?: string; search?: string }> };

export default async function AccountAuditPage({ searchParams }: Props) {
  await requirePageAccess("SUPER_ADMIN");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const result = await createAccountService(createSupabaseAccountRepository()).listAccountAudit({
    page,
    ...(params.action ? { action: params.action } : {}),
    ...(params.search ? { search: params.search } : {}),
  });
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
        description="Audit ACCOUNT bersifat append-only dan hanya terlihat oleh SUPER_ADMIN."
      />

      <Card className="mb-5">
        <form className="grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end" method="get">
          <FormField id="audit-search" label="Cari actor atau target">
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
              ].map((action) => (
                <option key={action} value={action}>
                  {action}
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
        <Card>
          <Table>
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="p-3">Waktu</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Tindakan</th>
                <th className="p-3">Target</th>
                <th className="p-3">Role target</th>
                <th className="p-3">Hasil</th>
                <th className="p-3">Sebelum / sesudah</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-100">
                  <td className="p-3">{formatJakartaDateTime(entry.createdAt)}</td>
                  <td className="p-3">{entry.actorName}</td>
                  <td className="p-3 font-semibold">{entry.action}</td>
                  <td className="p-3 font-mono text-xs">{entry.entityId ?? "—"}</td>
                  <td className="p-3">{String(entry.after?.role ?? entry.before?.role ?? "—")}</td>
                  <td className="p-3">{String(entry.metadata.status ?? "SUCCESS")}</td>
                  <td className="max-w-xs p-3 text-xs text-slate-600">
                    <details>
                      <summary className="cursor-pointer font-semibold text-[var(--brand)]">
                        Lihat snapshot
                      </summary>
                      <pre className="mt-2 max-w-sm whitespace-pre-wrap break-words">
                        {JSON.stringify({ before: entry.before, after: entry.after }, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          <div className="mt-5">
            <Pagination
              page={result.page}
              totalPages={totalPages}
              {...(result.page > 1 ? { previousHref: makeHref(result.page - 1) } : {})}
              {...(result.page < totalPages ? { nextHref: makeHref(result.page + 1) } : {})}
            />
          </div>
        </Card>
      )}
    </>
  );
}
