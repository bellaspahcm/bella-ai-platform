import { SupabaseClient } from '@supabase/supabase-js';
import { Database, Json } from '@/types/database.types';
import type { COOAnalysisResult, SubAgentResponse } from './types';
import { runCPOAgent } from './agents/cpo';
import { runCMOAgent } from './agents/cmo';
import { runFranchiseAgent } from './agents/franchise';
import { runCHROAgent } from './agents/chro';
import { runCFOAgent } from './agents/cfo';
import { runRealEstateAgent } from './agents/real_estate';
import { runInteriorAgent } from './agents/interior';

/**
 * Tìm vị trí đóng của `{` đầu tiên bằng thuật toán brace-matching,
 * tránh lỗi khi Gemini trả về nhiều JSON object liên tiếp hoặc text sau JSON.
 */
function findBalancedJsonEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function cleanAndParseJson(text: string): Record<string, unknown> {
  let cleaned = text.trim();
  // Remove markdown code blocks if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  cleaned = cleaned.trim();

  // Dùng brace-matching thay vì lastIndexOf để tránh merge nhiều JSON object
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace !== -1) {
    const lastBrace = findBalancedJsonEnd(cleaned, firstBrace);
    if (lastBrace !== -1) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
  }

  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch (e) {
    // Attempt to repair common JSON syntax issues like trailing commas
    const repairAttempt = cleaned.replace(/,\s*([\]}])/g, "$1");
    try {
      return JSON.parse(repairAttempt) as Record<string, unknown>;
    } catch {
      throw e; // throw the original error if repair fails
    }
  }
}

function detectRouting(lowerCommand: string): string {
  const isHrRelated = lowerCommand.includes("nhân sự") ||
    lowerCommand.includes("lương") || lowerCommand.includes("chấm công") ||
    lowerCommand.includes("ktv") || lowerCommand.includes("kpi") ||
    lowerCommand.includes("ca làm") || lowerCommand.includes("năng suất") ||
    lowerCommand.includes("productivity") || lowerCommand.includes("therapist") ||
    lowerCommand.includes("hoa hồng") || lowerCommand.includes("commission") ||
    lowerCommand.includes("occupancy") || lowerCommand.includes("kín lịch") ||
    lowerCommand.includes("sop") || lowerCommand.includes("quy trình") ||
    lowerCommand.includes("compliance") || lowerCommand.includes("tuân thủ") ||
    lowerCommand.includes("kỷ luật");

  const isFinanceRelated = lowerCommand.includes("tài chính") ||
    lowerCommand.includes("kế toán") || lowerCommand.includes("doanh thu") ||
    lowerCommand.includes("chi phí") || lowerCommand.includes("lợi nhuận") ||
    lowerCommand.includes("quỹ") || lowerCommand.includes("đối soát") ||
    lowerCommand.includes("cân đối") || lowerCommand.includes("phát sinh") ||
    lowerCommand.includes("sổ cái") || lowerCommand.includes("sổ quỹ") ||
    lowerCommand.includes("p&l") || lowerCommand.includes("trial balance") ||
    lowerCommand.includes("income statement") || lowerCommand.includes("cash flow") ||
    lowerCommand.includes("revenue") || lowerCommand.includes("net profit") ||
    lowerCommand.includes("cashflow") || lowerCommand.includes("chi phí lương") ||
    lowerCommand.includes("ebitda") || lowerCommand.includes("margin") ||
    lowerCommand.includes("biên lợi nhuận") || lowerCommand.includes("dòng tiền thực");

  const isCpoRelated = lowerCommand.includes("kho") ||
    lowerCommand.includes("vật tư") || lowerCommand.includes("dầu massage") ||
    lowerCommand.includes("tồn kho") || lowerCommand.includes("sku") ||
    lowerCommand.includes("nhập kho") || lowerCommand.includes("tiêu hao") ||
    lowerCommand.includes("khăn") || lowerCommand.includes("stockout") ||
    lowerCommand.includes("đứt hàng") || lowerCommand.includes("vòng quay") ||
    lowerCommand.includes("turnover") || lowerCommand.includes("hao hụt");

  const isCmoRelated = lowerCommand.includes("khách") ||
    lowerCommand.includes("customer") || lowerCommand.includes("đánh giá") ||
    lowerCommand.includes("rating") || lowerCommand.includes("chăm sóc") ||
    lowerCommand.includes("hài lòng") || lowerCommand.includes("feedback") ||
    lowerCommand.includes("nhận xét") || lowerCommand.includes("review") ||
    lowerCommand.includes("marketing") || lowerCommand.includes("ads") ||
    lowerCommand.includes("quảng cáo") || lowerCommand.includes("roi") ||
    lowerCommand.includes("cac") || lowerCommand.includes("ltv") ||
    lowerCommand.includes("no-show") || lowerCommand.includes("no show") ||
    lowerCommand.includes("hủy lịch") || lowerCommand.includes("lịch hẹn") ||
    lowerCommand.includes("booking") || lowerCommand.includes("referral") ||
    lowerCommand.includes("giới thiệu") || lowerCommand.includes("combo") ||
    lowerCommand.includes("liệu trình") || lowerCommand.includes("package") ||
    lowerCommand.includes("repeat booking") || lowerCommand.includes("quay lại") ||
    lowerCommand.includes("csat") || lowerCommand.includes("nps") ||
    lowerCommand.includes("complaint") || lowerCommand.includes("khiếu nại") ||
    lowerCommand.includes("refund") || lowerCommand.includes("hoàn tiền") ||
    lowerCommand.includes("trả hàng");

  const isFranchiseRelated = lowerCommand.includes("nhượng quyền") ||
    lowerCommand.includes("royalty") || lowerCommand.includes("đối soát chuỗi") ||
    lowerCommand.includes("chi nhánh nhượng quyền") || lowerCommand.includes("clearing") ||
    lowerCommand.includes("đóng góp") || lowerCommand.includes("contribution") ||
    lowerCommand.includes("thương hiệu") || lowerCommand.includes("brand");

  const isRealEstateRelated = lowerCommand.includes("bất động sản") ||
    lowerCommand.includes("bđs") || lowerCommand.includes("căn hộ") ||
    lowerCommand.includes("dự án bđs") || lowerCommand.includes("bảng hàng") ||
    lowerCommand.includes("đất nền") || lowerCommand.includes("shophouse") ||
    lowerCommand.includes("chủ đầu tư") || lowerCommand.includes("villa") ||
    lowerCommand.includes("real estate") || lowerCommand.includes("realestate");

  const isInteriorRelated = lowerCommand.includes("nội thất") ||
    lowerCommand.includes("interior") || lowerCommand.includes("dự án nội thất") ||
    lowerCommand.includes("boq") || lowerCommand.includes("dự toán") ||
    lowerCommand.includes("spec lock") || lowerCommand.includes("khóa mẫu") ||
    lowerCommand.includes("bản vẽ 3d") || lowerCommand.includes("xưởng sản xuất") ||
    lowerCommand.includes("thi công lắp đặt") || lowerCommand.includes("nghiệm thu") ||
    lowerCommand.includes("vật tư nội thất") || lowerCommand.includes("vật liệu nội thất") ||
    lowerCommand.includes("gỗ") || lowerCommand.includes("đá nhân tạo") ||
    lowerCommand.includes("tiến độ công trình") || lowerCommand.includes("phát sinh dự toán") ||
    lowerCommand.includes("thiết kế nội thất") || lowerCommand.includes("fitout") ||
    lowerCommand.includes("chậm tiến độ");

  if (isInteriorRelated) {
    if (lowerCommand.includes("kinh doanh") || lowerCommand.includes("sales") || lowerCommand.includes("bán hàng") || lowerCommand.includes("chốt thầu") || lowerCommand.includes("hợp đồng mới") || lowerCommand.includes("upsell") || lowerCommand.includes("khách hàng tiềm năng") || lowerCommand.includes("phễu")) {
      return "interior_cco";
    }
    if (lowerCommand.includes("xưởng") || lowerCommand.includes("sản xuất") || lowerCommand.includes("nhà máy") || lowerCommand.includes("gia công") || lowerCommand.includes("spec lock") || lowerCommand.includes("khóa mẫu") || lowerCommand.includes("cnc") || lowerCommand.includes("phôi gỗ") || lowerCommand.includes("an cường") || lowerCommand.includes("blum") || lowerCommand.includes("vicostone")) {
      return "interior_cpo";
    }
    if (lowerCommand.includes("nhân sự") || lowerCommand.includes("kts") || lowerCommand.includes("kiến trúc sư") || lowerCommand.includes("tải công việc") || lowerCommand.includes("thợ xưởng") || lowerCommand.includes("tuyển dụng thợ") || lowerCommand.includes("năng suất thiết kế")) {
      return "interior_chro";
    }
    if (lowerCommand.includes("tài chính") || lowerCommand.includes("kế toán") || lowerCommand.includes("p&l") || lowerCommand.includes("giá vốn") || lowerCommand.includes("cogs") || lowerCommand.includes("biên lợi nhuận") || lowerCommand.includes("công nợ") || lowerCommand.includes("dòng tiền") || lowerCommand.includes("thu tiền") || lowerCommand.includes("thanh toán đợt")) {
      return "interior_cfo";
    }
    if (lowerCommand.includes("vận hành") || lowerCommand.includes("tiến độ") || lowerCommand.includes("thi công") || lowerCommand.includes("lắp đặt") || lowerCommand.includes("công trường") || lowerCommand.includes("hiện trường") || lowerCommand.includes("chậm tiến độ") || lowerCommand.includes("mặt bằng") || lowerCommand.includes("bàn giao")) {
      return "interior_coo";
    }
    if (lowerCommand.includes("quản trị") || lowerCommand.includes("chiến lược") || lowerCommand.includes("toàn diện") || lowerCommand.includes("chuỗi giá trị") || lowerCommand.includes("rủi ro chéo") || lowerCommand.includes("nghị quyết")) {
      return "interior_advisor";
    }
    return "interior";
  }
  if (isCpoRelated) return "cpo";
  if (isCmoRelated) return "cmo";
  if (isFranchiseRelated) return "franchise";
  if (isHrRelated) return "chro";
  if (isFinanceRelated) return "cfo";
  if (isRealEstateRelated) return "real_estate";
  return "coo";
}

function getStrategicRecommendations(routedTo: string): string[] {
  if (routedTo === "chro") return [
    "Ban hành quy chế thắt chặt bán kính nhận ca dịch vụ (< 5km) cho KTV chi nhánh để tối ưu chi phí di chuyển.",
    "Yêu cầu KTV Lead tổ chức buổi chấn chỉnh ý thức tổ chức kỷ luật và quy trình Check-in GPS đúng vị trí nhà khách.",
    "Kích hoạt tính năng gửi tin nhắn nhắc nhở giải trình tự động qua Telegram/Zalo OA cho các KTV có bất thường cao nhất."
  ];
  if (routedTo === "cfo") return [
    "Định kỳ chạy đối soát quỹ đối chiếu với báo cáo doanh thu để kiểm tra sai lệch quỹ kế toán trước ngày 5 hàng tháng.",
    "Thắt chặt kiểm soát các chi phí vận hành biến động (dầu massage, khăn sạch, vật tư trị liệu hao hụt) của chi nhánh có biên lợi nhuận thấp.",
    "Rà soát lại việc ghi nhận sổ cái cho các khoản chiết khấu dịch vụ của các combo cao cấp."
  ];
  if (routedTo === "cpo") return [
    "Thiết lập hạn mức nhập hàng thông minh (Min-Max) tự động nhắc nhở khi sản phẩm giảm sâu.",
    "Rà soát định mức tiêu hao nguyên vật liệu thực tế trên mỗi ca trị liệu tránh thất thoát dầu massage và khăn sạch.",
    "Lên lịch làm việc trực tiếp với các nhà cung cấp vật tư spa cốt lõi để đàm phán hợp đồng cung ứng dài hạn giá ưu đãi."
  ];
  if (routedTo === "cmo") return [
    "Liên hệ ngay lập tức với các khách hàng có phản hồi tiêu cực dưới 4 sao để xin lỗi và xử lý khiếu nại.",
    "Xây dựng chương trình thưởng nóng định kỳ tháng cho các KTV đạt điểm CSAT trung bình tuyệt đối 5.0 sao.",
    "Triển khai phễu nuôi dưỡng từ cuộc gọi hỏi thăm (inquiry) sang đặt cọc (deposit_pending) để tăng tỷ lệ chốt gói."
  ];
  if (routedTo === "franchise") return [
    "Tăng cường rà soát chênh lệch doanh thu hạch toán Ledger so với số liệu doanh thu thực tế để tính toán chính xác phí nhượng quyền.",
    "Gửi thông báo nhắc nhở đối soát và thanh toán hóa đơn nhượng quyền định kỳ đúng hạn hợp đồng.",
    "Hỗ trợ chi nhánh cải thiện cơ cấu chi phí vận hành nếu phát hiện tỷ lệ biên lợi nhuận thuần bị thu hẹp kéo dài."
  ];
  if (routedTo === "real_estate") return [
    "Thẩm định hồ sơ pháp lý và tiến độ thi công của các dự án trước khi tiếp tục mở bán Block tiếp theo.",
    "Đánh giá và tối ưu phân bổ hoa hồng môi giới bất động sản cho các sàn giao dịch liên kết.",
    "Bật cảnh báo tự động gửi Zalo ZNS nhắc nhở các khách hàng trễ hạn đóng tiền đợt thanh toán tiến độ."
  ];
  if (routedTo === "interior_cco") return [
    "Xây dựng chính sách ưu đãi chiết khấu 50% phí thiết kế khi ký hợp đồng thi công trọn gói để tăng tỷ lệ chốt thầu.",
    "Tập trung khai thác phân khúc biệt thự và dinh thự cao cấp có deal size trung bình > 1 tỷ đồng/hợp đồng.",
    "Thiết lập gói đề xuất đồ rời và thiết bị bếp cao cấp nâng cao giá trị trung bình trên mỗi công trình."
  ];
  if (routedTo === "interior_cpo") return [
    "Kích hoạt quy trình khóa mẫu vật tư (Spec Lock) bắt buộc trước khi chuyển lệnh sang xưởng gia công nội thất.",
    "Bố trí ca chạy máy cắt CNC 2 ca/ngày tại phân xưởng để bảo đảm tiến độ gia công module đồ gỗ cho các công trình trọng điểm.",
    "Đàm phán với các nhà cung cấp cốt ván MDF An Cường và phụ kiện Blum để giữ giá cố định và dự phòng nguồn cung cuối năm."
  ];
  if (routedTo === "interior_coo") return [
    "Điều động 02 đội thợ hoàn thiện hiện trường tăng ca buổi tối để bù lại 5% tiến độ bị trễ tại các công trình có nguy cơ.",
    "Khảo sát và xử lý xung đột mặt bằng thi công giữa đội thợ thạch cao, sơn nước và đội lắp ráp đồ gỗ trước 03 ngày lắp đặt.",
    "Áp dụng quy trình kiểm tra chất lượng KCS từng công đoạn để không phát sinh sửa chữa kéo dài thời gian bàn giao."
  ];
  if (routedTo === "interior_chro") return [
    "Bổ sung 01 KTS phụ tá triển khai bản vẽ chi tiết hỗ trợ các KTS chủ trì đang gánh khối lượng dự án cao điểm.",
    "Ký hợp đồng lao động thời vụ với 04 thợ mộc hoàn thiện và 02 thợ sơn PU lành nghề bổ sung cho phân xưởng.",
    "Rà soát chỉ số năng suất triển khai bản vẽ 3D/2D và thưởng nóng cho các đồ án hoàn thành trước cam kết hợp đồng."
  ];
  if (routedTo === "interior_cfo") return [
    "Rà soát lại dự toán BOQ và định mức tiêu hao các hạng mục gỗ công nghiệp và đá nhân tạo để bảo vệ biên lợi nhuận > 40%.",
    "Phát hành công văn đề nghị thanh toán đợt tiếp theo đối với các dự án đã ký biên bản nghiệm thu từng phần để giảm công nợ > 3 tỷ đ.",
    "Theo dõi chặt chẽ tiến độ dòng tiền tạm ứng và kiểm soát tạm ứng thầu phụ vật liệu để giữ cân đối ngân quỹ."
  ];
  if (routedTo === "interior_advisor" || routedTo === "interior") return [
    "Thắt chặt liên kết chuỗi giá trị: Khóa mẫu Spec Lock (Thiết kế) -> Xuất xưởng CNC (Xưởng) -> Lắp đặt hiện trường (Công trình) -> Nghiệm thu giải ngân (Tài chính).",
    "Tập trung tháo gỡ điểm nghẽn dự án Skyline Residence để thu hồi công nợ 1.2 tỷ đ tái đầu tư nguồn vật tư.",
    "Duy trì hội đồng giao ban điều hành AI định kỳ hàng tuần giữa 5 khối chuyên môn để phòng ngừa rủi ro chéo."
  ];
  return [
    "Định kỳ rà soát các chỉ số vận hành cốt lõi toàn diện chuỗi chi nhánh Bella Spa.",
    "Sử dụng AI Copilot để phân tích chéo dữ liệu giữa các phòng ban nhằm nâng cao hiệu suất.",
    "Chủ động lên kế hoạch phòng ngừa rủi ro về mặt nhân sự, tồn kho và đối soát tài chính."
  ];
}

async function loadGeminiApiKey(supabase: SupabaseClient<Database>, tenantId: string): Promise<string | undefined> {
  let geminiApiKey = process.env.GEMINI_API_KEY;

  try {
    const { data: configData } = await supabase
      .from("ai_agent_configs")
      .select("gemini_api_key")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .maybeSingle();

    if (configData?.gemini_api_key) {
      geminiApiKey = configData.gemini_api_key.trim();
      console.log("[AI COO Service] Đã đọc GEMINI_API_KEY thành công từ Database chi nhánh:", tenantId);
    }
  } catch (dbErr) {
    console.error("[AI COO Service] Lỗi truy vấn API key từ Database:", dbErr);
  }

  if (!geminiApiKey || geminiApiKey.trim().length < 10) {
    try {
       
      const fs = require("fs");
       
      const path = require("path");
      const envPath = path.join(process.cwd(), ".env.local");
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, "utf8");
        const match = envContent.match(/^GEMINI_API_KEY\s*=\s*(.+)$/m);
        if (match?.[1]) {
          geminiApiKey = match[1].trim();
          console.log("[AI COO Service] Đã đọc GEMINI_API_KEY trực tiếp từ file .env.local thành công!");
        }
      }
    } catch (fsErr) {
      console.error("[AI COO Service] Không thể đọc trực tiếp từ .env.local:", fsErr);
    }
  }

  return geminiApiKey;
}

export async function runCOOOrchestrator(
  supabase: SupabaseClient<Database>,
  command: string,
  tenantId: string,
  user: { id: string; full_name: string; role: string },
  monthYear?: string
): Promise<COOAnalysisResult> {
  const activeDate = monthYear ? new Date(monthYear) : new Date();
  const formattedDate = activeDate.toISOString().split('T')[0]; // YYYY-MM-DD for internal use
  // Format date for Vietnamese display: DD/MM/YYYY
  const vietnameseDate = `${String(activeDate.getDate()).padStart(2, '0')}/${String(activeDate.getMonth() + 1).padStart(2, '0')}/${activeDate.getFullYear()}`;
  const firstDayOfMonth = new Date(activeDate.getFullYear(), activeDate.getMonth(), 1).toISOString().split('T')[0];
  const lowerCommand = command.toLowerCase();

  const routedTo = detectRouting(lowerCommand);

  let subAgentResponse: SubAgentResponse | null = null;

  if (routedTo === "cpo") {
    subAgentResponse = await runCPOAgent(supabase, tenantId, activeDate);
  } else if (routedTo === "cmo") {
    subAgentResponse = await runCMOAgent(supabase, tenantId, activeDate, firstDayOfMonth);
  } else if (routedTo === "franchise") {
    subAgentResponse = await runFranchiseAgent(supabase, tenantId, activeDate, formattedDate, firstDayOfMonth);
  } else if (routedTo === "chro") {
    subAgentResponse = await runCHROAgent(supabase, tenantId, activeDate, formattedDate);
  } else if (routedTo === "cfo") {
    subAgentResponse = await runCFOAgent(supabase, tenantId, activeDate, formattedDate, firstDayOfMonth, lowerCommand);
  } else if (routedTo === "real_estate") {
    subAgentResponse = await runRealEstateAgent(supabase, tenantId, activeDate);
  } else if (routedTo.startsWith("interior")) {
    subAgentResponse = await runInteriorAgent(supabase, tenantId, activeDate, routedTo);
  } else {
    subAgentResponse = {
      agent: "General Operation",
      period: `Tháng ${activeDate.getMonth() + 1}/${activeDate.getFullYear()}`,
      summary: "AI COO đã tiếp nhận lệnh vận hành tổng và đang chuẩn bị dữ liệu.",
      data: null
    };
  }

  const responseSummary = subAgentResponse.summary;

  const { error: logError } = await supabase.from("ai_agent_logs").insert({
    tenant_id: tenantId,
    user_id: user.id || null,
    sender: "coo",
    message: `CEO ra lệnh: "${command}". Định tuyến tới ${routedTo}. Kết quả: ${responseSummary}`,
    metadata: {
      command,
      routed_to: routedTo,
      active_date: formattedDate,
      sub_agent_data: subAgentResponse as unknown as Json
    }
  });

  if (logError) {
    console.error("[AI COO Service] Lỗi chèn nhật ký AI log:", logError);
    throw logError;
  }

  const geminiApiKey = await loadGeminiApiKey(supabase, tenantId);

  let executiveSummary = subAgentResponse.summary;
  let anomaliesFound: unknown[] = subAgentResponse.anomalies || [];
  let draftActions: unknown[] = subAgentResponse.draftProposals || [];
  let strategicRecommendations = getStrategicRecommendations(routedTo);

  if (!geminiApiKey || geminiApiKey.trim().length < 10) {
     
    const fs = require("fs");
     
    const path = require("path");
    const envPath = path.join(process.cwd(), ".env.local");
    const exists = fs.existsSync(envPath);
    let debugInfo = `Cwd: ${process.cwd()}, Path: ${envPath}, Exists: ${exists}`;
    if (exists) {
      try {
        const content = fs.readFileSync(envPath, "utf8");
        debugInfo += `, Content Length: ${content.length}`;
        const match = content.match(/^GEMINI_API_KEY\s*=\s*(.+)$/m);
        debugInfo += `, Match Found: ${!!match}`;
        if (match) {
          debugInfo += `, Match[1] Length: ${match[1] ? match[1].trim().length : 0}`;
        }
      } catch (err: unknown) {
        debugInfo += `, Read Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
    executiveSummary = `⚠️ Hệ thống chưa nạp được GEMINI_API_KEY hợp lệ từ file .env.local (Độ dài khóa tìm được: ${geminiApiKey ? geminiApiKey.trim().length : 0} ký tự). Chi tiết chẩn đoán: [${debugInfo}]. Vui lòng kiểm tra lại cấu hình key trong file .env.local ở thư mục gốc dự án.`;
  } else {
    try {
      console.log("[AI COO Service] Phát hiện GEMINI_API_KEY. Tiến hành gọi Gemini API cho phân tích thông minh...");

      let assistantName = "COO (Ban Điều Hành)";
      if (routedTo === "chro") assistantName = "CHRO (Trưởng phòng Nhân sự - Tiền lương)";
      else if (routedTo === "cfo") assistantName = "CFO (Trưởng phòng Tài chính - Kế toán)";
      else if (routedTo === "cpo") assistantName = "CPO (Trưởng phòng Kho vận & Vật tư)";
      else if (routedTo === "cmo") assistantName = "CMO (Trưởng phòng Chăm sóc khách hàng & Marketing)";
      else if (routedTo === "franchise") assistantName = "Franchise (Ban vận hành Nhượng quyền)";
      else if (routedTo === "real_estate") assistantName = "Real Estate AI Specialist (Chuyên gia Bất Động Sản)";
      else if (routedTo === "interior_cco") assistantName = "Interior CCO (AI Giám đốc Kinh doanh Nội thất)";
      else if (routedTo === "interior_cpo") assistantName = "Interior CPO (AI Giám đốc Sản xuất & Xưởng Nội thất)";
      else if (routedTo === "interior_coo") assistantName = "Interior COO (AI Giám đốc Vận hành & Thi công Dự án)";
      else if (routedTo === "interior_chro") assistantName = "Interior CHRO (AI Giám đốc Nhân sự & Năng suất KTS/Thợ)";
      else if (routedTo === "interior_cfo") assistantName = "Interior CFO (AI Giám đốc Tài chính - Kế toán Dự án)";
      else if (routedTo === "interior_advisor" || routedTo === "interior") assistantName = "Interior Strategic Advisor (AI Cố vấn Quản trị & Điều hành Toàn diện)";

      let actionType = 'reconciliation_audit';
      if (routedTo === 'chro') actionType = 'attendance_warning';
      else if (routedTo === 'cpo') actionType = 'inventory_restock';
      else if (routedTo === 'cmo') actionType = 'customer_apology';
      else if (routedTo === 'franchise') actionType = 'royalty_payment_reminder';
      else if (routedTo === 'real_estate') actionType = 'real_estate_release_next_block';
      else if (routedTo === 'interior_cco') actionType = 'interior_sales_followup';
      else if (routedTo === 'interior_cpo') actionType = 'interior_spec_lock_approval';
      else if (routedTo === 'interior_coo') actionType = 'interior_schedule_recovery';
      else if (routedTo === 'interior_chro') actionType = 'interior_architect_rebalance';
      else if (routedTo === 'interior_cfo') actionType = 'interior_boq_variance_review';
      else if (routedTo === 'interior_advisor' || routedTo === 'interior') actionType = 'interior_executive_action';

      const prompt = `Bạn là AI COO (trợ lý điều phối vận hành cấp cao) của hệ thống EIP spa.
Nhiệm vụ của bạn là nhận câu lệnh ngôn ngữ tự nhiên của Ban điều hành, kết hợp với bộ dữ liệu thô vừa truy xuất từ hệ thống EIP chi nhánh để viết báo cáo tóm tắt phân tích sâu sắc, chính xác số liệu và đề xuất các quyết định thực tế.

CÔNG THỨC & NGUYÊN TẮC PHÂN TÍCH NGHIỆP VỤ BẮT BUỘC:
1. Nguyên tắc Đánh giá CSAT:
   - Điểm số CSAT trung bình và danh sách phản hồi tiêu cực (dưới 4 sao) chỉ được tính từ các đánh giá có trạng thái đã phê duyệt ("status": "approved").
   - Tuyệt đối KHÔNG được nhận diện các bản ghi nháp/đang chờ đánh giá có trạng thái chờ duyệt ("status": "pending_review") với điểm số mặc định là 0 ("rating": 0 hoặc null) là "đánh giá tiêu cực 0 sao". Đây chỉ là các placeholder được tạo tự động để chờ khách hàng đánh giá.

2. Nguyên tắc Trạng thái Lịch hẹn & Tiến độ Gói Liệu Trình:
   - Dữ liệu "today_sessions" trong payload chứa DANH SÁCH CHÍNH XÁC các ca được lên lịch hôm nay.
   - Mỗi ca trong "today_sessions.sessions" có trường "status": "completed" (đã hoàn thành) hoặc "scheduled"/"in_progress" (chưa hoàn thành).
   - Trường "progress" trong mỗi ca đã được tính sẵn dưới dạng "Buổi X/Y (Đã hoàn thành A/Y buổi)" - hãy trích dẫn NGUYÊN VĂN con số này, KHÔNG được tự tính lại.
   - Trường "completed_by_ktv" là tên KTV đã thực hiện ca đó (nếu null = chưa có KTV thực hiện).
   - Báo cáo bắt buộc phải nêu: ca hôm nay đã hoàn thành hay chưa, KTV nào thực hiện, và tiến độ gói là buổi thứ bao nhiêu trên tổng số buổi.

3. Nguyên tắc Phân tích Dữ liệu Thực tế:
   - CHỈ phân tích và báo cáo những con số có thực trong payload dữ liệu được cung cấp.
   - KHÔNG được suy diễn, ước tính hoặc bịa đặt số liệu không có trong dữ liệu thô.
   - Nếu một trường là null hoặc không có dữ liệu, hãy báo cáo "Chưa có dữ liệu" thay vì đặt giả định.

Thông tin ngữ cảnh:
- Câu lệnh của Ban điều hành: "${command}"
- Bộ trợ lý chuyên môn đang phân tích: ${assistantName}
- Kỳ báo cáo: ${vietnameseDate}
- Dữ liệu thô từ Hệ thống EIP chi nhánh:
${JSON.stringify(subAgentResponse.aiSummaryData ?? subAgentResponse.data, null, 2)}

Yêu cầu định dạng phản hồi:
Bạn phải trả về DUY NHẤT một chuỗi JSON hợp lệ (không chứa mã markdown \`\`\`json hay bất kỳ chữ nào ngoài JSON) có cấu trúc chính xác như sau:
{
  "executiveSummary": "Đoạn văn tóm tắt điều hành (khoảng 3-4 câu) bằng tiếng Việt chuyên nghiệp gửi đến Ban điều hành. Hãy phân tích trực tiếp các con số thực tế trong dữ liệu thô (ví dụ: chỉ rõ nhân sự KTV nào vi phạm GPS hoặc đi muộn ca dịch vụ, mặt hàng tồn kho nào dưới hạn mức tối thiểu, điểm CSAT trung bình và các nhận xét tiêu cực của khách hàng, hoặc tình trạng thanh toán hóa đơn nhượng quyền). Xưng hô lịch sự với Ban điều hành và dùng từ ngữ của một COO thực thụ.",
  "anomaliesFound": [
    "Mô tả bất thường 1 phát hiện từ số liệu (ví dụ: 'Mặt hàng Dầu Massage chỉ còn tồn 2 chai')",
    "Mô tả bất thường 2 phát hiện từ số liệu..."
  ],
  "strategicRecommendations": [
    "Gợi ý chiến lược 1 (chuỗi ngắn gọn, thực tế và hành động được ngay)",
    "Gợi ý chiến lược 2 (chuỗi ngắn gọn, thực tế...)",
    "Gợi ý chiến lược 3 (chuỗi ngắn gọn, thực tế...)"
  ],
  "draftActions": [
    {
      "type": "${actionType}",
      "recipient": "Tên đối tượng nhận (tên KTV, bộ phận Kho vận, tên khách hàng hoặc tên chi nhánh nhượng quyền)",
      "reason": "Lý do chi tiết phát hiện lỗi hoặc chênh lệch cần xử lý",
      "draftMessage": "Nội dung tin nhắn dự thảo chi tiết để gửi cho đối tượng qua Telegram/Zalo. Cần viết lịch sự nhưng nghiêm túc, chứa số liệu vi phạm hoặc con số cụ thể."
    }
  ]
}`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiApiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (response.ok) {
        const resData = await response.json();
        const textResponse = resData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textResponse) {
          // Log raw response để debug khi có lỗi JSON parse
          console.log("[AI COO Service] Raw Gemini response (first 500 chars):", textResponse.substring(0, 500));
          console.log("[AI COO Service] Raw Gemini response length:", textResponse.length);
          const parsed = cleanAndParseJson(textResponse);
          if (parsed.executiveSummary) executiveSummary = parsed.executiveSummary as string;
          if (parsed.anomaliesFound) anomaliesFound = parsed.anomaliesFound as unknown[];
          if (parsed.strategicRecommendations) strategicRecommendations = parsed.strategicRecommendations as string[];
          if (Array.isArray(parsed.draftActions) && parsed.draftActions.length > 0) {
            draftActions = parsed.draftActions;
          }
          console.log("[AI COO Service] Gọi Gemini thành công và phân tích số liệu thành công!");
        }
      } else {
        const errPayload = await response.json().catch(() => ({}));
        console.error("[AI COO Service] Gọi Gemini API thất bại, HTTP status:", response.status);
        executiveSummary = `⚠️ Gọi Gemini API thất bại (HTTP Status: ${response.status}). Phản hồi lỗi: ${JSON.stringify(errPayload)}`;
      }
    } catch (geminiErr: unknown) {
      console.error("[AI COO Service] Lỗi xảy ra trong quá trình gọi hoặc parse dữ liệu Gemini:", geminiErr);
      executiveSummary = `⚠️ Lỗi hệ thống khi gọi Gemini: ${geminiErr instanceof Error ? geminiErr.message : String(geminiErr)}`;
    }
  }

  return {
    status: "success",
    timestamp: new Date().toISOString(),
    sender: "AI COO Agent (Trợ lý điều hành)",
    recipient: `CEO ${user.full_name}`,
    period: `Tháng ${activeDate.getMonth() + 1}/${activeDate.getFullYear()}`,
    routedAgent: routedTo,
    analysis: {
      executiveSummary,
      anomaliesFound,
      fullData: subAgentResponse.data ? (Array.isArray(subAgentResponse.data) ? subAgentResponse.data as unknown[] : [subAgentResponse.data]) : [],
      executiveDeepReport: subAgentResponse.executiveDeepReport
    },
    draftActions,
    strategicRecommendations
  };
}
