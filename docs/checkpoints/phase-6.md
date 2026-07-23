# Checkpoint 6 — Detail Presensi Siswa dan Laporan

## Scope

Detail siswa kini mempunyai kalender bulanan, tanggal terpilih, rincian jam 1–10, statistik hari dan
jam yang terpisah, tren bulanan, revision timeline, editor multi-period ADMIN, print view, dan export
Excel ADMIN. USER tetap read-only; SUPER_ADMIN tetap tidak mendapat akses operasional.

## File, migration, dan modul

- `supabase/migrations/20260723060000_phase6_student_attendance_reports.sql`
- `src/modules/student-attendance/`
- `src/modules/attendance/client.ts`
- `src/app/(operational)/siswa/[id]/page.tsx`
- `src/app/(operational)/siswa/[id]/laporan/page.tsx`
- `src/app/api/students/[id]/report/route.ts`
- `supabase/tests/rls/008_phase6_student_attendance.sql`
- `e2e/phase6.spec.ts`

## RPC dan security model

| RPC                             | Model keamanan dan fungsi                                       |
| ------------------------------- | --------------------------------------------------------------- |
| `phase6_get_student_attendance` | session operasional; detail, statistik, tren, revisions         |
| `phase6_get_student_report`     | session operasional; report read model                          |
| `phase6_record_student_export`  | ADMIN aktif; audit `STUDENT_ATTENDANCE_EXPORT` tanpa isi report |

Direct table write tetap tertutup. Editor detail memakai `phase4_preview_attendance` dan
`phase4_apply_attendance`, sehingga actor, token, stale protection, idempotency, transaction,
revision, batch, dan audit sama dengan input presensi kelas. Client entry point khusus mencegah
repository server-only masuk Client Component atau bundle.

## Semantik query dan statistik

- Jam 1–10 tanpa attendance record ditampilkan sebagai `Hadir`; tidak ada status HADIR di database.
- Statistik hari memakai tanggal unik per kategori.
- Statistik jam menghitung record period per kategori.
- Tren bulanan memakai tanggal sebagai X dan jumlah jam Izin/Sakit/Tanpa Keterangan sebagai series.
- Revision timeline menampilkan CREATE/UPDATE/DELETE, before/after, actor, batch, dan timestamp.

## Report dan export

Report menerima rentang minggu, bulan, semester, atau manual yang tervalidasi. Print view memakai CSS
print browser. ExcelJS menulis tanggal sebagai date, NIS/NISN sebagai string, menyanitasi nama file,
dan mengawali setiap string yang dapat menjadi formula dengan apostrof. Workbook dibuat in-memory,
tidak dicache, tidak disimpan sementara, dan export hanya dianggap berhasil setelah audit summary
OPERATIONAL berhasil.

## Test matrix dan hasil

- Unit: kalender, statistik hari/jam, report range, dan formula-safe cell.
- pgTAP: role matrix, read detail/report, audit export, append-only, dan direct-write regression.
- E2E: ADMIN create/update/delete multi-period melalui backend Phase 4, Hadir inference, statistik,
  revisions, print/Excel, formula injection, USER read-only, SUPER_ADMIN isolation, dan mobile.
- Auth fixture regression: provisioning canonical, direct Auth probe, must-change sendiri, urutan
  account-management → auth, dan full suite.

Root cause kegagalan Auth E2E sebelumnya adalah proses Next lokal lama yang mempertahankan environment
sebelum reset/provisioning. Provisioning kini memverifikasi returned Auth identity, probe menggunakan
CLI lokal proyek dan source fixture yang sama, Playwright tidak memakai server lama, dan script E2E
selalu reset/provision sebelum suite agar state mutation run sebelumnya tidak terbawa.

Gate final lulus: format, lint, typecheck, 12 file/44 unit test, production build, 14 E2E, bundle
service-role scan, dua asset, reset database kosong, database type generation/check, lima akun
disposable, direct Auth probe, 9 file/232 pgTAP, audit high, dan diff check. E2E juga lulus dua kali
berturut-turut (14/14 setiap run). `npm audit --audit-level=high` exit 0; terdapat dua advisory
moderate transitif dari ExcelJS/uuid yang hanya menawarkan downgrade major sebagai perbaikan.

## Risiko dan batasan

PDF memakai print-to-PDF browser, bukan renderer server. Phase ini tidak menambahkan import,
promotion, alumni, audit operasional UI, atau PWA.
