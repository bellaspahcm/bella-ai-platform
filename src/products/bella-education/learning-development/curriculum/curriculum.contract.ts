/**
 * BELLA PRESCHOOL OS — CURRICULUM, LESSON PLANS & SUBJECTS CONTRACT
 *
 * Canonical Contract defining institutional educational frameworks,
 * developmental subjects/domains, and granular lesson plan specifications.
 *
 * Source of Truth: PostgreSQL tables `edu_curriculums` & `edu_lesson_plans`.
 *
 * @module src/products/bella-education/learning-development/curriculum/curriculum.contract
 */

export type CurriculumAgeGroup = 'ALL' | 'NURSERY' | 'TODDLER' | 'KINDY_1' | 'KINDY_2';

export type CurriculumStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type LessonPlanStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'ARCHIVED';

export interface SubjectItemDTO {
  readonly code: string;
  readonly name: string;
  readonly domain: string;
  readonly weeklyPeriods: number;
  readonly description?: string;
  readonly color: string;
}

export interface CurriculumDTO {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description?: string;
  readonly ageGroup: CurriculumAgeGroup;
  readonly academicYear: string;
  readonly totalWeeks: number;
  readonly status: CurriculumStatus;
  readonly subjects: readonly SubjectItemDTO[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LessonPlanObjectiveDTO {
  readonly knowledge: string; // Kiến thức
  readonly skills: string;    // Kỹ năng
  readonly attitude: string;  // Thái độ
}

export interface ActivityStepDTO {
  readonly stepNumber: number;
  readonly stepName: string; // e.g. "1. Ổn định - Gây hứng thú", "2. Hoạt động trọng tâm"
  readonly durationMinutes: number;
  readonly teacherAction: string;
  readonly childrenAction: string;
}

export interface LessonPlanDTO {
  readonly id: string;
  readonly curriculumId?: string;
  readonly courseId?: string;
  readonly courseName?: string;
  readonly academicYear: string;
  readonly weekNumber: number;
  readonly year: number;
  readonly ageGroup: CurriculumAgeGroup;
  readonly theme: string; // Chủ đề
  readonly subjectDomain: string; // Lĩnh vực / Môn học
  readonly title: string; // Tên bài dạy / Hoạt động
  readonly plannedDate: string; // YYYY-MM-DD
  readonly status: LessonPlanStatus;
  readonly objectives: LessonPlanObjectiveDTO;
  readonly materials?: string; // Chuẩn bị học cụ
  readonly activitySteps: readonly ActivityStepDTO[];
  readonly teacherNotes?: string;
  readonly createdBy?: string;
  readonly approvedBy?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SaveLessonPlanInput {
  readonly id?: string;
  readonly curriculumId?: string;
  readonly courseId?: string;
  readonly academicYear?: string;
  readonly weekNumber: number;
  readonly year: number;
  readonly ageGroup?: CurriculumAgeGroup;
  readonly theme: string;
  readonly subjectDomain: string;
  readonly title: string;
  readonly plannedDate: string; // YYYY-MM-DD
  readonly status: LessonPlanStatus;
  readonly objectives: LessonPlanObjectiveDTO;
  readonly materials?: string;
  readonly activitySteps: readonly ActivityStepDTO[];
  readonly teacherNotes?: string;
}

export interface SaveCurriculumInput {
  readonly id?: string;
  readonly code: string;
  readonly name: string;
  readonly description?: string;
  readonly ageGroup?: CurriculumAgeGroup;
  readonly academicYear?: string;
  readonly totalWeeks?: number;
  readonly status: CurriculumStatus;
  readonly subjects: readonly SubjectItemDTO[];
}

export interface SaveResult {
  readonly success: boolean;
  readonly id: string;
  readonly message?: string;
  readonly error?: string;
}

