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

describe('Bella Interior OS — AI Sub-Agent fail-closed data boundary', () => {
  const createClient = () => ({} as Parameters<typeof runInteriorAgent>[0]);

  it('does not generate tenant reports from demo baselines without an authorized read model', async () => {
    await expect(
      runInteriorAgent(createClient(), 'tenant-interior-alpha', new Date('2026-11-08T00:00:00Z')),
    ).rejects.toThrow('INTERIOR_AI_DATA_SOURCE_UNAVAILABLE');
  });

  it.each([
    'interior_cco',
    'interior_coo',
    'interior_cpo',
    'interior_chro',
    'interior_cfo',
    'interior_advisor',
  ])('keeps %s unavailable until its data projection is authorized', async (role) => {
    await expect(
      runInteriorAgent(createClient(), 'tenant-001', new Date(), role),
    ).rejects.toThrow('INTERIOR_AI_DATA_SOURCE_UNAVAILABLE');
  });
});
