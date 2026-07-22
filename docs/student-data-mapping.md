# Draft Mapping Data Siswa Existing

Status: draft hasil inspeksi read-only Phase 0. Tidak ada import atau normalisasi sumber.

## Format sumber

- Tiga workbook Excel `.xlsx` (OOXML/ZIP; XML Unicode; delimiter dan text encoding eksternal tidak
  berlaku).
- Workbook X memiliki 10 sheet kelas yang dapat dikenali (`X-1` sampai `X-10`) dan satu support
  sheet.
- Workbook XI memiliki 17 sheet (13 visible, 3 hidden, 1 hidden kosong). Nama/urutan kelas belum
  cukup konsisten untuk mapping otomatis.
- Workbook XII memiliki 16 visible sheet; 13 tampak seperti template presensi sehingga tidak boleh
  diasumsikan langsung sebagai 10 kelas.
- Header kandidat muncul pada bagian awal sheet, tetapi posisi dan kelengkapannya bervariasi.
- Formula dan merged cells ada; nilai formula bukan source of truth identifier.

## Proposed target mapping

| Source                 | Target                     | Aturan draft                                                          |
| ---------------------- | -------------------------- | --------------------------------------------------------------------- |
| `NO`                   | tidak disimpan             | Nomor urut sumber saja                                                |
| `NIS`                  | `students.nis`             | Baca sebagai text, trim, pertahankan leading zero, wajib unik         |
| `NISN`                 | `students.nisn`            | Baca sebagai text, trim, pertahankan leading zero, wajib unik         |
| `NAMA` / `NAMA SISWA`  | `students.full_name`       | Trim dan rapikan whitespace; jangan ubah ejaan secara otomatis        |
| turunan nama           | `students.normalized_name` | Dibentuk adapter, bukan ditulis kembali ke workbook                   |
| `L/P`                  | `students.gender`          | Normalisasi eksplisit hanya ke enum `L` atau `P`; selain itu error    |
| konteks workbook/sheet | grade dan class target     | Gunakan mapping eksplisit yang disetujui; jangan menebak sheet ambigu |
| nama file `26-27`      | academic year              | Kandidat `2026/2027`, wajib dikonfirmasi sebelum import               |

Tidak ditemukan field sumber yang cukup andal untuk `year_entered`, `graduation_year`, status aktif,
atau enrollment date. Field tersebut tidak boleh direka.

## Contoh tersensor

```text
Source: NO=<urutan>, NIS=<disensor>, NISN=<disensor>, NAMA SISWA=<disensor>, L/P=P
Target: nis=<disensor>, nisn=<disensor>, full_name=<disensor>, gender=P,
        class=<menunggu mapping eksplisit>
```

## Validasi wajib untuk Phase 7

- Definisikan sheet-to-class map eksplisit, terutama workbook XI dan XII.
- Bedakan template kelas dari support/master sheet dan abaikan formula/summary rows.
- Deteksi duplikasi NIS/NISN lintas seluruh workbook tanpa mencetak nilainya.
- Tolak row tanpa identifier, nama, gender valid, atau mapping kelas yang pasti.
- Buat dry-run count, redacted error report, dan transaksi all-or-nothing; jangan menulis database
  sebelum seluruh ambiguity diselesaikan.
