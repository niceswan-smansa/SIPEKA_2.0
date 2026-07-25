export type AttendanceFailureMessage = {
  tone: "error" | "info";
  text: string;
};

export function attendanceFailureMessage(
  code: string,
  referenceId: string,
): AttendanceFailureMessage {
  const reference = ` Kode referensi: ${referenceId}.`;

  if (code === "ATTENDANCE_NO_CHANGES") {
    return { tone: "info", text: "Tidak ada perubahan presensi yang perlu disimpan." };
  }
  if (code === "STALE_PREVIEW" || code === "ATTENDANCE_ROSTER_CHANGED") {
    return {
      tone: "info",
      text: `Data siswa atau presensi telah berubah. Muat ulang lalu buat preview baru.${reference}`,
    };
  }
  if (code === "ATTENDANCE_TOKEN_USED") {
    return { tone: "info", text: `Preview sudah digunakan. Buat preview baru.${reference}` };
  }
  if (code === "ATTENDANCE_TOKEN_EXPIRED") {
    return { tone: "info", text: `Preview kedaluwarsa. Buat preview baru.${reference}` };
  }
  if (code === "ATTENDANCE_PERIOD_CONFIGURATION_INVALID") {
    return {
      tone: "error",
      text: `Konfigurasi Jam 1–10 pada database belum lengkap.${reference}`,
    };
  }
  if (code === "ATTENDANCE_CLASS_CONFLICT") {
    return {
      tone: "error",
      text: `Siswa sudah memiliki presensi pada jam yang sama di kelas lain.${reference}`,
    };
  }
  if (
    code === "DATE_OUTSIDE_ACADEMIC_YEAR" ||
    code === "CLASS_INACTIVE_OR_NOT_FOUND" ||
    code === "ATTENDANCE_SCOPE_INVALID"
  ) {
    return {
      tone: "error",
      text: `Tanggal atau kelas tidak sesuai tahun ajaran.${reference}`,
    };
  }
  if (code === "FUTURE_DATE_NOT_ALLOWED") {
    return {
      tone: "error",
      text: `Presensi tanggal masa depan tidak dapat disimpan.${reference}`,
    };
  }

  return {
    tone: "error",
    text: `Penyimpanan presensi belum dapat diselesaikan.${reference}`,
  };
}
