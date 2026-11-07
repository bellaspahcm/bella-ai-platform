/**
 * BELLA INTERIOR OS — AI COPILOT & SECURITY GOVERNANCE TESTS
 *
 * Verifies:
 *   1. RBAC (Role-Based Access Control) for Interior AI Copilot.
 *   2. Multi-Tenant Isolation (Gate 0 / P0) & RLS query verification.
 *   3. Interior AI Agent anomaly detection (delays, spec lock, BOQ variance).
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
    expect(result.agent).toContain('Bella Interior AI Specialist');
    expect(result.summary).toBeTruthy();
    expect(result.anomalies).toBeDefined();
    expect(Array.isArray(result.draftProposals)).toBe(true);
    expect(result.draftProposals?.length).toBeGreaterThan(0);
  });

  it('detects operational anomalies: delay alerts, spec lock pending, and BOQ variance', async () => {
    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient<Database>;

    const result = await runInteriorAgent(mockSupabase, 'tenant-test-001', new Date());

    // Should detect at least 1 delay anomaly from baseline projects
    const hasDelayAlert = result.anomalies?.some((a) =>
      typeof a === 'string' ? a.includes('chậm tiến độ') : false
    );
    expect(hasDelayAlert).toBe(true);

    // Should detect spec lock pending for design stage projects
    const hasSpecLockAlert = result.anomalies?.some((a) =>
      typeof a === 'string' ? a.includes('Spec Lock') || a.includes('khóa mẫu') : false
    );
    expect(hasSpecLockAlert).toBe(true);

    // Should generate draft actionable proposals
    expect(result.draftProposals?.length).toBeGreaterThanOrEqual(3);

    const proposalTypes = result.draftProposals?.map((p) => p.type) || [];
    expect(proposalTypes).toContain('interior_schedule_recovery');
    expect(proposalTypes).toContain('interior_spec_lock_approval');
    expect(proposalTypes).toContain('interior_boq_variance_review');

    // Verify each proposal has required fields for Human-In-The-Loop approval
    for (const proposal of result.draftProposals || []) {
      expect(proposal.type).toBeTruthy();
      expect(proposal.recipient).toBeTruthy();
      expect(proposal.reason).toBeTruthy();
      expect(proposal.draftMessage).toBeTruthy();
      expect(proposal.draftMessage.length).toBeGreaterThan(20);
    }
  });
});
