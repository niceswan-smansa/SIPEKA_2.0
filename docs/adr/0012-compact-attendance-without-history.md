# ADR 0012: Presensi Harian Padat Tanpa Riwayat Aplikasi

## Status

Accepted.

## Keputusan

SIPEKA menyimpan hanya kondisi presensi terbaru. Satu baris `attendance_days` mewakili satu siswa
pada satu tanggal. Jam yang tidak hadir disimpan dalam `period_statuses` sebagai pemetaan Jam 1–10
ke `IZIN`, `SAKIT`, atau `TANPA_KETERANGAN`. Jam yang tidak ada dalam pemetaan berarti Hadir.

Satu `note` berlaku untuk seluruh jam tidak hadir pada baris harian tersebut. Frontend tetap
menampilkan dan mengedit Jam 1–10. View kompatibilitas `attendance_records` mengembangkan bentuk
harian menjadi bentuk per jam untuk dashboard dan laporan yang memerlukan agregasi jam.

SIPEKA tidak menyimpan audit log, revision timeline, attendance batch history, account history,
atau export history. Menu dan route riwayat dihapus. `attendance_preview_tokens` tetap ada secara
sementara untuk preview sekali pakai, idempotensi, dan stale protection; token lama dibersihkan
otomatis.

## Konsekuensi

- Tidak tersedia identitas pelaku, nilai sebelum perubahan, atau rollback per perubahan presensi.
- Pemulihan kondisi lama hanya dapat dilakukan dari backup database.
- Promotion batch tetap merupakan state workflow untuk fitur rollback promotion, bukan audit log.
- `student_enrollments` tetap dipertahankan karena merupakan data akademik yang menentukan kelas
  siswa pada tanggal tertentu, bukan log aktivitas.
- Penyimpanan presensi, catatan, dan indeks berkurang signifikan dibanding satu baris per jam.
