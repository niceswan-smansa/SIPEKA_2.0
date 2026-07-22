# ADR 0006: Turunan asset landing

Status: Accepted

Sumber `logo1.png` dan `BG_landingpage.png` tidak ditimpa. Build memakai turunan WebP stabil di
`public/assets/`, dengan metadata non-esensial di-strip dan pemeriksaan keberadaan pada
`npm run test:assets`. Pemilik deployment bertanggung jawab atas izin publikasi visual hero.
