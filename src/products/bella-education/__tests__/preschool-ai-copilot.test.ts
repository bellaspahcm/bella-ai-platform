/**
 * BELLA EDUCATION — PRESCHOOL AI COPILOT TEST SUITE
 *
 * Verifies PreschoolAICapabilityPack tools, Child PII Shielding,
 * Domain Rule Invariants, and API Route authorization.
 *
 * @module src/products/bella-education/__tests__/preschool-ai-copilot.test
 */

import { preschoolAICapabilityPack } from '../ai-skills/PreschoolAICapabilityPack';
import {
  maskChildPii,
  restoreChildPii,
  executePreschoolCopilot,
} from '../services/preschool-ai.service';
import { POST as copilotApiPost } from '@/app/api/education/ai/copilot/route';
import { canUseEducationAiCopilotRole } from '@/lib/business-rules/permissions';

describe('Bella Preschool AI Copilot — Capability Pack & Services', () => {
  describe('PreschoolAICapabilityPack Structure & Contract Adherence', () => {
    it('declares correct id, knowledge domain, and decision rules', () => {
      expect(preschoolAICapabilityPack.id).toBe('preschool_ai_pack');
      expect(preschoolAICapabilityPack.knowledgeDomain).toContain('Early Childhood Education');
      expect(preschoolAICapabilityPack.decisionRules?.fever_warning_celsius).toBe(37.8);
      expect(preschoolAICapabilityPack.decisionRules?.fever_danger_celsius).toBe(38.5);
      expect(preschoolAICapabilityPack.decisionRules?.require_teacher_confirmation_for_medicine).toBe(true);
    });

    it('contains all 5 essential tools with valid execution contracts', () => {
      const toolIds = preschoolAICapabilityPack.tools.map((t) => t.id);
      expect(toolIds).toContain('classify_parent_intent');
      expect(toolIds).toContain('extract_care_instruction');
      expect(toolIds).toContain('detect_health_anomaly');
      expect(toolIds).toContain('check_allergy_safety');
      expect(toolIds).toContain('generate_daily_digest');
    });
  });

  describe('Tool 1: Parent Intent Classification', () => {
    const classifyTool = preschoolAICapabilityPack.tools.find((t) => t.id === 'classify_parent_intent');

    it('classifies health/medicine intents correctly', async () => {
      const res = await classifyTool?.execute({
        message: 'Cô ơi trưa nay cho bé uống 5ml siro ho sau khi ăn giúp mẹ nhé',
      });
      expect(res?.intent).toBe('health_medicine');
      expect(res?.primaryActionType).toBe('care_note');
      expect(Number(res?.confidence)).toBeGreaterThanOrEqual(0.9);
    });

    it('classifies early pickup intents correctly', async () => {
      const res = await classifyTool?.execute({
        message: 'Hôm nay mẹ bận việc nên xin phép cô cho đón bé lúc 15h30 sớm hơn thường ngày ạ',
      });
      expect(res?.intent).toBe('early_pickup');
      expect(res?.primaryActionType).toBe('early_pickup');
    });

    it('classifies absence intents correctly', async () => {
      const res = await classifyTool?.execute({
        message: 'Dạ cô ơi hôm nay cháu bị sốt nên gia đình xin nghỉ học hôm nay ạ',
      });
      expect(res?.intent).toBe('absence');
      expect(res?.primaryActionType).toBe('attendance');
    });

    it('classifies tuition inquiry intents correctly', async () => {
      const res = await classifyTool?.execute({
        message: 'Cô cho mình hỏi thông tin đóng tiền học phí và số tài khoản chuyển khoản tháng này',
      });
      expect(res?.intent).toBe('tuition');
      expect(res?.primaryActionType).toBe('tuition');
    });
  });

  describe('Tool 2: Care & Medicine Instruction Extraction', () => {
    const extractTool = preschoolAICapabilityPack.tools.find((t) => t.id === 'extract_care_instruction');

    it('extracts dosage, timeslot, and enforces teacher confirmation', async () => {
      const res = await extractTool?.execute({
        rawText: 'Cho bé uống 5ml siro lúc 11:30 trưa sau ăn',
      });
      expect(res?.dosage).toBe('5ml');
      expect(res?.timeSlots).toContain('11:30');
      expect(res?.requiresTeacherConfirmation).toBe(true);
    });
  });

  describe('Tool 3: Health & Care Anomaly Detection', () => {
    const anomalyTool = preschoolAICapabilityPack.tools.find((t) => t.id === 'detect_health_anomaly');

    it('returns no anomaly for healthy parameters', async () => {
      const res = await anomalyTool?.execute({
        temperatureCelsius: 36.8,
        napMinutes: 90,
        mealsFinishedRate: 1.0,
      });
      expect(res?.hasAnomaly).toBe(false);
      expect(res?.severity).toBe('none');
    });

    it('flags warning severity for mild fever', async () => {
      const res = await anomalyTool?.execute({
        temperatureCelsius: 37.9,
      });
      expect(res?.hasAnomaly).toBe(true);
      expect(res?.severity).toBe('warning');
    });

    it('flags critical severity for high fever >= 38.5C', async () => {
      const res = await anomalyTool?.execute({
        temperatureCelsius: 38.8,
      });
      expect(res?.hasAnomaly).toBe(true);
      expect(res?.severity).toBe('critical');
    });
  });

  describe('Tool 4: Allergy & Nutritional Safety', () => {
    const allergyTool = preschoolAICapabilityPack.tools.find((t) => t.id === 'check_allergy_safety');

    it('detects allergen conflicts in daily menu', async () => {
      const res = await allergyTool?.execute({
        menuDishes: ['Canh bí đỏ thịt bằm', 'Tôm rim thịt', 'Tráng miệng dưa hấu'],
        childAllergens: ['tôm', 'đậu phộng'],
      });
      expect(res?.safe).toBe(false);
      const conflicts = res?.conflictingDishes as Array<{ dish: string; allergen: string }>;
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].dish).toBe('Tôm rim thịt');
      expect(conflicts[0].allergen).toBe('tôm');
    });

    it('confirms safe when no allergen matches menu', async () => {
      const res = await allergyTool?.execute({
        menuDishes: ['Canh rau ngót thịt lợn', 'Gà sốt chua ngọt', 'Chuối tiêu'],
        childAllergens: ['hải sản', 'tôm', 'cua'],
      });
      expect(res?.safe).toBe(true);
      expect((res?.conflictingDishes as unknown[]).length).toBe(0);
    });
  });

  describe('Tool 5: Daily Digest Generator', () => {
    const digestTool = preschoolAICapabilityPack.tools.find((t) => t.id === 'generate_daily_digest');

    it('generates warm, pedagogical daily message for parents', async () => {
      const res = await digestTool?.execute({
        studentName: 'Bé Minh An',
        mealFeedback: 'ăn hết suất cơm trưa và cháo xế',
        napFeedback: 'ngủ trưa rất ngoan từ 11:45 đến 14:00',
        activityNotes: 'vẽ tranh vườn hoa cùng bạn và biết cất gọn đồ chơi',
      });
      const digestText = String(res?.digestText);
      expect(digestText).toContain('Bé Minh An');
      expect(digestText).toContain('Dạ chào ba mẹ!');
      expect(digestText).toContain('vẽ tranh vườn hoa');
    });
  });

  describe('Child PII Anonymization Shield', () => {
    it('masks phone numbers and child names', () => {
      const input = 'Phụ huynh bé Nguyễn Minh An gọi số 0912345678 để dặn cô giáo';
      const masked = maskChildPii(input, ['Nguyễn Minh An']);

      expect(masked.maskedText).not.toContain('0912345678');
      expect(masked.maskedText).not.toContain('Nguyễn Minh An');
      expect(masked.maskedText).toContain('[SDT_PHU_HUYNH_1]');
      expect(masked.maskedText).toContain('[TRE_EM_1]');

      const restored = restoreChildPii(masked.maskedText, masked.tokenMap);
      expect(restored).toBe(input);
    });
  });

  describe('Preschool AI Service Orchestrator', () => {
    it('executes classify_intent action successfully', async () => {
      const response = await executePreschoolCopilot({
        action: 'classify_intent',
        message: 'Cô ơi cho bé uống thuốc siro nhé',
      });
      expect(response.success).toBe(true);
      expect(response.action).toBe('classify_intent');
      expect(response.data).toHaveProperty('intent', 'health_medicine');
    });

    it('executes ask_copilot with heuristic fallback when gemini key absent', async () => {
      const response = await executePreschoolCopilot({
        action: 'ask_copilot',
        question: 'Bé bị sốt 38 độ thì cô giáo cần làm gì?',
      });
      expect(response.success).toBe(true);
      expect(response.action).toBe('ask_copilot');
      expect(String(response.data.answer)).toContain('37.8°C');
    });
  });

  describe('Role-Based Access Control & API Route', () => {
    it('verifies education roles are allowed and general spa roles are restricted', () => {
      expect(canUseEducationAiCopilotRole('education_teacher')).toBe(true);
      expect(canUseEducationAiCopilotRole('homeroom_teacher')).toBe(true);
      expect(canUseEducationAiCopilotRole('principal')).toBe(true);
      expect(canUseEducationAiCopilotRole('admin')).toBe(true);
      expect(canUseEducationAiCopilotRole('ktv')).toBe(false);
      expect(canUseEducationAiCopilotRole('therapist')).toBe(false);
      expect(canUseEducationAiCopilotRole('customer')).toBe(false);
    });

    it('handles POST /api/education/ai/copilot rejecting invalid actions', async () => {
      const req = new Request('http://localhost:3000/api/education/ai/copilot?tenantId=ed100000-0000-0000-0000-000000000001', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invalid_action_xyz' }),
      });

      const res = await copilotApiPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('INVALID_ACTION');
    });

    it('handles POST /api/education/ai/copilot executing valid intent classification', async () => {
      const req = new Request('http://localhost:3000/api/education/ai/copilot?tenantId=ed100000-0000-0000-0000-000000000001', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'classify_intent',
          message: 'Chào cô, trưa nay đón bé lúc 16h sớm nhé',
        }),
      });

      const res = await copilotApiPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.intent).toBe('early_pickup');
      expect(data.tenantId).toBe('ed100000-0000-0000-0000-000000000001');
    });
  });
});
