/**
 * Test: Supabase Persistence, Durable Outbox & Request Auth Context
 *
 * Verifies Batch 3 & 4 implementation:
 * - SupabaseInteriorRepository: Gate 0 tenant isolation, CRUD mapping, and production order idempotency
 * - SupabaseInteriorFinanceOutboxAdapter: Durable transactional outbox and milestone idempotency
 * - resolveInteriorContext: Guard against forbidden headers and unauthenticated access
 *
 * @module src/products/bella-interior/__tests__
 */

import { SupabaseInteriorRepository } from '../repositories/supabase.repository';
import { SupabaseInteriorFinanceOutboxAdapter } from '../adapters/supabase-finance-outbox.adapter';
import { resolveInteriorContext } from '../lib/server-context';
import type { InteriorProject, DesignRevision } from '../domain/design-specification/types';
import type { ProductionOrder } from '../domain/manufacturing-install/types';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('Bella Interior OS — Supabase Persistence & Durable Outbox', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const projectId = 'proj-test-001';

  describe('SupabaseInteriorRepository', () => {
    let mockSupabase: jest.Mocked<any>;
    let repository: SupabaseInteriorRepository;

    beforeEach(() => {
      mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        upsert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        single: jest.fn(),
        maybeSingle: jest.fn(),
      };
      repository = new SupabaseInteriorRepository(mockSupabase as unknown as SupabaseClient);
    });

    it('enforces tenant_id isolation when saving and fetching projects', async () => {
      const mockProject: InteriorProject = {
        id: projectId,
        tenantId,
        code: 'INT-2026-001',
        name: 'Villa Interior Fitout',
        customerId: 'cust-01',
        customerName: 'Nguyen Van A',
        customerPhone: '0901234567',
        siteAddress: '123 Nguyen Hue, Q1, HCMC',
        projectType: 'residential_villa',
        status: 'concept_design',
        estimatedBudget: 1_000_000_000,
        targetCompletionDate: '2026-12-31',
        leadArchitectId: 'arch-01',
        leadArchitectName: 'KTS Tran B',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockSupabase.upsert.mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      await repository.saveProject(tenantId, mockProject);
      expect(mockSupabase.from).toHaveBeenCalledWith('interior_projects');

      // Check getProject
      mockSupabase.single.mockResolvedValue({
        data: {
          id: projectId,
          tenant_id: tenantId,
          code: 'INT-2026-001',
          name: 'Villa Interior Fitout',
          customer_id: 'cust-01',
          customer_name: 'Nguyen Van A',
          customer_phone: '0901234567',
          site_address: '123 Nguyen Hue, Q1, HCMC',
          project_type: 'residential_villa',
          status: 'concept_design',
          estimated_budget: 1_000_000_000,
          target_completion_date: '2026-12-31',
          lead_architect_id: 'arch-01',
          lead_architect_name: 'KTS Tran B',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      const fetched = await repository.getProject(tenantId, projectId);
      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(projectId);
      expect(mockSupabase.eq).toHaveBeenCalledWith('tenant_id', tenantId);
    });

    it('fails closed before a production order write when tenant-scoped parent reads are unavailable', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No row found for tenant-scoped parent' },
      });

      const mockOrder: ProductionOrder = {
        id: 'po-001',
        tenantId,
        projectId,
        designRevisionId: 'rev-001',
        boqId: 'boq-001',
        orderNumber: 'PO-INT-001',
        mode: 'in_house',
        status: 'order_released',
        scheduledStartDate: '2026-06-01',
        scheduledCompletionDate: '2026-07-01',
        workshopManagerName: 'Workshop Manager',
        items: [],
      };

      // This mock has no tenant-scoped project, revision, or BOQ rows.
      await expect(repository.saveProductionOrder(tenantId, mockOrder)).rejects.toThrow(
        'Tenant isolation violation: production order project or revision is not in request tenant',
      );
      expect(mockSupabase.insert).not.toHaveBeenCalled();
    });
  });

  describe('SupabaseInteriorFinanceOutboxAdapter', () => {
    let mockSupabase: jest.Mocked<any>;
    let outbox: SupabaseInteriorFinanceOutboxAdapter;

    beforeEach(() => {
      mockSupabase = {
        rpc: jest.fn(),
        from: jest.fn().mockReturnThis(),
        insert: jest.fn(),
      };
      outbox = new SupabaseInteriorFinanceOutboxAdapter(mockSupabase as unknown as SupabaseClient);
    });

    it('enqueues finance milestone event with idempotency parameters', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 'outbox-uuid-1234',
        error: null,
      });

      const result = await outbox.enqueueFinanceMilestone({
        tenantId,
        projectId,
        contractId: 'contract-001',
        milestoneOrder: 1,
        milestoneName: 'Deposit',
        amount: 300_000_000,
        currency: 'VND',
        clientName: 'Nguyen Van A',
        occurredAt: new Date().toISOString(),
      });

      expect(result.status).toBe('queued');
      expect(result.outboxId).toBe('outbox-uuid-1234');
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'enqueue_interior_finance_event',
        expect.objectContaining({
          p_tenant_id: tenantId,
          p_event_type: 'INTERIOR_CONTRACT_MILESTONE_INVOICED',
          p_reference_type: 'PAYMENT_MILESTONE',
          p_reference_id: 'contract-001_m1',
        }),
      );
    });

    it('handles idempotent duplicate gracefully when RPC returns null (ON CONFLICT DO NOTHING)', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await outbox.enqueueFinanceMilestone({
        tenantId,
        projectId,
        contractId: 'contract-001',
        milestoneOrder: 1,
        milestoneName: 'Deposit',
        amount: 300_000_000,
        currency: 'VND',
        clientName: 'Nguyen Van A',
        occurredAt: new Date().toISOString(),
      });

      expect(result.status).toBe('queued');
      expect(result.outboxId).toBe('idempotent_contract-001_m1');
    });
  });

  describe('resolveInteriorContext Security Guards', () => {
    it('blocks forbidden client-controlled headers like x-tenant-id with 403', async () => {
      const forbiddenReq = new Request('https://example.com/api/interior/projects', {
        headers: {
          'x-tenant-id': 'hacked-tenant',
        },
      });

      const result = await resolveInteriorContext(forbiddenReq);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(403);
      }
    });

    it('blocks malformed authorization header with 401', async () => {
      const badAuthReq = new Request('https://example.com/api/interior/projects', {
        headers: {
          authorization: 'InvalidTokenFormat',
        },
      });

      const result = await resolveInteriorContext(badAuthReq);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(401);
      }
    });
  });
});

