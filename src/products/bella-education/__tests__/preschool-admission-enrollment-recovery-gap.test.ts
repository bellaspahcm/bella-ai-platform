/**
 * Diagnostic evidence only: exercises the unchanged public Enrollment contract
 * with controlled repository/policy dependencies. This is NOT Real DB evidence
 * and does not authorize a Kernel fix or establish a new credit policy.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Enrollment } from '@/platform/education/domain/enrollment.entity';

const mockRows = new Map<string, Enrollment>();
let mockCreditLimit = 24;
let mockCourseStatus = 'active';
const mockPublish = jest.fn(async () => undefined);
const mockTransaction = jest.fn(async (input: {
  tenantId: string; studentPartyId: string; courseId: string;
  enrollmentId: string; requestId: string;
}) => {
  const existing = mockRows.get(input.requestId);
  if (existing) return { isDuplicate: true, enrollmentId: existing.id };
  if (mockRows.size >= 1) throw new Error('Course capacity exceeded');
  const now = new Date('2026-10-19T00:00:00.000Z');
  const enrollment = Enrollment.reconstitute({
    id: input.enrollmentId, tenantId: input.tenantId,
    studentPartyId: input.studentPartyId, courseId: input.courseId,
    requestId: input.requestId, status: 'active', enrolledAt: now,
    createdAt: now, updatedAt: now,
  });
  mockRows.set(input.requestId, enrollment);
  return { isDuplicate: false, enrollmentId: enrollment.id };
});

const mockRepository = {
  verifyStudentRole: jest.fn(async () => ({ isValid: true })),
  getActiveEnrollmentsCount: jest.fn(async () => mockRows.size),
  findCourseById: jest.fn(async () => ({
    status: mockCourseStatus, prerequisiteCourseCodes: [], maxStudents: 1,
  })),
  executeEnrollStudentTransaction: mockTransaction,
  findEnrollmentById: jest.fn(async (id: string, tenantId: string) =>
    [...mockRows.values()].find((row) => row.id === id && row.tenantId === tenantId) ?? null),
};

jest.mock('@/platform/education/repositories/supabase-education.repository', () => ({
  SupabaseEducationRepository: jest.fn().mockImplementation(() => mockRepository),
}));
jest.mock('@/platform/education/contracts/policy-registry.contract.impl', () => ({
  PolicyRegistryContractImpl: jest.fn().mockImplementation(() => ({
    getPolicy: async () => ({ value: mockCreditLimit }),
  })),
}));
jest.mock('@/platform/education/contracts/workflow-registry.contract.impl', () => ({
  WorkflowRegistryContractImpl: jest.fn().mockImplementation(() => ({
    getWorkflow: async () => ({ initialState: 'active' }),
  })),
}));
jest.mock('@/platform/host/event-bus', () => ({
  eventBus: { publish: mockPublish, subscribe: jest.fn() },
}));
jest.mock('@/lib/supabase-server', () => ({ createClient: jest.fn(() => ({})) }));

const { EnrollmentContractImpl } = require('@/platform/education/contracts/enrollment.contract.impl') as
  typeof import('@/platform/education/contracts/enrollment.contract.impl');

const input = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  studentPartyId: '10000000-0000-4000-8000-000000000002',
  courseId: '10000000-0000-4000-8000-000000000003',
  requestId: '10000000-0000-4000-8000-000000000004',
};

describe('unchanged public Enrollment contract durable recovery boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRows.clear();
    mockCreditLimit = 24;
    mockCourseStatus = 'active';
  });

  it('recovers the original ID at capacity=1 when eligibility still passes', async () => {
    const first = await new EnrollmentContractImpl().enrollStudent(input);
    // Simulate a caller restart: a new contract instance and only requestId retained.
    const retry = await new EnrollmentContractImpl().enrollStudent(input);
    expect(retry.id).toBe(first.id);
    expect(mockRows.size).toBe(1);
    expect(mockTransaction).toHaveBeenCalledTimes(2);
    expect(mockPublish).toHaveBeenCalledTimes(1);
  });

  it('cannot recover a committed request at a configured 3-credit cap: replay fails before deduplication', async () => {
    mockCreditLimit = 3; // Controlled existing policy input, not a proposed Product rule.
    mockPublish.mockRejectedValueOnce(new Error('Controlled failure after enrollment persistence'));
    await expect(new EnrollmentContractImpl().enrollStudent(input))
      .rejects.toThrow('Controlled failure after enrollment persistence');
    // No successful acknowledgement: Product has requestId but no returned ID.
    expect(mockRows.size).toBe(1);
    await expect(new EnrollmentContractImpl().enrollStudent(input))
      .rejects.toThrow('Platform credit limit exceeded');
    expect(mockRows.size).toBe(1);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockRepository.findEnrollmentById).toHaveBeenCalledTimes(1);
  });

  it('cannot recover a committed request after the course is made inactive', async () => {
    await new EnrollmentContractImpl().enrollStudent(input);
    mockCourseStatus = 'archived';
    await expect(new EnrollmentContractImpl().enrollStudent(input))
      .rejects.toThrow('expected active');
    expect(mockRows.size).toBe(1);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockRepository.findEnrollmentById).toHaveBeenCalledTimes(1);
  });
});
