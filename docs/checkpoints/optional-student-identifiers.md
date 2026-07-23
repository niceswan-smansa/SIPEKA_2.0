# Optional Student Identifiers and Real Local Bootstrap

Migration `20260723090000_optional_student_identifiers.sql` membuat NIS/NISN
nullable, menambah format constraint dan partial unique indexes, memperbarui
RPC siswa/search/import, serta menyediakan RPC migrasi service-role local-only.

Tool `student-real-local-bootstrap.mjs` membaca tiga workbook secara read-only,
memakai mapping 30 sheet eksplisit, dan hanya mengeluarkan reconciliation
redacted. Lima nilai yang telah direview menjadi NULL; CSV operasional tetap
menolak nilai malformed.

Expected dan verified reconciliation: 30 kelas; X 359, XI 358, XII 350; total
1.067; tiga NIS NULL; dua NISN NULL; pending nol.

Gate: Prettier, ESLint, TypeScript, 50 unit tests, build, 16 E2E, bundle/assets/PWA
checks, reset dari nol, type generation/sync, 281 pgTAP tests, audit level high,
idempotent bootstrap, dan smoke non-destruktif lulus. `npm audit` masih
melaporkan dua advisory moderate transitif ExcelJS; tidak ada advisory high.
