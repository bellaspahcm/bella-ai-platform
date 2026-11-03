import type { EducationAttendanceDTO } from './attendance.contract';

/** Current Preschool administrator's history for one authorized enrollment. */
export interface IPreschoolStudentAttendanceHistoryContract {
  getAuthorizedHistory(tenantId: string, enrollmentId: string): Promise<readonly EducationAttendanceDTO[]>;
}
