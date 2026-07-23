import type {
  AttendanceBatchInput,
  AttendancePreview,
  AttendanceRepository,
  ClassAttendance,
} from "../domain/attendance";

export function createAttendanceService(repository: AttendanceRepository) {
  return {
    getClassAttendance(
      classId: string,
      attendanceDate: string,
      search?: string,
    ): Promise<ClassAttendance> {
      return repository.getClassAttendance(classId, attendanceDate, search);
    },
    preview(input: AttendanceBatchInput): Promise<AttendancePreview> {
      return repository.preview(input);
    },
    apply(input: AttendanceBatchInput & { token: string }) {
      return repository.apply(input);
    },
  };
}
