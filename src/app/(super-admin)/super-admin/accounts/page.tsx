import Link from "next/link";

import {
  createAccountService,
  createSupabaseAccountRepository,
} from "@/modules/account-management";
import { requirePageAccess } from "@/modules/authorization";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  Pagination,
  Select,
  Table,
} from "@/shared/ui";

type Props = {
  searchParams: Promise<{
    page?: string;
    search?: string;
    role?: "ADMIN" | "USER";
    active?: string;
    success?: string;
  }>;
};

export default async function AccountsPage({ searchParams }: Props) {
  await requirePageAccess("SUPER_ADMIN");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const result = await createAccountService(createSupabaseAccountRepository()).listAccounts({
    page,
    ...(params.search ? { search: params.search } : {}),
    ...(params.role ? { role: params.role } : {}),
    ...(params.active === "true" || params.active === "false"
      ? { active: params.active === "true" }
      : {}),
  });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const makeHref = (nextPage: number) =>
    `/super-admin/accounts?page=${nextPage}${params.search ? `&search=${encodeURIComponent(params.search)}` : ""}`;
  return (
    <>
      <PageHeader
        title="Akun"
        description="Kelola akun ADMIN dan USER tanpa membuka akses operasional."
        action={
          <Link
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-dark)]"
            href="/super-admin/accounts/new"
          >
            Tambah Akun
          </Link>
        }
      />
      {params.success ? (
        <p
          className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          Operasi akun berhasil diproses.
        </p>
      ) : null}
      <Card className="mb-5">
        <form className="grid gap-4 md:grid-cols-[1fr_180px_180px_auto] md:items-end" method="get">
          <FormField id="account-search" label="Cari nama, username, atau email">
            <Input id="account-search" name="search" defaultValue={params.search} />
          </FormField>
          <FormField id="account-role" label="Role">
            <Select id="account-role" name="role" defaultValue={params.role ?? ""}>
              <option value="">Semua role</option>
              <option value="ADMIN">ADMIN</option>
              <option value="USER">USER</option>
            </Select>
          </FormField>
          <FormField id="account-status" label="Status">
            <Select id="account-status" name="active" defaultValue={params.active ?? ""}>
              <option value="">Semua status</option>
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </Select>
          </FormField>
          <Button type="submit">Terapkan</Button>
        </form>
      </Card>
      {result.items.length === 0 ? (
        <EmptyState>Tidak ada akun yang sesuai dengan filter.</EmptyState>
      ) : (
        <Card>
          <Table>
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="p-3">Nama</th>
                <th className="p-3">Username</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                <th className="p-3">Login terakhir</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {result.items.map((account) => (
                <tr key={account.id} className="border-b border-slate-100">
                  <td className="p-3 font-semibold">{account.fullName}</td>
                  <td className="p-3">{account.username}</td>
                  <td className="p-3">
                    <Badge>{account.role}</Badge>
                  </td>
                  <td className="p-3">
                    <Badge tone={account.isActive ? "success" : "danger"}>
                      {account.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="p-3 text-slate-600">
                    {account.lastLoginAt
                      ? new Date(account.lastLoginAt).toLocaleString("id-ID")
                      : "Belum tercatat"}
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      className="font-semibold text-[var(--brand)] hover:underline"
                      href={`/super-admin/accounts/${account.id}`}
                    >
                      Detail
                    </Link>
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
