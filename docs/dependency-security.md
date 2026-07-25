# Dependency Security

## Prinsip

SIPEKA tidak memakai `npm audit fix --force`, tidak melakukan downgrade breaking, dan tidak menyembunyikan advisory dengan mengubah level audit. Setiap exception harus dibatasi pada advisory, package chain, source runtime, dan versi yang dapat diverifikasi.

## GHSA-mh99-v99m-4gvg

Advisory `brace-expansion` memengaruhi versi sampai `5.0.7`; implementasi upstream yang dipakai sebagai basis remediation adalah `5.0.8`.

Sebagian dependency lama masih meminta `brace-expansion` 1.x atau 2.x dan mengharapkan API CommonJS callable. Memaksa paket 5.x langsung melalui nested `file:` override terbukti tidak portabel: npm dapat me-resolve path relatif terhadap package induk. Karena itu SIPEKA tidak lagi memakai local-directory override, local tarball override, atau adapter package replacement.

Remediation V10 mempertahankan package identity dan rentang semver legacy di lockfile, lalu menerapkan backport runtime yang deterministik:

1. root dependency `brace-expansion-safe` mengarah ke `npm:brace-expansion@5.0.8`;
2. `tools/patch-brace-expansion-legacy.mjs` menemukan setiap salinan 1.x/2.x setelah instalasi;
3. hanya main file package legacy yang diganti dengan adapter kecil dan terverifikasi;
4. adapter meneruskan seluruh ekspansi ke `brace-expansion-safe@5.0.8`;
5. patch dijalankan melalui root `postinstall`, `prebuild`, dan gate lokal;
6. validator menolak source yang berubah, package legacy yang belum dipatch, versi lain, dangling symlink, atau resolusi selain 5.0.8.

`node_modules` merupakan output instalasi dan tidak di-commit. Source patch, validator, policy, lockfile, dan konfigurasi lifecycle di-commit.

## Mengapa npm audit masih dapat melaporkan high

`npm audit` menilai versi dan metadata registry. Package legacy tetap mempunyai nomor versi 1.x/2.x agar consumer lama menerima API yang kompatibel, sehingga registry masih melaporkan advisory dan meta-vulnerability parent.

Policy tidak mengizinkan high secara umum. Laporan hanya diterima bila seluruh leaf advisory tepat `GHSA-mh99-v99m-4gvg` dan pemeriksaan runtime membuktikan bahwa semua main file legacy telah diganti dengan source backport yang identik dan me-resolve `brace-expansion@5.0.8`. Advisory, package chain, source, atau versi lain membuat CI gagal.

## Exception sementara ExcelJS → uuid

ExcelJS `4.4.0` masih membawa `uuid@8.3.2`. Exception hanya diterima untuk `GHSA-w5hq-g745-h8pq` ketika:

- satu-satunya parent lockfile yang meminta `uuid` adalah ExcelJS;
- source ExcelJS hanya memanggil `uuidv4()` tanpa caller-provided buffer;
- tidak ada advisory lain dalam chain tersebut.

Exception harus dihapus setelah ExcelJS memperbarui dependency `uuid`.

## Penghapusan backport

Backport harus dihapus ketika seluruh dependency parent telah memakai release resmi yang tidak lagi memasang versi terdampak. Penghapusan wajib diikuti instalasi bersih dan seluruh quality gate.
