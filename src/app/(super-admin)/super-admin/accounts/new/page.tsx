import Link from "next/link";

import { createAccountAction } from "@/modules/account-management";
import { requirePageAccess } from "@/modules/authorization";
import { Button, Card, FormField, Input, PageHeader, PasswordInput, Select } from "@/shared/ui";

type Props = { searchParams: Promise<{ error?: string }> };
export default async function NewAccountPage({ searchParams }: Props) {
  await requirePageAccess("SUPER_ADMIN");
  const params = await searchParams;
  return (
    <>
      <PageHeader
        title="Tambah Akun"
        description="Buat akun ADMIN atau USER. SUPER_ADMIN tidak dapat dibuat dari portal."
      />
      <Card className="max-w-2xl">
        {params.error ? (
          <p className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            Akun tidak dapat dibuat. Periksa data dan coba lagi.
          </p>
        ) : null}
        <form action={createAccountAction} className="grid gap-5">
          <FormField id="full-name" label="Nama lengkap">
            <Input id="full-name" name="fullName" required />
          </FormField>
          <FormField id="username" label="Username">
            <Input id="username" name="username" autoComplete="username" required />
            <span className="text-xs font-normal text-slate-500">
              Huruf kecil, angka, titik, garis bawah, atau tanda hubung.
            </span>
          </FormField>
          <FormField id="role" label="Role">
            <Select id="role" name="role" defaultValue="USER">
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </Select>
          </FormField>
          <FormField id="temporary-password" label="Password sementara">
            <PasswordInput
              id="temporary-password"
              name="password"
              autoComplete="new-password"
              required
            />
          </FormField>
          <FormField id="temporary-confirmation" label="Konfirmasi password">
            <PasswordInput
              id="temporary-confirmation"
              name="confirmation"
              autoComplete="new-password"
              required
            />
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked /> Akun aktif
          </label>
          <div className="flex gap-2">
            <Button type="submit">Buat Akun</Button>
            <Link
              className="inline-flex min-h-10 items-center rounded-lg border px-4 py-2 text-sm font-semibold"
              href="/super-admin/accounts"
            >
              Batal
            </Link>
          </div>
        </form>
      </Card>
    </>
  );
}
