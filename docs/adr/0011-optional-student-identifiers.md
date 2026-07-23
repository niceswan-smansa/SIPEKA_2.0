# ADR 0011: Optional student identifiers

Status: Accepted

`students.id` UUID adalah identity canonical. NIS dan NISN merupakan atribut
opsional: `NULL` diperbolehkan untuk banyak siswa, sedangkan nilai non-NULL
tetap unik. NIS hanya digit; NISN tepat 10 digit. Database memakai partial
unique indexes.

CSV operasional menolak identifier malformed. Tool migrasi workbook existing
boleh mengubah hanya lima nilai yang telah direview menjadi `NULL` berdasarkan
lokasi sheet/baris eksplisit. Tool tidak membuat placeholder dan tidak
menyimpan raw malformed value.
