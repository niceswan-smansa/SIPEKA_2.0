# Checkpoint 8 — Audit Operasional, PWA Online-only, dan Hardening

## Scope

Phase 8 menambahkan `/riwayat-aktivitas` ADMIN-only, security headers/cache-control, rate limit login,
manifest/service worker online-only, offline fallback tanpa protected cache, dan smoke checks PWA.

## Security model

Audit operasional membaca `audit_logs` scope `OPERATIONAL` melalui session/RLS ADMIN; tidak ada
mutation endpoint. Account audit tetap terpisah dan SUPER_ADMIN tidak mendapat operational rows.
Protected routes mengirim `private, no-store`; CSP, frame-ancestors, nosniff, referrer, dan permissions
headers aktif. Login mempunyai bounded in-memory limiter sebagai defense-in-depth; deployment perlu
rate limiter terdistribusi bila multi-instance.

## PWA

`public/manifest.webmanifest`, `public/sw.js`, dan `public/offline.html` membuat aplikasi installable.
Service worker hanya menyimpan shell/icon/offline page; navigation, API, siswa, attendance, account,
audit, report, dan export selalu Network Only. Tidak ada localStorage draft atau background sync.

## Test

Operational audit read route, PWA manifest/offline worker, CSP/cache headers, bundle service-role scan,
RLS regression, unit, build, dan E2E dijalankan pada gate. PWA check memakai `npm run test:pwa`.

## Batasan

Rate limiter in-memory tidak menggantikan provider edge limit pada production. PWA tidak menyediakan
offline application functionality atau cached protected data. Accessibility memakai komponen/focus
baseline Phase 2 dan perlu audit manual WCAG pada UAT.
