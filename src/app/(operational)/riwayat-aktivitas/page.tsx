import { requirePageAccess } from "@/modules/authorization";
import {
  createOperationalAuditService,
  createSupabaseOperationalAuditRepository,
} from "@/modules/operational-audit";
import { Card, EmptyState, Input, PageHeader, Pagination } from "@/shared/ui";

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
  return (
    <>
      <PageHeader
        title="Riwayat Aktivitas"
        description="Audit operasional append-only untuk ADMIN."
      />
      <form className="mt-4 flex flex-wrap gap-2">
        <Input name="search" defaultValue={params.search} placeholder="Cari actor atau target" />
        <Input name="action" defaultValue={params.action} placeholder="Filter action" />
        <button
          className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"
          type="submit"
        >
          Filter
        </button>
      </form>
      <div className="mt-5 grid gap-3">
        {!result.items.length ? <EmptyState>Belum ada aktivitas operasional.</EmptyState> : null}
        {result.items.map((item) => (
          <Card key={item.id}>
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span className="font-semibold">{item.action}</span>
              <time dateTime={item.createdAt}>
                {new Date(item.createdAt).toLocaleString("id-ID")}
              </time>
            </div>
            <p className="mt-2 text-sm">
              {item.actor} · {item.entityType} · {item.entityId ?? "—"}
            </p>
            <details className="mt-2 text-xs">
              <summary>Detail aman</summary>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap">
                {JSON.stringify(
                  { before: item.beforeData, after: item.afterData, metadata: item.metadata },
                  null,
                  2,
                )}
              </pre>
            </details>
          </Card>
        ))}
      </div>
      <Pagination page={page} totalPages={Math.max(1, Math.ceil(result.total / 20))} />
    </>
  );
}
