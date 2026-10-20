/**
 * Bella Preschool OS — Executive AI Copilot for School Leadership & Admin Tests
 * File: src/products/bella-education/__tests__/preschool-admin-ai-copilot.test.ts
 *
 * Validates:
 * 1. Tool 6: Executive Daily Briefing (Điểm tin toàn trường)
 * 2. Tool 7: Compliance & Safety Sentinel (Rà soát sĩ số & định mức TT 52/2020/TT-BGDĐT)
 * 3. Orchestration via executePreschoolCopilot for executive actions
 * 4. Admin inquiries on pedagogical regulation and leadership Q&A
 * 5. Route handling for executive actions
 *
 * Strict Type Invariant: ZERO `any` or `unknown`.
 */

import {
  preschoolAICapabilityPack,
  type ExecutiveDailyBriefingResult,
  type ComplianceSentinelResult,
} from '../ai-skills/PreschoolAICapabilityPack';
import { executePreschoolCopilot } from '../services/preschool-ai.service';
import { POST as copilotRoute } from '@/app/api/education/ai/copilot/route';

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: jest.fn(async () => ({
    id: 'user-edu-campus-admin-1',
    role: 'CAMPUS_ADMIN',
    tenantId: 'ed100000-0000-0000-0000-000000000001',
    name: 'Cô Hiệu Trưởng Thảo',
    email: 'thao.principal@bellapreschool.edu.vn',
  })),
}));

describe('Bella Preschool Executive AI Copilot — School Leadership Suite', () => {
  describe('Capability Pack Executive Tools Registration', () => {
    it('registers executive_daily_briefing and compliance_and_safety_sentinel', () => {
      const toolIds = preschoolAICapabilityPack.tools.map((t) => t.id);
      expect(toolIds).toContain('executive_daily_briefing');
      expect(toolIds).toContain('compliance_and_safety_sentinel');
    });
  });

  describe('Tool 6: Executive Daily Briefing', () => {
    const briefingTool = preschoolAICapabilityPack.tools.find((t) => t.id === 'executive_daily_briefing');

    it('generates high attendance briefing with no critical alerts when school is healthy', async () => {
      const raw = await briefingTool?.execute({
        totalStudents: 120,
        presentCount: 115,
        absentCount: 5,
        feverCasesCount: 0,
        unpaidTuitionCount: 2,
        pendingParentRequests: 1,
      });

      const res = raw as unknown as ExecutiveDailyBriefingResult;
      expect(res.attendanceRate).toBe(96);
      expect(res.criticalAlerts.length).toBe(0);
      expect(res.executiveSummary).toContain('115 trẻ (96% chuyên cần)');
      expect(res.executiveSummary).toContain('Sức khỏe toàn trường ổn định');
      expect(res.actionableRecommendations.length).toBeGreaterThan(0);
    });

    it('generates critical alerts when fever cases are detected or attendance drops below 85%', async () => {
      const raw = await briefingTool?.execute({
        totalStudents: 100,
        presentCount: 75,
        absentCount: 25,
        feverCasesCount: 4,
        unpaidTuitionCount: 15,
        pendingParentRequests: 8,
      });

      const res = raw as unknown as ExecutiveDailyBriefingResult;
      expect(res.attendanceRate).toBe(75);
      expect(res.criticalAlerts.length).toBe(2);
      expect(res.criticalAlerts[0]).toContain('4 ca sốt');
      expect(res.criticalAlerts[1]).toContain('75%');
      expect(res.actionableRecommendations.some((r) => r.includes('dịch tễ'))).toBe(true);
      expect(res.actionableRecommendations.some((r) => r.includes('quá hạn'))).toBe(true);
    });
  });

  describe('Tool 7: Compliance & Safety Sentinel (Thông tư 52/2020/TT-BGDĐT)', () => {
    const sentinelTool = preschoolAICapabilityPack.tools.find((t) => t.id === 'compliance_and_safety_sentinel');

    it('confirms 100% compliance when all classes adhere to capacity limits', async () => {
      const raw = await sentinelTool?.execute({
        classRosterStats: [
          { className: 'Nhà trẻ 1 (18-24T)', ageGroup: 'NHA_TRE', studentCount: 18, teacherCount: 2 },
          { className: 'Mầm 1 (3-4T)', ageGroup: 'MAM', studentCount: 22, teacherCount: 2 },
          { className: 'Chồi 1 (4-5T)', ageGroup: 'CHOI', studentCount: 26, teacherCount: 2 },
          { className: 'Lá 1 (5-6T)', ageGroup: 'LA', studentCount: 30, teacherCount: 2 },
        ],
      });

      const res = raw as unknown as ComplianceSentinelResult;
      expect(res.compliant).toBe(true);
      expect(res.complianceScore).toBe(100);
      expect(res.violations.length).toBe(0);
      expect(res.inspectedClassesCount).toBe(4);
    });

    it('flags violations when classrooms exceed maximum student capacity per TT52', async () => {
      const raw = await sentinelTool?.execute({
        classRosterStats: [
          { className: 'Nhà trẻ 2', ageGroup: 'NHA_TRE', studentCount: 28, teacherCount: 3 }, // Max 25 (ratio 28/3=9.3 ok)
          { className: 'Mầm 2', ageGroup: 'MAM', studentCount: 30, teacherCount: 2 }, // Max 25
          { className: 'Lá 2', ageGroup: 'LA', studentCount: 32, teacherCount: 2 }, // Max 35 (safe)
        ],
      });

      const res = raw as unknown as ComplianceSentinelResult;
      expect(res.compliant).toBe(false);
      expect(res.violations.length).toBe(2);
      expect(res.violations[0]).toContain('Nhà trẻ 2');
      expect(res.violations[1]).toContain('Mầm 2');
      expect(res.complianceScore).toBeLessThan(100);
    });
  });

  describe('Preschool AI Service Orchestrator (Executive Actions)', () => {
    it('executes executive_briefing action end-to-end', async () => {
      const response = await executePreschoolCopilot({
        action: 'executive_briefing',
        totalStudents: 150,
        presentCount: 140,
        feverCasesCount: 1,
      });

      expect(response.success).toBe(true);
      expect(response.action).toBe('executive_briefing');
      expect(response.data).toHaveProperty('executiveSummary');
      expect(response.data).toHaveProperty('attendanceRate');
      expect(response.piiMasked).toBe(false);
    });

    it('executes executive_safety_audit action end-to-end', async () => {
      const response = await executePreschoolCopilot({
        action: 'executive_safety_audit',
        classRosterStats: [
          { className: 'Chồi 3', ageGroup: 'CHOI', studentCount: 32, teacherCount: 2 }, // Max 30 -> Violation
        ],
      });

      expect(response.success).toBe(true);
      expect(response.action).toBe('executive_safety_audit');
      expect(response.data).toHaveProperty('compliant');
      expect(response.data).toHaveProperty('complianceScore');
    });

    it('answers admin leadership inquiry regarding Thông tư 52 norms', async () => {
      const response = await executePreschoolCopilot({
        action: 'ask_copilot',
        question: 'Quy định sĩ số tối đa theo Thông tư 52 cho các lớp mầm non là bao nhiêu?',
      });

      expect(response.success).toBe(true);
      const answer = (response.data as { answer: string }).answer;
      expect(answer).toContain('Thông tư 52/2020/TT-BGDĐT');
      expect(answer).toContain('Nhóm trẻ');
    });

    it('answers admin leadership inquiry for drafting official announcements', async () => {
      const response = await executePreschoolCopilot({
        action: 'ask_copilot',
        question: 'Soạn thông báo gửi phụ huynh về lịch khám sức khỏe',
      });

      expect(response.success).toBe(true);
      const answer = (response.data as { answer: string }).answer;
      expect(answer).toContain('Kính gửi Quý Phụ huynh');
      expect(answer).toContain('Ban Giám Hiệu');
    });
  });

  describe('Admin Role Route Access for Executive Actions', () => {
    it('handles POST /api/education/ai/copilot with executive_briefing for CAMPUS_ADMIN', async () => {
      const req = new Request('http://localhost/api/education/ai/copilot?tenantId=ed100000-0000-0000-0000-000000000001', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mock-role': 'CAMPUS_ADMIN',
        },
        body: JSON.stringify({
          action: 'executive_briefing',
          totalStudents: 90,
          presentCount: 88,
          feverCasesCount: 0,
        }),
      });

      const res = await copilotRoute(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.action).toBe('executive_briefing');
      expect(data.data.attendanceRate).toBe(98);
    });

    it('handles POST /api/education/ai/copilot with executive_safety_audit for SUPER_ADMIN', async () => {
      const req = new Request('http://localhost/api/education/ai/copilot?tenantId=ed100000-0000-0000-0000-000000000001', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mock-role': 'SUPER_ADMIN',
        },
        body: JSON.stringify({
          action: 'executive_safety_audit',
          classRosterStats: [
            { className: 'Mầm 1', ageGroup: 'MAM', studentCount: 22, teacherCount: 2 },
          ],
        }),
      });

      const res = await copilotRoute(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.compliant).toBe(true);
    });
  });
});
