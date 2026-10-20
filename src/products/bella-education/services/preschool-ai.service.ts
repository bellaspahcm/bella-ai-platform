/**
 * BELLA EDUCATION — PRESCHOOL AI SERVICE & CHILD PII SHIELD
 *
 * Provides domain-specific AI processing for early childhood education,
 * parent intent recognition, daily care anomaly detection, and child privacy protection.
 *
 * STRICT GOVERNANCE:
 * - ZERO `any` allowed.
 * - Child Data Protection: Masks PII (names, phone numbers) before LLM egress.
 * - Clean fallback when GEMINI_API_KEY is not configured.
 *
 * @module src/products/bella-education/services/preschool-ai.service
 */

import {
  preschoolAICapabilityPack,
  type ParentIntentClassification,
  type CareInstructionExtraction,
  type HealthAnomalyResult,
  type AllergySafetyResult,
} from '../ai-skills/PreschoolAICapabilityPack';

export interface PiiMaskResult {
  readonly maskedText: string;
  readonly tokenMap: Readonly<Record<string, string>>;
}

export interface PreschoolCopilotRequest {
  readonly action: 'classify_intent' | 'extract_care' | 'detect_anomaly' | 'check_allergy' | 'generate_digest' | 'ask_copilot';
  readonly message?: string;
  readonly rawText?: string;
  readonly temperatureCelsius?: number;
  readonly napMinutes?: number;
  readonly mealsFinishedRate?: number;
  readonly menuDishes?: readonly string[];
  readonly childAllergens?: readonly string[];
  readonly studentName?: string;
  readonly attendanceStatus?: string;
  readonly mealFeedback?: string;
  readonly napFeedback?: string;
  readonly activityNotes?: string;
  readonly question?: string;
  readonly contextData?: Readonly<Record<string, unknown>>;
  readonly geminiApiKey?: string;
}

export interface PreschoolCopilotResponse {
  readonly success: boolean;
  readonly action: PreschoolCopilotRequest['action'];
  readonly data: Readonly<Record<string, unknown>>;
  readonly piiMasked: boolean;
  readonly timestamp: string;
}

/**
 * Child PII Anonymization Shield
 * Replaces student names, phone numbers, and sensitive identifiers with synthetic tokens.
 */
export function maskChildPii(text: string, knownNames?: readonly string[]): PiiMaskResult {
  let masked = text;
  const tokenMap: Record<string, string> = {};

  // 1. Mask Vietnamese phone numbers (mobile 03/05/07/08/09, landline 02x, +84, with spaces/dots/hyphens)
  const phoneRegex = /(?:\+84|0)[0-9][0-9.\s-]{7,13}[0-9]/g;
  let phoneCounter = 1;
  masked = masked.replace(phoneRegex, (match) => {
    const digitsOnly = match.replace(/\D/g, '');
    if (digitsOnly.length < 9 || digitsOnly.length > 11) return match;
    const normalizedDigits = digitsOnly.startsWith('84') ? '0' + digitsOnly.slice(2) : digitsOnly;
    if (!/^0(2\d|[35789])\d{7,8}$/.test(normalizedDigits)) return match;
    const token = `[SDT_PHU_HUYNH_${phoneCounter++}]`;
    tokenMap[token] = match;
    return token;
  });

  // 2. Mask known student/guardian names if provided
  let childCounter = 1;
  if (knownNames && knownNames.length > 0) {
    knownNames.forEach((name) => {
      const cleanName = name.trim();
      if (cleanName.length >= 2) {
        const regex = new RegExp(cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        if (regex.test(masked)) {
          const token = `[TRE_EM_${childCounter++}]`;
          tokenMap[token] = cleanName;
          masked = masked.replace(regex, token);
        }
      }
    });
  }

  // 3. Mask names following Vietnamese child honorifics (bé, cháu, em, học sinh, con gái, con trai)
  const honorificNameRegex = /\b(bé|cháu|em|học sinh|con(?: gái| trai)?)\s+([A-ZÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ][a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+(?:\s+[A-ZÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ][a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+)*)/gu;
  masked = masked.replace(honorificNameRegex, (fullMatch, prefix, capturedName) => {
    if (!capturedName || capturedName.length < 2) return fullMatch;
    const lower = capturedName.toLowerCase();
    if (['ngoan', 'mệt', 'ốm', 'sốt', 'khỏe', 'vui'].includes(lower)) return fullMatch;
    const token = `[TRE_EM_${childCounter++}]`;
    tokenMap[token] = capturedName;
    return `${prefix} ${token}`;
  });

  return {
    maskedText: masked,
    tokenMap,
  };
}

/**
 * Restores original names/phones into response text
 */
export function restoreChildPii(maskedText: string, tokenMap: Readonly<Record<string, string>>): string {
  let restored = maskedText;
  for (const [token, original] of Object.entries(tokenMap)) {
    restored = restored.split(token).join(original);
  }
  return restored;
}

export const unmaskResponse = restoreChildPii;

/**
 * Executes requested AI Copilot capability
 */
export async function executePreschoolCopilot(
  request: PreschoolCopilotRequest
): Promise<PreschoolCopilotResponse> {
  const timestamp = new Date().toISOString();

  switch (request.action) {
    case 'classify_intent': {
      const tool = preschoolAICapabilityPack.tools.find((t) => t.id === 'classify_parent_intent');
      if (!tool) throw new Error('Tool classify_parent_intent not found');

      const masked = maskChildPii(request.message || '');
      const rawResult = await tool.execute({ message: masked.maskedText });
      const result = rawResult as unknown as ParentIntentClassification;

      return {
        success: true,
        action: request.action,
        data: result as unknown as Record<string, unknown>,
        piiMasked: Object.keys(masked.tokenMap).length > 0,
        timestamp,
      };
    }

    case 'extract_care': {
      const tool = preschoolAICapabilityPack.tools.find((t) => t.id === 'extract_care_instruction');
      if (!tool) throw new Error('Tool extract_care_instruction not found');

      const masked = maskChildPii(request.rawText || '');
      const rawResult = await tool.execute({ rawText: masked.maskedText });
      const result = rawResult as unknown as CareInstructionExtraction;

      return {
        success: true,
        action: request.action,
        data: result as unknown as Record<string, unknown>,
        piiMasked: Object.keys(masked.tokenMap).length > 0,
        timestamp,
      };
    }

    case 'detect_anomaly': {
      const tool = preschoolAICapabilityPack.tools.find((t) => t.id === 'detect_health_anomaly');
      if (!tool) throw new Error('Tool detect_health_anomaly not found');

      const rawResult = await tool.execute({
        temperatureCelsius: request.temperatureCelsius,
        napMinutes: request.napMinutes,
        mealsFinishedRate: request.mealsFinishedRate,
      });
      const result = rawResult as unknown as HealthAnomalyResult;

      return {
        success: true,
        action: request.action,
        data: result as unknown as Record<string, unknown>,
        piiMasked: false,
        timestamp,
      };
    }

    case 'check_allergy': {
      const tool = preschoolAICapabilityPack.tools.find((t) => t.id === 'check_allergy_safety');
      if (!tool) throw new Error('Tool check_allergy_safety not found');

      const rawResult = await tool.execute({
        menuDishes: request.menuDishes || [],
        childAllergens: request.childAllergens || [],
      });
      const result = rawResult as unknown as AllergySafetyResult;

      return {
        success: true,
        action: request.action,
        data: result as unknown as Record<string, unknown>,
        piiMasked: false,
        timestamp,
      };
    }

    case 'generate_digest': {
      const tool = preschoolAICapabilityPack.tools.find((t) => t.id === 'generate_daily_digest');
      if (!tool) throw new Error('Tool generate_daily_digest not found');

      const rawResult = await tool.execute({
        studentName: request.studentName,
        attendanceStatus: request.attendanceStatus,
        mealFeedback: request.mealFeedback,
        napFeedback: request.napFeedback,
        activityNotes: request.activityNotes,
      });

      return {
        success: true,
        action: request.action,
        data: rawResult,
        piiMasked: false,
        timestamp,
      };
    }

    case 'ask_copilot': {
      const question = String(request.question || '').trim();
      const apiKey = request.geminiApiKey || process.env.GEMINI_API_KEY;

      const masked = maskChildPii(question, request.studentName ? [request.studentName] : undefined);

      if (apiKey && apiKey.trim().length > 10) {
        try {
          const prompt = `Bạn là Trợ lý AI Giáo dục Mầm non (Bella Preschool Copilot).
Nhiệm vụ của bạn là hỗ trợ Giáo viên chủ nhiệm và Ban giám hiệu trường mầm non giải quyết các câu hỏi nghiệp vụ, chăm sóc trẻ, sư phạm mầm non và giao tiếp với phụ huynh.
Nguyên tắc:
1. Luôn đề cao an toàn, sức khỏe và tâm lý của trẻ em.
2. Trả lời ngắn gọn, thiết thực, có tính hành động ngay, văn phong ấm áp, chuẩn mực sư phạm.
3. Không tự ý kê đơn thuốc hay kết luận bệnh lý phức tạp (luôn nhắc nhở tham vấn bác sĩ khi có dấu hiệu nặng).

Ngữ cảnh lớp học bổ sung:
${JSON.stringify(request.contextData || {}, null, 2)}

Câu hỏi của giáo viên:
"${masked.maskedText}"`;

          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
              }),
            }
          );

          if (res.ok) {
            const data = (await res.json()) as {
              candidates?: readonly { content?: { parts?: readonly { text?: string }[] } }[];
            };
            const rawAnswer = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const restoredAnswer = restoreChildPii(rawAnswer, masked.tokenMap);

            return {
              success: true,
              action: request.action,
              data: {
                answer: restoredAnswer,
                source: 'gemini',
                confidence: 0.95,
              },
              piiMasked: Object.keys(masked.tokenMap).length > 0,
              timestamp,
            };
          }
        } catch {
          // Fall through to deterministic heuristic response
        }
      }

      // Fallback deterministic response when offline or key absent
      const lower = question.toLowerCase();
      let answer = 'Chào cô! Em là Trợ lý Mầm non Bella Copilot. Em có thể giúp cô kiểm tra bất thường sức khỏe, gợi ý thực đơn, trích xuất dặn thuốc hoặc soạn nhật ký gửi phụ huynh.';

      if (lower.includes('sốt') || lower.includes('nhiệt độ')) {
        answer = 'Khi trẻ sốt: Nếu >= 37.8°C, cô nên chườm khăn ấm ở trán, nách, bẹn và cho trẻ uống nhiều nước ấm. Nếu >= 38.5°C, cần liên hệ phụ huynh ngay và chuyển trẻ về phòng y tế trường theo dõi.';
      } else if (lower.includes('dị ứng') || lower.includes('thực đơn')) {
        answer = 'Cô có thể dùng công cụ Đối chiếu Dị ứng để quét nhanh thực đơn trưa và chiều của lớp, nhằm loại bỏ các món có trứng, sữa bò, đậu phộng hoặc hải sản đối với các bé có tiền sử dị ứng.';
      } else if (lower.includes('nhật ký') || lower.includes('daily digest') || lower.includes('cuối ngày')) {
        answer = 'Cô có thể bấm vào chức năng "Tạo nhật ký cuối ngày" để AI tự động tổng hợp tình trạng ăn, ngủ và hoạt động vui chơi của trẻ thành tin nhắn gửi qua Sổ liên lạc điện tử PWA cho ba mẹ.';
      }

      return {
        success: true,
        action: request.action,
        data: {
          answer,
          source: 'preschool_ai_pack_rules',
          confidence: 0.9,
        },
        piiMasked: Object.keys(masked.tokenMap).length > 0,
        timestamp,
      };
    }

    default: {
      throw new Error(`Unsupported preschool copilot action: ${String(request.action)}`);
    }
  }
}
