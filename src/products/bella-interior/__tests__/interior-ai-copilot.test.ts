/**
 * BELLA INTERIOR OS — AI COPILOT & EXECUTIVE BOARD TESTS
 *
 * Verifies:
 *   1. RBAC (Role-Based Access Control) for Interior AI Copilot.
 *   2. Multi-Tenant Isolation (Gate 0 / P0) & RLS query verification.
 *   3. 6 Specialized AI Executive Directors:
 *      - AI CCO (Giám đốc Kinh doanh): sales conversion & contract upsell
 *      - AI COO (Giám đốc Vận hành & Thi công): schedule slippage & site recovery
 *      - AI CPO (Giám đốc Sản xuất & Xưởng): Spec Lock approval & CNC orders
 *      - AI CHRO (Giám đốc Nhân sự & Năng suất): Architect workload & recruitment
 *      - AI CFO (Giám đốc Tài chính - Kế toán): P&L margin & milestone debt recovery
 *      - AI Strategic Advisor (Cố vấn Quản trị): Cross-functional bottleneck synthesis
 *   4. Draft action proposal structuring for human-in-the-loop approval.
 *
 * @module src/products/bella-interior/__tests__/interior-ai-copilot.test
 */

import {
  canUseAiCopilotRole,
  canUseInteriorAiCopilotRole,
  INTERIOR_AI_COPILOT_ROLES,
} from '@/lib/business-rules/permissions';
import { runInteriorAgent } from '@/services/ai/agents/interior';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

describe('Bella Interior OS — AI Copilot RBAC Security', () => {
  it('allows authorized roles to use Interior AI Copilot', () => {
    const authorizedRoles = [
      'admin',
      'super_admin',
      'project_manager',
      'lead_architect',
      'architect',
      'accountant',
      'workshop_manager',
      'site_supervisor',
    ];

    for (const role of authorizedRoles) {
      expect(canUseInteriorAiCopilotRole(role)).toBe(true);
      expect(canUseAiCopilotRole(role)).toBe(true);
    }
  });

  it('rejects unauthorized roles from accessing Interior AI Copilot', () => {
    const unauthorizedRoles = [
      'ktv',
      'therapist',
      'guest',
      'student',
      'cleaner',
      'random_worker',
      '',
      null,
      undefined,
    ];

    for (const role of unauthorizedRoles) {
      expect(canUseInteriorAiCopilotRole(role)).toBe(false);
      expect(canUseAiCopilotRole(role)).toBe(false);
    }
  });

  it('normalizes role casing and whitespace correctly', () => {
    expect(canUseInteriorAiCopilotRole('  PROJECT_MANAGER  ')).toBe(true);
    expect(canUseInteriorAiCopilotRole('Lead_Architect')).toBe(true);
    expect(canUseInteriorAiCopilotRole('  ADMIN ')).toBe(true);
    expect(canUseInteriorAiCopilotRole('  KTV ')).toBe(false);
  });
});

describe('Bella Interior OS — AI Sub-Agent RLS & Tenant Isolation', () => {
  it('executes queries strictly scoped to tenantId (Multi-Tenant Isolation Gate 0)', async () => {
    const executedFilters: Array<{ column: string; value: unknown }> = [];

    const mockSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockImplementation((column: string, value: unknown) => {
        executedFilters.push({ column, value });
        return {
          order: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'proj-db-001',
                name: 'Penthouse Landmark 81',
                code: 'INT-2024-999',
                stage: 'design',
                progress_percent: 20,
                schedule_status: 'delayed',
                tenant_id: 'tenant-interior-alpha',
              },
            ],
            error: null,
          }),
        };
      }),
    });

    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: mockSelect,
      }),
    } as unknown as SupabaseClient<Database>;

    const tenantId = 'tenant-interior-alpha';
    const activeDate = new Date('2026-11-08T00:00:00Z');

    const result = await runInteriorAgent(mockSupabase, tenantId, activeDate);

    // Verify tenant_id filter was strictly called
    expect(executedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ column: 'tenant_id', value: tenantId }),
      ])
    );

    // Verify agent response structure
    expect(result.agent).toContain('Bella Interior');
    expect(result.summary).toBeTruthy();
    expect(result.anomalies).toBeDefined();
    expect(Array.isArray(result.draftProposals)).toBe(true);
    expect(result.draftProposals?.length).toBeGreaterThan(0);
  });
});

describe('Bella Interior OS — 6 Specialized AI Executive Directors', () => {
  const createMockSupabase = () => ({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient<Database>);

  it('AI CCO (Giám đốc Kinh doanh): analyzes conversion opportunities and contract follow-ups', async () => {
    const result = await runInteriorAgent(createMockSupabase(), 'tenant-001', new Date(), 'interior_cco');
    expect(result.agent).toContain('Kinh doanh');
    const proposalTypes = result.draftProposals?.map((p) => p.type) || [];
    expect(proposalTypes).toContain('interior_sales_followup');
  });

  it('AI COO (Giám đốc Vận hành): detects schedule slippage and generates recovery plans', async () => {
    const result = await runInteriorAgent(createMockSupabase(), 'tenant-001', new Date(), 'interior_coo');
    expect(result.agent).toContain('Vận hành');
    const proposalTypes = result.draftProposals?.map((p) => p.type) || [];
    expect(proposalTypes).toContain('interior_schedule_recovery');
  });

  it('AI CPO (Giám đốc Sản xuất): enforces Spec Lock approval and factory production orders', async () => {
    const result = await runInteriorAgent(createMockSupabase(), 'tenant-001', new Date(), 'interior_cpo');
    expect(result.agent).toContain('Sản xuất');
    const proposalTypes = result.draftProposals?.map((p) => p.type) || [];
    expect(proposalTypes).toContain('interior_spec_lock_approval');
    expect(proposalTypes).toContain('interior_workshop_production_order');
  });

  it('AI CHRO (Giám đốc Nhân sự): balances architect workload and peak-season workshop recruitment', async () => {
    const result = await runInteriorAgent(createMockSupabase(), 'tenant-001', new Date(), 'interior_chro');
    expect(result.agent).toContain('Nhân sự');
    const proposalTypes = result.draftProposals?.map((p) => p.type) || [];
    expect(proposalTypes).toContain('interior_architect_rebalance');
    expect(proposalTypes).toContain('interior_workshop_recruitment');
  });

  it('AI CFO (Giám đốc Tài chính): monitors margin compression and milestone debt collection', async () => {
    const result = await runInteriorAgent(createMockSupabase(), 'tenant-001', new Date(), 'interior_cfo');
    expect(result.agent).toContain('Tài chính');
    const proposalTypes = result.draftProposals?.map((p) => p.type) || [];
    expect(proposalTypes).toContain('interior_boq_variance_review');
    expect(proposalTypes).toContain('interior_milestone_payment_followup');
  });

  it('AI Strategic Advisor: provides cross-functional value chain synthesis and executive resolutions', async () => {
    const result = await runInteriorAgent(createMockSupabase(), 'tenant-001', new Date(), 'interior_advisor');
    expect(result.agent).toContain('Quản trị');
    const proposalTypes = result.draftProposals?.map((p) => p.type) || [];
    expect(proposalTypes).toContain('interior_executive_action');

    // Verify all proposals have human-in-the-loop fields
    for (const proposal of result.draftProposals || []) {
      expect(proposal.type).toBeTruthy();
      expect(proposal.recipient).toBeTruthy();
      expect(proposal.reason).toBeTruthy();
      expect(proposal.draftMessage.length).toBeGreaterThan(20);
    }
  });
});
