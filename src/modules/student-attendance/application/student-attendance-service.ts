import type { StudentAttendanceRepository } from "../domain/student-attendance";

export function createStudentAttendanceService(repository: StudentAttendanceRepository) {
  return {
    get: repository.get,
    getReport: repository.getReport,
    recordExport: repository.recordExport,
  };
}
