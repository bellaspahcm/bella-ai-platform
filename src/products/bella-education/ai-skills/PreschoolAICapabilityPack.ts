/**
 * BELLA EDUCATION — PRESCHOOL AI CAPABILITY PACK
 *
 * Implements the Platform AICapabilityPack contract for Early Childhood Care,
 * Preschool Daily Routines, Parent Communication NLP, and Health Safety.
 *
 * STRICT GOVERNANCE:
 * - ZERO `any` allowed.
 * - ZERO cross-industry imports (No Healthcare OS / Medical imports).
 * - Complete child privacy & deterministic validation rules.
 *
 * @module src/products/bella-education/ai-skills/PreschoolAICapabilityPack
 */

import type { AICapabilityPack, AIToolDefinition } from '@/core/plugins/ai-capability-pack';

export interface ParentIntentClassification {
  readonly intent: 'health_medicine' | 'early_pickup' | 'absence' | 'tuition' | 'nutrition' | 'general';
  readonly label: string;
  readonly confidence: number;
  readonly tags: readonly { readonly label: string; readonly color: string }[];
  readonly primaryActionLabel: string;
  readonly primaryActionType: 'care_note' | 'early_pickup' | 'attendance' | 'tuition' | 'reply';
}

export interface CareInstructionExtraction {
  readonly medicineName?: string;
  readonly dosage?: string;
  readonly timeSlots?: readonly string[];
  readonly specialNotes?: string;
  readonly requiresTeacherConfirmation: boolean;
}

export interface HealthAnomalyResult {
  readonly hasAnomaly: boolean;
  readonly severity: 'none' | 'warning' | 'critical';
  readonly anomalies: readonly string[];
  readonly recommendedAction: string;
}

export interface AllergySafetyResult {
  readonly safe: boolean;
  readonly conflictingDishes: readonly { readonly dish: string; readonly allergen: string }[];
  readonly warningMessage?: string;
}

export interface ExecutiveDailyBriefingResult {
  readonly executiveSummary: string;
  readonly attendanceRate: number;
  readonly criticalAlerts: readonly string[];
  readonly actionableRecommendations: readonly string[];
  readonly generatedAt: string;
}

export interface ClassRosterStat {
  readonly className: string;
  readonly ageGroup: 'NHA_TRE' | 'MAM' | 'CHOI' | 'LA';
  readonly studentCount: number;
  readonly teacherCount: number;
}

export interface ComplianceSentinelResult {
  readonly compliant: boolean;
  readonly complianceScore: number;
  readonly violations: readonly string[];
  readonly warnings: readonly string[];
  readonly inspectedClassesCount: number;
}

export const preschoolAICapabilityPack: AICapabilityPack = {
  id: 'preschool_ai_pack',
  name: 'Bella Preschool Educational & Daily Care Copilot',
  knowledgeDomain: 'Early Childhood Education, Preschool Daily Care, Nutrition & Parent Communication',
  prompts: {
    classify_parent_intent:
      'Phân tích tin nhắn của phụ huynh mầm non, nhận diện chính xác ý định (dặn thuốc, báo vắng, xin đón sớm, thắc mắc học phí, dị ứng thức ăn), đo độ tin cậy và đề xuất hành động 1 chạm cho giáo viên.',
    extract_care_instruction:
      'Trích xuất an toàn liều lượng thuốc, thời điểm uống và ghi chú chăm sóc đặc biệt từ tin nhắn dặn dò của phụ huynh. Mọi chỉ dẫn y tế/dặn thuốc đều yêu cầu giáo viên xác nhận trực tiếp.',
    detect_health_anomaly:
      'Kiểm tra các chỉ số sức khỏe của trẻ (thân nhiệt, giấc ngủ trưa, mức độ ăn hết suất, bài tiết). Cảnh báo khi thân nhiệt >= 37.8°C hoặc có dấu hiệu suy giảm thể trạng bất thường.',
    check_allergy_safety:
      'Đối chiếu thực đơn bữa ăn trong ngày với danh sách dị ứng đã đăng ký của trẻ để ngăn ngừa ngộ độc hoặc phản ứng dị ứng thực phẩm.',
    generate_daily_digest:
      'Tạo nhật ký sinh hoạt cuối ngày (Daily Digest) cá nhân hóa cho từng trẻ: tóm tắt chuyên cần, bữa ăn, giấc ngủ, thái độ và hoạt động vui chơi với văn phong ấm áp, ân cần và chuẩn mực sư phạm mầm non.',
    executive_daily_briefing:
      'Điểm tin điều hành mầm non toàn trường: tóm tắt chuyên cần, cảnh báo sức khỏe y tế, tiến độ học phí và đề xuất hành động ưu tiên cho Ban Giám Hiệu.',
    compliance_and_safety_sentinel:
      'Rà soát tuân thủ định mức sĩ số lớp học và định mức giáo viên/học sinh theo Thông tư 52/2020/TT-BGDĐT cùng an toàn vệ sinh thực đơn toàn trường.',
  },
  decisionRules: {
    fever_warning_celsius: 37.8,
    fever_danger_celsius: 38.5,
    nap_minimum_minutes: 60,
    max_digest_characters: 500,
    require_teacher_confirmation_for_medicine: true,
  },
  tools: [
    {
      id: 'classify_parent_intent',
      name: 'Classify Parent Intent',
      description: 'Phân loại ý định tin nhắn của phụ huynh mầm non và gợi ý hành động xử lý',
      parametersSchema: {
        message: { type: 'string', description: 'Nội dung tin nhắn từ phụ huynh' },
      },
      execute: async (params: Record<string, unknown>): Promise<Record<string, unknown>> => {
        const message = String(params.message || '').trim();
        const lower = message.toLowerCase();

        const isAbsence =
          lower.includes('nghỉ học') ||
          lower.includes('xin nghỉ') ||
          lower.includes('vắng mặt') ||
          lower.includes('nghỉ ốm') ||
          lower.includes('không đi học');

        const isEarlyPickup =
          lower.includes('đón sớm') ||
          lower.includes('đón bé') ||
          lower.includes('về sớm') ||
          lower.includes('đón trước');

        const isHealthMedicine =
          lower.includes('thuốc') ||
          lower.includes('uống') ||
          lower.includes('sốt') ||
          lower.includes('siro') ||
          lower.includes('bị ho') ||
          lower.includes('sụt sịt') ||
          lower.includes('sổ mũi') ||
          lower.includes('ngạt mũi') ||
          lower.includes('đau họng');

        const isTuition =
          lower.includes('học phí') ||
          lower.includes('tiền học') ||
          lower.includes('đóng tiền') ||
          lower.includes('chuyển khoản') ||
          lower.includes('hóa đơn');

        const isNutrition =
          lower.includes('dị ứng') ||
          lower.includes('không ăn được') ||
          lower.includes('kiêng') ||
          lower.includes('sữa hạt');

        let intent: ParentIntentClassification['intent'] = 'general';
        let label = 'Trao đổi chung';
        let confidence = 0.85;
        let primaryActionLabel = 'Trả lời tin nhắn';
        let primaryActionType: ParentIntentClassification['primaryActionType'] = 'reply';
        const tags: { label: string; color: string }[] = [];

        if (isAbsence) {
          intent = 'absence';
          label = '📅 Báo nghỉ học';
          confidence = 0.98;
          tags.push({ label: 'Báo vắng', color: 'bg-blue-50 text-blue-700 border-blue-200' });
          primaryActionLabel = 'Cập nhật điểm danh';
          primaryActionType = 'attendance';
        } else if (isEarlyPickup) {
          intent = 'early_pickup';
          label = '⏰ Xin đón sớm';
          confidence = 0.94;
          tags.push({ label: 'Đón sớm', color: 'bg-amber-50 text-amber-700 border-amber-200' });
          primaryActionLabel = 'Duyệt đơn đón sớm';
          primaryActionType = 'early_pickup';
        } else if (isHealthMedicine) {
          intent = 'health_medicine';
          label = '🔔 Lưu ý sức khỏe & Dặn thuốc';
          confidence = 0.96;
          tags.push({ label: 'Dặn thuốc', color: 'bg-rose-50 text-rose-700 border-rose-200' });
          primaryActionLabel = 'Tạo ghi chú chăm sóc';
          primaryActionType = 'care_note';
        } else if (isTuition) {
          intent = 'tuition';
          label = '💳 Thắc mắc học phí';
          confidence = 0.95;
          tags.push({ label: 'Học phí', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' });
          primaryActionLabel = 'Gửi hướng dẫn học phí';
          primaryActionType = 'tuition';
        } else if (isNutrition) {
          intent = 'nutrition';
          label = '🥗 Lưu ý dinh dưỡng & Dị ứng';
          confidence = 0.92;
          tags.push({ label: 'Dị ứng thực phẩm', color: 'bg-purple-50 text-purple-700 border-purple-200' });
          primaryActionLabel = 'Ghi chú nhà bếp';
          primaryActionType = 'care_note';
        } else {
          tags.push({ label: 'Thường quy', color: 'bg-slate-50 text-slate-700 border-slate-200' });
        }

        const result: ParentIntentClassification = {
          intent,
          label,
          confidence,
          tags,
          primaryActionLabel,
          primaryActionType,
        };

        return { ...result };
      },
    },
    {
      id: 'extract_care_instruction',
      name: 'Extract Care Instruction',
      description: 'Trích xuất liều lượng thuốc và ghi chú chăm sóc đặc biệt từ văn bản tự nhiên',
      parametersSchema: {
        rawText: { type: 'string', description: 'Nội dung dặn thuốc của phụ huynh' },
      },
      execute: async (params: Record<string, unknown>): Promise<Record<string, unknown>> => {
        const rawText = String(params.rawText || '').trim();
        const timeMatch = rawText.match(/(?:lúc\s*)?(\d{1,2}[:h]\d{2}|\btrưa\b|\bsáng\b|\bchiều\b)/i);
        const doseMatch = rawText.match(/(\d+(?:\.\d+)?\s*(?:ml|viên|gói|giọt))/i);

        const extraction: CareInstructionExtraction = {
          medicineName: rawText.length > 5 ? rawText.substring(0, 40) : undefined,
          dosage: doseMatch ? doseMatch[1] : undefined,
          timeSlots: timeMatch ? [timeMatch[1]] : ['11:30'],
          specialNotes: rawText,
          requiresTeacherConfirmation: true,
        };

        return { ...extraction };
      },
    },
    {
      id: 'detect_health_anomaly',
      name: 'Detect Health Anomaly',
      description: 'Phát hiện bất thường về thân nhiệt, giấc ngủ và dinh dưỡng trong ngày',
      parametersSchema: {
        temperatureCelsius: { type: 'number', description: 'Nhiệt độ cơ thể đo được (°C)' },
        napMinutes: { type: 'number', description: 'Thời gian ngủ trưa (phút)' },
        mealsFinishedRate: { type: 'number', description: 'Tỷ lệ ăn hết suất (0.0 đến 1.0)' },
      },
      execute: async (params: Record<string, unknown>): Promise<Record<string, unknown>> => {
        const temp = typeof params.temperatureCelsius === 'number' ? params.temperatureCelsius : undefined;
        const nap = typeof params.napMinutes === 'number' ? params.napMinutes : undefined;
        const meal = typeof params.mealsFinishedRate === 'number' ? params.mealsFinishedRate : undefined;

        const anomalies: string[] = [];
        let severity: HealthAnomalyResult['severity'] = 'none';

        if (temp !== undefined && temp >= 38.5) {
          severity = 'critical';
          anomalies.push(`Sốt cao nguy hiểm (${temp}°C). Cần chườm hạ nhiệt và thông báo phụ huynh ngay.`);
        } else if (temp !== undefined && temp >= 37.8) {
          severity = 'warning';
          anomalies.push(`Sốt nhẹ (${temp}°C). Cần theo dõi sát và cho uống nhiều nước.`);
        }

        if (nap !== undefined && nap < 45) {
          if (severity === 'none') severity = 'warning';
          anomalies.push(`Giấc ngủ trưa ngắn bất thường (${nap} phút). Trẻ có thể mệt mỏi vào buổi chiều.`);
        }

        if (meal !== undefined && meal < 0.5) {
          if (severity === 'none') severity = 'warning';
          anomalies.push(`Trẻ ăn dưới 50% suất ăn (${Math.round(meal * 100)}%). Cần kiểm tra vị giác hoặc cho ăn bữa phụ bù.`);
        }

        const result: HealthAnomalyResult = {
          hasAnomaly: anomalies.length > 0,
          severity,
          anomalies,
          recommendedAction:
            severity === 'critical'
              ? 'Liên hệ trực tiếp phụ huynh và nhân viên y tế trường ngay lập tức.'
              : severity === 'warning'
              ? 'Ghi vào sổ bàn giao ca chiều và lưu ý cô phụ trách lúc trả trẻ.'
              : 'Trạng thái bình thường, trẻ sinh hoạt tốt.',
        };

        return { ...result };
      },
    },
    {
      id: 'check_allergy_safety',
      name: 'Check Allergy Safety',
      description: 'Đối chiếu món ăn trong thực đơn với hồ sơ dị ứng thực phẩm của trẻ',
      parametersSchema: {
        menuDishes: { type: 'array', description: 'Danh sách các món ăn trong ngày' },
        childAllergens: { type: 'array', description: 'Danh sách các chất/thực phẩm trẻ bị dị ứng' },
      },
      execute: async (params: Record<string, unknown>): Promise<Record<string, unknown>> => {
        const dishes = Array.isArray(params.menuDishes) ? params.menuDishes.map(String) : [];
        const allergens = Array.isArray(params.childAllergens) ? params.childAllergens.map(String) : [];

        const conflicts: { dish: string; allergen: string }[] = [];

        dishes.forEach((dish) => {
          const lowerDish = dish.toLowerCase();
          allergens.forEach((allergen) => {
            const lowerAllergen = allergen.toLowerCase();
            if (lowerDish.includes(lowerAllergen)) {
              conflicts.push({ dish, allergen });
            }
          });
        });

        const safe = conflicts.length === 0;
        const result: AllergySafetyResult = {
          safe,
          conflictingDishes: conflicts,
          warningMessage: safe
            ? 'Thực đơn an toàn, không chứa thành phần gây dị ứng đã ghi nhận.'
            : `CẢNH BÁO: Phát hiện ${conflicts.length} món ăn xung đột với tiền sử dị ứng của trẻ! Cần đổi món thay thế.`,
        };

        return { ...result };
      },
    },
    {
      id: 'generate_daily_digest',
      name: 'Generate Daily Digest',
      description: 'Tạo nhật ký báo cáo sinh hoạt cuối ngày ấm áp, chuẩn mực cho phụ huynh',
      parametersSchema: {
        studentName: { type: 'string', description: 'Tên của trẻ' },
        attendanceStatus: { type: 'string', description: 'Trạng thái đi học' },
        mealFeedback: { type: 'string', description: 'Tình hình ăn uống' },
        napFeedback: { type: 'string', description: 'Tình hình giấc ngủ' },
        activityNotes: { type: 'string', description: 'Hoạt động học tập và vui chơi nổi bật' },
      },
      execute: async (params: Record<string, unknown>): Promise<Record<string, unknown>> => {
        const name = String(params.studentName || 'Bé').trim();
        const meal = String(params.mealFeedback || 'ăn ngoan hết suất').trim();
        const nap = String(params.napFeedback || 'ngủ trưa tròn giấc').trim();
        const activity = String(params.activityNotes || 'tham gia hào hứng các hoạt động cùng bạn').trim();

        const digest = `Dạ chào ba mẹ! Hôm nay ${name} đến lớp rất vui vẻ. Bé ${meal} và ${nap}. Trong giờ sinh hoạt, bé ${activity}. Cô chúc ${name} và gia đình có một buổi tối thật ấm áp và nhiều tiếng cười ạ! ❤️`;

        return {
          studentName: name,
          digestText: digest,
          characterCount: digest.length,
          generatedAt: new Date().toISOString(),
        };
      },
    },
    {
      id: 'executive_daily_briefing',
      name: 'Executive Daily Briefing',
      description: 'Tổng hợp điểm tin điều hành mầm non toàn trường cho Ban Giám Hiệu',
      parametersSchema: {
        totalStudents: { type: 'number', description: 'Tổng số trẻ toàn trường' },
        presentCount: { type: 'number', description: 'Số trẻ có mặt hôm nay' },
        absentCount: { type: 'number', description: 'Số trẻ vắng mặt hôm nay' },
        feverCasesCount: { type: 'number', description: 'Số ca sốt hoặc sự cố y tế' },
        unpaidTuitionCount: { type: 'number', description: 'Số hồ sơ học phí chưa thanh toán' },
        pendingParentRequests: { type: 'number', description: 'Số yêu cầu dặn dò phụ huynh chờ xử lý' },
      },
      execute: async (params: Record<string, unknown>): Promise<Record<string, unknown>> => {
        const total = typeof params.totalStudents === 'number' && params.totalStudents > 0 ? params.totalStudents : 100;
        const present = typeof params.presentCount === 'number' ? params.presentCount : total;
        const fever = typeof params.feverCasesCount === 'number' ? params.feverCasesCount : 0;
        const unpaid = typeof params.unpaidTuitionCount === 'number' ? params.unpaidTuitionCount : 0;
        const pendingReq = typeof params.pendingParentRequests === 'number' ? params.pendingParentRequests : 0;

        const rate = Math.round((present / total) * 100);
        const criticalAlerts: string[] = [];
        const recommendations: string[] = [];

        if (fever > 0) {
          criticalAlerts.push(`Cảnh báo dịch tễ/y tế: Toàn trường ghi nhận ${fever} ca sốt cần theo dõi lâm sàng.`);
          recommendations.push('Giám sát dịch tễ: Chỉ đạo bộ phận y tế và bảo mẫu kiểm tra thân nhiệt tăng cường đầu giờ chiều.');
        }

        if (rate < 85) {
          criticalAlerts.push(`Tỷ lệ chuyên cần thấp (${rate}%): Tỷ lệ vắng mặt cao hơn mức bình thường 15%.`);
          recommendations.push('Đôn đốc GVCN các lớp rà soát lý do nghỉ học và thăm hỏi gia đình các bé ốm.');
        } else {
          recommendations.push('Chuyên cần toàn trường ổn định trên 85%, đảm bảo tiến độ chương trình mầm non.');
        }

        if (unpaid > 10) {
          recommendations.push(`Học phí tồn đọng: Có ${unpaid} hồ sơ quá hạn — kích hoạt thông báo nhắc tự động qua PWA.`);
        }

        if (pendingReq > 5) {
          recommendations.push(`Có ${pendingReq} dặn dò thuốc/đón sớm chờ xác nhận từ giáo viên đứng lớp.`);
        }

        const summary =
          `Điểm tin điều hành: Sĩ số toàn trường ${total} trẻ, có mặt ${present} trẻ (${rate}% chuyên cần). ` +
          (fever > 0 ? `Lưu ý an toàn: ${fever} ca sốt cần theo dõi y tế. ` : `Sức khỏe toàn trường ổn định, không có ca sốt cao. `) +
          `Vận hành: ${pendingReq} dặn dò phụ huynh, ${unpaid} hồ sơ học phí cần đối soát.`;

        const result: ExecutiveDailyBriefingResult = {
          executiveSummary: summary,
          attendanceRate: rate,
          criticalAlerts,
          actionableRecommendations: recommendations,
          generatedAt: new Date().toISOString(),
        };

        return { ...result };
      },
    },
    {
      id: 'compliance_and_safety_sentinel',
      name: 'Compliance & Safety Sentinel',
      description: 'Rà soát sĩ số lớp học và định mức giáo viên theo Thông tư 52/2020/TT-BGDĐT',
      parametersSchema: {
        classRosterStats: { type: 'array', description: 'Danh sách thông số sĩ số và giáo viên các lớp' },
      },
      execute: async (params: Record<string, unknown>): Promise<Record<string, unknown>> => {
        const stats = Array.isArray(params.classRosterStats)
          ? (params.classRosterStats as readonly ClassRosterStat[])
          : [];

        const violations: string[] = [];
        const warnings: string[] = [];

        stats.forEach((c) => {
          const name = c.className || 'Lớp học';
          const count = c.studentCount || 0;
          const teachers = c.teacherCount || 1;

          // Standard limits per Thông tư 52/2020/TT-BGDĐT
          let maxCapacity = 30;
          if (c.ageGroup === 'NHA_TRE') maxCapacity = 25;
          if (c.ageGroup === 'MAM') maxCapacity = 25;
          if (c.ageGroup === 'CHOI') maxCapacity = 30;
          if (c.ageGroup === 'LA') maxCapacity = 35;

          if (count > maxCapacity) {
            violations.push(`${name} (${c.ageGroup}): Sĩ số ${count}/${maxCapacity} trẻ — vượt trần quy định Thông tư 52.`);
          } else if (count >= maxCapacity - 2) {
            warnings.push(`${name}: Sĩ số ${count}/${maxCapacity} sắp chạm trần công suất tiếp nhận.`);
          }

          // Teacher-to-student ratio check for infant/toddler groups
          if (c.ageGroup === 'NHA_TRE' && count > 0 && count / teachers > 12) {
            violations.push(`${name} (Nhà trẻ): Tỷ lệ ${Math.round(count / teachers)} trẻ/GV vượt định mức tối đa 12 trẻ/GV.`);
          }
        });

        const compliant = violations.length === 0;
        const score = Math.max(0, 100 - violations.length * 20 - warnings.length * 5);

        const result: ComplianceSentinelResult = {
          compliant,
          complianceScore: score,
          violations,
          warnings,
          inspectedClassesCount: stats.length,
        };

        return { ...result };
      },
    },
  ],
};
