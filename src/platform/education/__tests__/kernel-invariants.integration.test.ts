/**
 * Education OS — Kernel Invariants Integration Tests (CC-4.1)
 * 
 * Verifies rule-governed prerequisites, governed overrides, capacity concurrency,
 * database-level idempotency, and transactional rollbacks.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { MemoryEventBusAdapter, DomainEventEnvelope } from '../../core/events';
import { Course } from '../domain/course.entity';
import { EducationEngineService, OverrideRequest } from '../education-engine.service';
import { SupabaseEducationRepository } from '../repositories/supabase-education.repository';
import { AssessmentContractImpl } from '../contracts/assessment.contract.impl';
import crypto from 'crypto';

jest.setTimeout(60000);

describe('Education OS — Kernel Invariants Integration Tests', () => {
  let supabase: SupabaseClient<Record<string, unknown>>;
  let eventBus: MemoryEventBusAdapter;
  let repository: SupabaseEducationRepository;
  let service: EducationEngineService;

  const TEST_TENANT = '77777777-7777-7777-7777-77777777777a';

  beforeAll(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials for integration tests');
    }

    supabase = createClient(supabaseUrl, supabaseKey);
    eventBus = new MemoryEventBusAdapter();
    repository = new SupabaseEducationRepository(supabase);
    service = new EducationEngineService(repository, eventBus);

    // Clean up test records
    await cleanupDb();

    // Seed test tenant
    await supabase.from('tenants').upsert([
      { id: TEST_TENANT, name: 'Invariants Testing School', status: 'active' },
    ]);
  });

  afterAll(async () => {
    await cleanupDb();
  });

  beforeEach(() => {
    eventBus.clear();
  });

  async function cleanupDb() {
    await supabase.from('platform_rule_evaluation_log').delete().eq('tenant_id', TEST_TENANT);
    await supabase.from('platform_business_rules').delete().eq('tenant_id', TEST_TENANT);
    await supabase.from('edu_enrollments').delete().eq('tenant_id', TEST_TENANT);
    await supabase.from('enrollments').delete().eq('tenant_id', TEST_TENANT);
    await supabase.from('edu_courses').delete().eq('tenant_id', TEST_TENANT);
    await supabase.from('courses').delete().eq('tenant_id', TEST_TENANT);
    await supabase.from('assessment_results').delete().eq('tenant_id', TEST_TENANT);
    await supabase.from('assessments').delete().eq('tenant_id', TEST_TENANT);
    await supabase.from('students').delete().eq('tenant_id', TEST_TENANT);
    await supabase.from('persons').delete().eq('tenant_id', TEST_TENANT);
    await supabase.from('party_parties').delete().eq('tenant_id', TEST_TENANT);
    await supabase.from('tenants').delete().eq('id', TEST_TENANT);
  }

  async function seedStudent(studentPartyId: string, studentCode: string, name: string): Promise<string> {
    const { error: err1 } = await supabase.from('party_parties').upsert({
      id: studentPartyId,
      tenant_id: TEST_TENANT,
      party_type: 'person',
      display_name: name,
    });
    if (err1) throw new Error(`seedStudent: party_parties fail: ${err1.message}`);

    const studentId = crypto.randomUUID();
    const { error: err3 } = await supabase.from('students').upsert({
      student_id: studentId,
      tenant_id: TEST_TENANT,
      party_id: studentPartyId,
      person_id: null,
      student_code: studentCode,
      academic_status: 'enrolled',
      enrollment_type: 'full_time',
      program_id: 'prog-01',
      enrollment_date: '2026-01-01',
    });
    if (err3) throw new Error(`seedStudent: students fail: ${err3.message}`);

    return studentId;
  }

  async function seedCourse(
    courseId: string,
    courseCode: string,
    title: string,
    maxStudents?: number | null,
    currentEnrollment?: number,
    prerequisiteCourseCodes?: string[]
  ): Promise<Course> {
    // 1. Seed edu_courses (Kernel)
    const course = Course.reconstitute({
      id: courseId,
      tenantId: TEST_TENANT,
      courseCode,
      title,
      status: 'active',
      maxStudents,
      currentEnrollment,
      prerequisiteCourseCodes,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await repository.saveCourse(course);

    // 2. Seed courses (Vertical product layer)
    const { error } = await supabase.from('courses').upsert({
      course_id: courseId,
      tenant_id: TEST_TENANT,
      course_code: courseCode,
      course_name: title,
      credits: 3,
      status: 'active',
    });
    if (error) throw new Error(`seedCourse: courses fail: ${error.message}`);

    return course;
  }

  async function seedPrereqEnrollment(
    enrollmentId: string,
    studentPartyId: string,
    studentId: string,
    courseId: string
  ) {
    // 1. Seed edu_enrollments (Kernel)
    const { error: err1 } = await supabase.from('edu_enrollments').insert({
      id: enrollmentId,
      tenant_id: TEST_TENANT,
      student_party_id: studentPartyId,
      course_id: courseId,
      status: 'completed',
      request_id: crypto.randomUUID(),
    });
    if (err1) throw new Error(`seedPrereqEnrollment: edu_enrollments fail: ${err1.message}`);

    // 2. Seed enrollments (Vertical product layer)
    const { error: err2 } = await supabase.from('enrollments').insert({
      enrollment_id: enrollmentId,
      tenant_id: TEST_TENANT,
      student_id: studentId,
      course_id: courseId,
      status: 'completed',
      enrollment_date: new Date().toISOString().split('T')[0],
    });
    if (err2) throw new Error(`seedPrereqEnrollment: enrollments fail: ${err2.message}`);
  }

  async function seedGradingRule(scaleType: 'scale_10' | 'percentage' | 'gpa_4', passingThreshold: number, version: string) {
    const conditions = {
      operator: 'AND',
      rules: [
        {
          field: 'scaleType',
          op: 'EQ',
          value: scaleType,
        }
      ]
    };

    const actionParams = {
      passingThreshold,
    };

    // Remove existing active rules for this test domain
    await supabase.from('platform_business_rules')
      .delete()
      .eq('tenant_id', TEST_TENANT)
      .eq('domain', 'education.enrollment');

    const { data, error } = await supabase.from('platform_business_rules').insert({
      tenant_id: TEST_TENANT,
      rule_key: 'education.grading_rule',
      version,
      domain: 'education.enrollment',
      name: `Grading Rule ${scaleType}`,
      status: 'ACTIVE',
      severity: 'LOW',
      conditions,
      action_type: 'BLOCK',
      action_params: actionParams,
    }).select().single();

    if (error) {
      throw new Error(`Failed to seed grading rule: ${error.message}`);
    }
    return data;
  }

  describe('Prerequisite Checks with Versioned Grading Rules', () => {
    it('should validate prerequisite under Vietnamese 10-point scale: 4.5 -> BLOCK, 5.0 -> ALLOW', async () => {
      // 1. Seed Vietnamese Scale 10 Rule
      await seedGradingRule('scale_10', 5.0, '1.2.0');

      // 2. Create courses (Course A is prerequisite to Course B)
      const courseAId = crypto.randomUUID();
      const courseBId = crypto.randomUUID();
      const courseA = await seedCourse(courseAId, 'PREREQ-V10-A', 'Vietnamese Math Foundation A');
      const courseB = await seedCourse(courseBId, 'PREREQ-V10-B', 'Vietnamese Math Foundation B', null, 0, ['PREREQ-V10-A']);

      // 3. Create two students (Student 1 gets 4.5, Student 2 gets 5.0)
      const person1 = crypto.randomUUID();
      const person2 = crypto.randomUUID();
      const studentId1 = await seedStudent(person1, 'STU-V10-01', 'Student One');
      const studentId2 = await seedStudent(person2, 'STU-V10-02', 'Student Two');

      // 4. Enroll both in prerequisite Course A
      const enrollA1 = crypto.randomUUID();
      const enrollA2 = crypto.randomUUID();
      await seedPrereqEnrollment(enrollA1, person1, studentId1, courseA.id);
      await seedPrereqEnrollment(enrollA2, person2, studentId2, courseA.id);

      // 5. Grade their scores using AssessmentContractImpl (which maps to assessment tables)
      const assessmentContract = new AssessmentContractImpl();
      await assessmentContract.recordScore({
        tenantId: TEST_TENANT,
        enrollmentId: enrollA1,
        scoreType: 'quiz',
        grade: 4.5,
        weight: 100,
      });

      await assessmentContract.recordScore({
        tenantId: TEST_TENANT,
        enrollmentId: enrollA2,
        scoreType: 'quiz',
        grade: 5.0,
        weight: 100,
      });

      // 6. Attempt enrollment for Student 1 (4.5) -> should fail / throw
      await expect(
        service.enrollStudent({
          tenantId: TEST_TENANT,
          studentPartyId: person1,
          courseId: courseB.id,
          requestId: crypto.randomUUID(),
        })
      ).rejects.toThrow('Prerequisite check failed');

      // 7. Attempt enrollment for Student 2 (5.0) -> should succeed
      const result2 = await service.enrollStudent({
        tenantId: TEST_TENANT,
        studentPartyId: person2,
        courseId: courseB.id,
        requestId: crypto.randomUUID(),
      });
      expect(result2.success).toBe(true);
      expect(result2.enrollment?.status).toBe('active');
    });

    it('should validate prerequisite under Percentage scale: 69 -> BLOCK, 70 -> ALLOW', async () => {
      // 1. Seed Percentage Scale Rule (70 threshold)
      await seedGradingRule('percentage', 70.0, '2.0.0');

      // 2. Create courses
      const courseAId = crypto.randomUUID();
      const courseBId = crypto.randomUUID();
      const courseA = await seedCourse(courseAId, 'PREREQ-P100-A', 'Percentage Physics A');
      const courseB = await seedCourse(courseBId, 'PREREQ-P100-B', 'Percentage Physics B', null, 0, ['PREREQ-P100-A']);

      // 3. Create two students
      const person1 = crypto.randomUUID();
      const person2 = crypto.randomUUID();
      const studentId1 = await seedStudent(person1, 'STU-P100-01', 'Physics Student One');
      const studentId2 = await seedStudent(person2, 'STU-P100-02', 'Physics Student Two');

      // 4. Enroll in Course A
      const enrollA1 = crypto.randomUUID();
      const enrollA2 = crypto.randomUUID();
      await seedPrereqEnrollment(enrollA1, person1, studentId1, courseA.id);
      await seedPrereqEnrollment(enrollA2, person2, studentId2, courseA.id);

      // 5. Record scores: 69 and 70
      const assessmentContract = new AssessmentContractImpl();
      await assessmentContract.recordScore({
        tenantId: TEST_TENANT,
        enrollmentId: enrollA1,
        scoreType: 'quiz',
        grade: 69,
        weight: 100,
      });

      await assessmentContract.recordScore({
        tenantId: TEST_TENANT,
        enrollmentId: enrollA2,
        scoreType: 'quiz',
        grade: 70,
        weight: 100,
      });

      // 6. Check enrollment B for Student 1 (69) -> BLOCK
      await expect(
        service.enrollStudent({
          tenantId: TEST_TENANT,
          studentPartyId: person1,
          courseId: courseB.id,
          requestId: crypto.randomUUID(),
        })
      ).rejects.toThrow('Prerequisite check failed');

      // 7. Check enrollment B for Student 2 (70) -> ALLOW
      const result2 = await service.enrollStudent({
        tenantId: TEST_TENANT,
        studentPartyId: person2,
        courseId: courseB.id,
        requestId: crypto.randomUUID(),
      });
      expect(result2.success).toBe(true);
    });
  });

  describe('Governed Override Invariants', () => {
    it('should bypass prerequisite check when valid OverrideRequest payload is supplied', async () => {
      // 1. Seed Rule
      await seedGradingRule('scale_10', 5.0, '1.2.0');

      // 2. Create courses (prerequisite not met)
      const courseAId = crypto.randomUUID();
      const courseBId = crypto.randomUUID();
      const courseA = await seedCourse(courseAId, 'OVER-A', 'Chem A');
      const courseB = await seedCourse(courseBId, 'OVER-B', 'Chem B', null, 0, ['OVER-A']);

      // 3. Create Student
      const person = crypto.randomUUID();
      await seedStudent(person, 'STU-OVER-01', 'Overriding Student');

      // 4. Enroll but student has NO score (so fails prerequisite check)
      const overrideRequest: OverrideRequest = {
        actorId: '00000000-0000-0000-0000-000000000001',
        reason: 'Exceptional academic background in high school',
        ruleVersion: '1.2.0',
        timestamp: new Date().toISOString(),
        targetStudent: person,
        targetCourse: courseB.id,
        authorization: 'academic_board_override_approved',
        auditEvidence: 'evidence_pdf_checksum_abc123',
      };

      // 5. Try enrolling without override -> fails
      await expect(
        service.enrollStudent({
          tenantId: TEST_TENANT,
          studentPartyId: person,
          courseId: courseB.id,
          requestId: crypto.randomUUID(),
        })
      ).rejects.toThrow('Prerequisite check failed');

      // 6. Try enrolling with valid override -> succeeds
      const result = await service.enrollStudent({
        tenantId: TEST_TENANT,
        studentPartyId: person,
        courseId: courseB.id,
        requestId: crypto.randomUUID(),
        overrideRequest,
      });

      expect(result.success).toBe(true);
      expect(result.enrollment?.status).toBe('active');
    });

    it('should reject override if OverrideRequest validation fails (missing fields)', async () => {
      await seedGradingRule('scale_10', 5.0, '1.2.0');
      const courseAId = crypto.randomUUID();
      const courseBId = crypto.randomUUID();
      const courseA = await seedCourse(courseAId, 'OVER-FAIL-A', 'Bio A');
      const courseB = await seedCourse(courseBId, 'OVER-FAIL-B', 'Bio B', null, 0, ['OVER-FAIL-A']);

      const person = crypto.randomUUID();
      await seedStudent(person, 'STU-OVER-FAIL', 'Failing Student');

      // Missing actorId and auditEvidence
      const invalidOverride: any = {
        reason: 'Wants to bypass check',
        ruleVersion: '1.2.0',
        timestamp: new Date().toISOString(),
        targetStudent: person,
        targetCourse: courseB.id,
        authorization: 'academic_board_override_approved',
      };

      await expect(
        service.enrollStudent({
          tenantId: TEST_TENANT,
          studentPartyId: person,
          courseId: courseB.id,
          requestId: crypto.randomUUID(),
          overrideRequest: invalidOverride,
        })
      ).rejects.toThrow('OverrideRequest validation failed: Missing required fields');
    });
  });

  describe('Database Capacity Concurrency and Idempotency Invariants', () => {
    it('should enforce course capacity: max_students = 2 -> only 2 enrollments succeed, others fail', async () => {
      // 1. Create course with max_students = 2
      const courseId = crypto.randomUUID();
      const course = await seedCourse(courseId, 'CAP-CONC', 'Concurrent Cap Course', 2);

      // 2. Seed 4 students
      const p1 = crypto.randomUUID();
      const p2 = crypto.randomUUID();
      const p3 = crypto.randomUUID();
      const p4 = crypto.randomUUID();
      await seedStudent(p1, 'STU-CAP-01', 'Cap Student 1');
      await seedStudent(p2, 'STU-CAP-02', 'Cap Student 2');
      await seedStudent(p3, 'STU-CAP-03', 'Cap Student 3');
      await seedStudent(p4, 'STU-CAP-04', 'Cap Student 4');

      // 3. Trigger concurrent enrollments
      const promises = [
        service.enrollStudent({ tenantId: TEST_TENANT, studentPartyId: p1, courseId: course.id, requestId: crypto.randomUUID() }),
        service.enrollStudent({ tenantId: TEST_TENANT, studentPartyId: p2, courseId: course.id, requestId: crypto.randomUUID() }),
        service.enrollStudent({ tenantId: TEST_TENANT, studentPartyId: p3, courseId: course.id, requestId: crypto.randomUUID() }),
        service.enrollStudent({ tenantId: TEST_TENANT, studentPartyId: p4, courseId: course.id, requestId: crypto.randomUUID() }),
      ];

      const results = await Promise.allSettled(promises);

      const fulfilled = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
      const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];

      expect(fulfilled).toHaveLength(2);
      expect(rejected).toHaveLength(2);

      rejected.forEach(err => {
        expect(err.reason.message).toContain('Course capacity exceeded');
      });

      // Verify final counter is exactly 2 in DB
      const dbCourse = await repository.findCourseById(course.id, TEST_TENANT);
      expect(dbCourse?.currentEnrollment).toBe(2);
      expect(dbCourse?.status).toBe('active');
    });

    it('should enforce idempotency retry: identical requests yield identical result without increasing enrollment count or emitting second event', async () => {
      const courseId = crypto.randomUUID();
      const course = await seedCourse(courseId, 'IDEM-TEST', 'Idempotency Course', 5);

      const person = crypto.randomUUID();
      await seedStudent(person, 'STU-IDEM', 'Idempotency Student');

      const events: DomainEventEnvelope<unknown>[] = [];
      eventBus.subscribe('edu.enrollment.created.v1', async (evt) => {
        events.push(evt);
      });

      const requestId = crypto.randomUUID();

      // Request 1
      const res1 = await service.enrollStudent({
        tenantId: TEST_TENANT,
        studentPartyId: person,
        courseId: course.id,
        requestId,
      });
      expect(res1.success).toBe(true);
      expect(res1.isDuplicate).toBe(false);
      expect(res1.eventPublished).toBe(true);
      expect(events).toHaveLength(1);

      // Request 2 (identical retry)
      const res2 = await service.enrollStudent({
        tenantId: TEST_TENANT,
        studentPartyId: person,
        courseId: course.id,
        requestId,
      });
      expect(res2.success).toBe(true);
      expect(res2.isDuplicate).toBe(true);
      expect(res2.eventPublished).toBe(false);
      expect(res2.enrollment?.id).toBe(res1.enrollment?.id);
      expect(events).toHaveLength(1); // No new event published

      // Verify course count is only 1
      const dbCourse = await repository.findCourseById(course.id, TEST_TENANT);
      expect(dbCourse?.currentEnrollment).toBe(1);
    });

    it('should return duplicate true instead of capacity exceeded for duplicate request on full course', async () => {
      // 1. Create course with max_students = 1
      const courseId = crypto.randomUUID();
      const course = await seedCourse(courseId, 'CAP-RACE', 'Concurrent Race Course', 1);

      const person = crypto.randomUUID();
      await seedStudent(person, 'STU-CAP-RACE', 'Race Student');

      const requestId = crypto.randomUUID();

      // 2. Request 1 succeeds and fills the course
      const res1 = await service.enrollStudent({
        tenantId: TEST_TENANT,
        studentPartyId: person,
        courseId: course.id,
        requestId,
      });
      expect(res1.success).toBe(true);

      const dbCourseAfter = await repository.findCourseById(course.id, TEST_TENANT);
      expect(dbCourseAfter?.currentEnrollment).toBe(1);
      expect(dbCourseAfter?.status).toBe('active');

      // 3. Request 2 (identical retry while course is full) -> should return duplicate success, NOT capacity block!
      const res2 = await service.enrollStudent({
        tenantId: TEST_TENANT,
        studentPartyId: person,
        courseId: course.id,
        requestId,
      });

      expect(res2.success).toBe(true);
      expect(res2.isDuplicate).toBe(true);
      expect(res2.enrollment?.id).toBe(res1.enrollment?.id);
    });

    it('should not publish events on failure and correctly rollback transaction', async () => {
      const courseId = crypto.randomUUID();
      const course = await seedCourse(courseId, 'ROLLBACK-TEST', 'Rollback Course', 1);

      // Student 1 (succeeds)
      const p1 = crypto.randomUUID();
      await seedStudent(p1, 'STU-RB-01', 'Rollback Student 1');

      // Student 2 (will fail)
      const p2 = crypto.randomUUID();
      await seedStudent(p2, 'STU-RB-02', 'Rollback Student 2');

      const events: DomainEventEnvelope<unknown>[] = [];
      eventBus.subscribe('edu.enrollment.created.v1', async (evt) => {
        events.push(evt);
      });

      // 1. First enrollment succeeds
      await service.enrollStudent({
        tenantId: TEST_TENANT,
        studentPartyId: p1,
        courseId: course.id,
        requestId: crypto.randomUUID(),
      });
      expect(events).toHaveLength(1);

      // 2. Second enrollment fails due to capacity
      await expect(
        service.enrollStudent({
          tenantId: TEST_TENANT,
          studentPartyId: p2,
          courseId: course.id,
          requestId: crypto.randomUUID(),
        })
      ).rejects.toThrow('Course capacity exceeded');

      // Verify no second event was published
      expect(events).toHaveLength(1);

      // Verify student 2 enrollment was NOT created in DB (full rollback)
      const { data: enrollments } = await supabase
        .from('edu_enrollments')
        .select('*')
        .eq('student_party_id', p2)
        .eq('tenant_id', TEST_TENANT);

      expect(enrollments).toHaveLength(0);
    });
  });
});
