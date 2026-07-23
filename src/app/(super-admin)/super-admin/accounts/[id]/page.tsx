import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import {
  AccountMutationControls,
  createAccountService,
  createSupabaseAccountRepository,
  deleteAccountAction,
  resetPasswordAction,
  setAccountActiveAction,
  updateAccountAction,
} from "@/modules/account-management";
import { requirePageAccess } from "@/modules/authorization";
import { formatJakartaDateTime } from "@/shared/domain/dates";
import { Badge, Button, Card, FormField, Input, PageHeader, Select } from "@/shared/ui";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function AccountDetailPage({ params, searchParams }: Props) {
  await requirePageAccess("SUPER_ADMIN");

  const idResult = z.uuid().safeParse((await params).id);
  if (!idResult.success) notFound();

  const id = idResult.data;
  const query = await searchParams;
  const service = createAccountService(createSupabaseAccountRepository());
  const account = await service.getAccount(id);
  if (!account || account.role === "SUPER_ADMIN") notFound();

  return (
    <>
      <PageHeader
        title="Detail akun"
        description="Perubahan administratif dicatat pada audit akun."
        action={
          <Link
            className="text-sm font-semibold text-[var(--brand)] hover:underline"
            href="/super-admin/accounts"
          >
            Kembali ke daftar
          </Link>
        }
      />

      {query.error ? (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {query.error === "SESSION_REVOCATION_UNSUPPORTED"
            ? "Sesi akun belum dapat dicabut secara langsung. Nonaktifkan akun atau gunakan reset password untuk membatasi akses."
            : query.error === "PASSWORD_RESET_AUTH_FAILED"
              ? "Akun sudah diblokir untuk mengganti password, tetapi password sementara belum berhasil ditetapkan."
              : query.error === "ACCOUNT_AUTH_CLEANUP_PENDING"
                ? "Akses akun sudah ditutup, tetapi pembersihan identitas autentikasi belum selesai. Coba hapus akses kembali."
                : query.error === "confirmation"
                  ? "Konfirmasi password tidak cocok."
                  : query.error === "policy"
                    ? "Password harus 12–128 karakter dan memuat huruf besar, huruf kecil, angka, serta simbol."
                    : query.error === "AUDIT_FAILURE"
                      ? "Perubahan tidak dianggap berhasil karena audit akun tidak dapat ditulis."
                      : "Operasi tidak dapat diselesaikan. Data tetap dilindungi."}
        </p>
      ) : null}

      {query.success ? (
        <p
          className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          Operasi akun berhasil diproses.
        </p>
      ) : null}

      <Card className="mb-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-slate-500">Nama</p>
            <p className="font-semibold">{account.fullName}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Username</p>
            <p className="font-semibold">{account.username}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Role</p>
            <Badge>{account.role}</Badge>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Status</p>
            <Badge tone={account.isActive ? "success" : "danger"}>
              {account.isActive ? "Aktif" : "Nonaktif"}
            </Badge>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Wajib ganti password</p>
            <p>{account.mustChangePassword ? "Ya" : "Tidak"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Login terakhir</p>
            <p>
              {account.lastLoginAt ? formatJakartaDateTime(account.lastLoginAt) : "Belum tercatat"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Dibuat</p>
            <p>{formatJakartaDateTime(account.createdAt)}</p>
          </div>
        </div>
      </Card>

      <Card className="mb-5">
        <h2 className="mb-4 text-lg font-bold">Edit identitas dan role</h2>
        <form action={updateAccountAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="id" value={account.id} />

          <FormField id="full-name" label="Nama lengkap">
            <Input id="full-name" name="fullName" defaultValue={account.fullName} required />
          </FormField>

          <FormField id="username" label="Username">
            <Input id="username" name="username" defaultValue={account.username} required />
          </FormField>

          <FormField id="role" label="Role">
            <Select id="role" name="role" defaultValue={account.role}>
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </Select>
          </FormField>

          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="isActive" defaultChecked={account.isActive} /> Akun aktif
          </label>

          <div className="sm:col-span-2">
            <Button type="submit">Simpan perubahan</Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-bold">Tindakan akun</h2>
        <AccountMutationControls
          id={account.id}
          fullName={account.fullName}
          isActive={account.isActive}
          resetAction={resetPasswordAction}
          statusAction={setAccountActiveAction}
          deleteAction={deleteAccountAction}
        />
      </Card>
    </>
  );
}
