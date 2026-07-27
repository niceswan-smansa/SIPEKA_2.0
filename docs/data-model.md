# Model Data

SQL migration adalah source of truth. Prisma tidak digunakan.

## Entitas utama

- `profiles`: akun aplikasi dan role.
- `academic_years`: rentang tahun ajaran; maksimal satu aktif.
- `classes`: 30 slot X-1 sampai XII-10 per tahun ajaran.
- `students`: identitas siswa dan posisi akademik terkini.
- `student_enrollments`: penempatan siswa berdasarkan rentang waktu.
- `periods`: konfigurasi Jam 1–10.
- `attendance_days`: storage presensi padat per siswa per tanggal.
- `attendance_preview_tokens`: token sementara untuk preview/apply stale-safe.
- `import_batches`: state hasil import yang diperlukan UI/workflow.
- `promotion_batches` dan `promotion_batch_items`: snapshot fungsional untuk rollback promotion.

Tidak ada `audit_logs`, `attendance_revisions`, atau `attendance_batches`.

## Presensi

`attendance_days` memiliki struktur konseptual:

```text
id
student_id
class_id
attendance_date
period_statuses
note
version
created_at
updated_at
```

Constraint unik `(student_id, attendance_date)` memastikan maksimal satu row per siswa per hari.
`period_statuses` hanya boleh berisi key `"1"` sampai `"10"` dan value:

```text
IZIN | SAKIT | TANPA_KETERANGAN
```

Contoh:

```json
{
  "1": "SAKIT",
  "2": "SAKIT",
  "5": "IZIN",
  "8": "TANPA_KETERANGAN"
}
```

Jam yang tidak terdapat dalam object adalah `Hadir`. Ketika object kosong, row dihapus. `note`
berlaku untuk ketidakhadiran pada tanggal tersebut dan dibatasi 500 karakter.

`attendance_records` adalah compatibility view read-oriented yang mengembangkan satu row harian
menjadi satu row per jam. Dashboard, detail siswa, laporan, dan export tetap dapat mengonsumsi bentuk
per jam tanpa menduplikasi storage utama.

## Konsistensi mutation

Mutation presensi hanya melalui RPC:

- `phase4_get_class_attendance`
- `phase4_preview_attendance`
- `phase4_apply_attendance`

Preview memvalidasi payload, roster pada tanggal, class conflict, status, catatan, dan konfigurasi
Jam 1–10. Snapshot mencakup row presensi harian dan roster kelas/tanggal. Apply memakai advisory
lock, memverifikasi token/payload/snapshot, lalu mengubah satu row harian per siswa dalam transaksi.

Tidak ada revision atau audit yang dibuat. Hasil apply hanya mengembalikan summary kepada request
saat itu.

## Read model

- `phase5_get_dashboard`: agregasi siswa unik berdasarkan status.
- `phase6_get_student_attendance`: rincian Jam 1–10, kalender, statistik, dan tren.
- `phase10_get_student_report`: laporan rentang tanggal hingga satu tahun.
- `phase12_get_grade_attendance_export`: data workbook grade.

Read model mengembangkan `period_statuses` melalui compatibility view atau JSON iteration.

## Keamanan

RLS mengizinkan ADMIN dan USER membaca data operasional sesuai policy. Direct
INSERT/UPDATE/DELETE dari role `authenticated` tetap ditolak. RPC mutation memverifikasi actor dari
session database; browser tidak menentukan role sendiri.

## Workflow akademik

`promotion_batches` dan `promotion_batch_items` tetap ada karena rollback membutuhkan snapshot
before/after yang deterministik. Keduanya bukan riwayat aktivitas umum. Import dan promotion tidak
membuat log terpisah.

## Tipe TypeScript

Tipe database dihasilkan dari Supabase lokal:

```bash
npm run db:types
npm run db:types:check
```
