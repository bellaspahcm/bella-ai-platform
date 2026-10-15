/**
 * KTV Suggestion Actions Tests
 *
 * Tests for admin-facing Decision Engine suggestion actions:
 * - getKtvSuggestions()
 * - applyKtvSuggestion()
 */

const mockCreateClient = jest.fn();
const mockAutoAssignKtv = jest.fn();
const mockGetBookingActor = jest.fn();
const mockGetEligibleKtvs = jest.fn();

jest.mock('@/services/booking-ktv-eligibility', () => ({
  getBookingTenantActor: (...args: unknown[]) => mockGetBookingActor(...args),
  getEligibleBookingKtvs: (...args: unknown[]) => mockGetEligibleKtvs(...args),
}));

// Mock Supabase
jest.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
}));

// Mock booking decision service
jest.mock('@/services/booking-decision.service', () => ({
  autoAssignKtv: (...args: unknown[]) => mockAutoAssignKtv(...args),
}));

import { getKtvSuggestions, applyKtvSuggestion } from '../ktv-suggestion-actions';

type MockQueryBuilder = {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  eq: jest.Mock;
  not: jest.Mock;
  order: jest.Mock;
  single: jest.Mock;
  in: jest.Mock;
  then: jest.Mock;
};

type MockSupabaseClient = {
  from: jest.Mock;
  auth: {
    getUser: jest.Mock;
  };
};

describe('KTV AI Suggestion Actions', () => {
  let mockSupabase: MockSupabaseClient;
  let mockQueryBuilder: MockQueryBuilder;
  let mockCustomerQuery: MockQueryBuilder;
  let mockTenantQuery: MockQueryBuilder;

  beforeEach(() => {
    jest.clearAllMocks();

    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      then: jest.fn((resolve: (value: { data: unknown[]; error: null }) => unknown) =>
        resolve({ data: [], error: null })),
    };
    mockCustomerQuery = { ...mockQueryBuilder, single: jest.fn() };
    mockTenantQuery = {
      ...mockQueryBuilder,
      single: jest.fn().mockResolvedValue({ data: { metadata: {} }, error: null }),
    };

    mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'bookings') return mockQueryBuilder;
        if (table === 'customers') return mockCustomerQuery;
        if (table === 'tenants') return mockTenantQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null }),
      },
    };

    mockCreateClient.mockReturnValue(mockSupabase);
    mockGetBookingActor.mockImplementation(async (tenantId: string) => {
      if (tenantId !== 'tenant-001') throw new Error('Unauthorized tenant');
      return { id: 'admin', tenant_id: 'tenant-001', role: 'admin', status: 'active' };
    });
    mockGetEligibleKtvs.mockResolvedValue([{ id: 'ktv-selected' }]);
  });

  describe('getKtvSuggestions()', () => {
    it('rejects another tenant before invoking the engine', async () => {
      const result = await getKtvSuggestions({
        bookingId: 'booking-123', tenantId: 'tenant-other', requestedDate: '2026-10-15',
        requestedStartTime: '08:00', durationMinutes: 60,
      });
      expect(result.success).toBe(false);
      expect(result.suggestions).toEqual([]);
      expect(mockAutoAssignKtv).not.toHaveBeenCalled();
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should return suggestions from the Decision Engine successfully', async () => {
      // Mock booking lookup
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'booking-123',
          tenant_id: 'tenant-001',
          customer_id: 'customer-456',
          assigned_ktv_id: null,
          packages: {
            name: 'Combo Mẹ & Bé Hạnh Phúc',
            module_key: 'babycare',
            default_duration_minutes: 90,
          },
        },
        error: null,
      });

      // Mock customer tier lookup
      mockCustomerQuery.single.mockResolvedValueOnce({
        data: {
          loyalty_points: 1200,
          metadata: { status: 'vip' },
        },
        error: null,
      });

      // Mock Decision Engine results
      mockAutoAssignKtv.mockResolvedValue({
        assignedKtvId: 'ktv-optimal',
        assignedKtvName: 'KTV Optimal',
        confidence: 0.95,
        reason: 'Assigned to KTV Optimal (score: 95/100): Excellent ratings',
        executionTime: 12.4,
        alternatives: [
          {
            ktvId: 'ktv-runnerup',
            ktvName: 'KTV Runner Up',
            score: 85,
            reason: 'Assigned to KTV Runner Up (score: 85/100): High availability',
          },
        ],
      });

      const result = await getKtvSuggestions({
        bookingId: 'booking-123',
        tenantId: 'tenant-001',
        requestedDate: '2026-07-15',
        requestedStartTime: '14:00',
        durationMinutes: 90,
      });

      expect(result.success).toBe(true);
      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0].isRecommended).toBe(true);
      expect(result.suggestions[0].score).toBe(100); // hardcoded for winner wrapper in actions
      expect(result.suggestions[1].isRecommended).toBe(false);
      expect(result.suggestions[1].score).toBe(85);
      expect(result.evaluationMetadata?.executionTimeMs).toBe(12.4);
    });

    it('should return error if booking is not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: new Error('Not found'),
      });

      const result = await getKtvSuggestions({
        bookingId: 'booking-invalid',
        tenantId: 'tenant-001',
        requestedDate: '2026-07-15',
        requestedStartTime: '14:00',
        durationMinutes: 90,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Không tìm thấy booking');
    });
  });

  describe('applyKtvSuggestion()', () => {
    it.each(['ktv', 'ktv_lead', 'accountant', 'user'])('blocks non-admin %s without a write', async role => {
      mockGetBookingActor.mockResolvedValue({ tenant_id: 'tenant-001', role, status: 'active' });
      expect((await applyKtvSuggestion('booking-123', 'ktv-selected', 'tenant-001')).success).toBe(false);
      expect(mockQueryBuilder.update).not.toHaveBeenCalled();
      expect(mockGetEligibleKtvs).not.toHaveBeenCalled();
    });

    it('blocks failed actor authorization without a write', async () => {
      mockGetBookingActor.mockRejectedValue(new Error('Unauthorized actor'));
      expect((await applyKtvSuggestion('booking-123', 'ktv-selected', 'tenant-001')).success).toBe(false);
      expect(mockQueryBuilder.update).not.toHaveBeenCalled();
      expect(mockGetEligibleKtvs).not.toHaveBeenCalled();
    });

    it('rechecks a stale or tampered KTV choice before writing', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: { id: 'booking-123' }, error: null });
      mockGetEligibleKtvs.mockResolvedValue([]);
      const result = await applyKtvSuggestion('booking-123', 'orphan-ktv', 'tenant-001');
      expect(result.success).toBe(false);
      expect(result.error).toContain('KTV không có tài khoản');
      expect(mockGetEligibleKtvs).toHaveBeenCalledWith('tenant-001', 'orphan-ktv');
      expect(mockQueryBuilder.update).not.toHaveBeenCalled();
    });

    it('fails closed on account verification errors', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: { id: 'booking-123' }, error: null });
      mockGetEligibleKtvs.mockRejectedValue(new Error('Cannot verify account'));
      const result = await applyKtvSuggestion('booking-123', 'ktv-selected', 'tenant-001');
      expect(result).toEqual({ success: false, error: 'Cannot verify account' });
      expect(mockQueryBuilder.update).not.toHaveBeenCalled();
    });

    it('should update assigned_ktv_id successfully', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 'booking-123', tenant_id: 'tenant-001', status: 'active' },
        error: null,
      });

      mockQueryBuilder.update.mockReturnThis();
      mockQueryBuilder.eq.mockReturnThis();
      mockQueryBuilder.single.mockResolvedValueOnce({ data: null, error: null });

      const result = await applyKtvSuggestion('booking-123', 'ktv-selected', 'tenant-001');

      expect(result.success).toBe(true);
      expect(mockGetEligibleKtvs).toHaveBeenCalledWith('tenant-001', 'ktv-selected');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({ assigned_ktv_id: 'ktv-selected' });
    });

    it('should fail if booking does not exist under tenant', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Booking not found'),
      });

      const result = await applyKtvSuggestion('booking-123', 'ktv-selected', 'tenant-001');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Booking không tồn tại hoặc không thuộc chi nhánh này');
      expect(mockGetEligibleKtvs).not.toHaveBeenCalled();
    });
  });
});
