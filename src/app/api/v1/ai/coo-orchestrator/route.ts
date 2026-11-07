import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { runCOOOrchestrator } from "@/services/ai-coo-service";
import { canUseAiCopilotRole } from "@/lib/business-rules/permissions";
import { withTenantContext, type NextRequestWithContext } from "@/core/middleware/tenantContext";

// Cấu trúc yêu cầu của CEO
interface COORequest {
  command: string;      // Nội dung câu lệnh ngôn ngữ tự nhiên từ CEO
  branchId?: string;    // Chi nhánh cụ thể (nếu có, không thì lấy tenant mặc định của user)
  monthYear?: string;   // Định dạng 'YYYY-MM-DD' hoặc 'YYYY-MM' để phân tích kỳ báo cáo
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" && message ? message : "Lỗi hệ thống.";
  }
  return "Lỗi hệ thống.";
}

export const POST = withTenantContext(async (request: NextRequestWithContext) => {
  console.log("[AI COO Orchestrator] Nhận yêu cầu phân tích tại:", new Date().toISOString());

  try {
    // 1. Extract tenant context from middleware (already validated)
    const context = request.tenantContext;
    const tenantId = context.tenantId;

    // 2. Get authenticated user from Supabase session
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      console.error("[AI COO Orchestrator] Lỗi xác thực người dùng:", authError);
      return NextResponse.json({ error: "Yêu cầu đăng nhập để truy cập hệ thống AI." }, { status: 401 });
    }

    // 3. Fetch user profile for role and full_name (tenant_id already validated by middleware)
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, role, full_name")
      .eq("id", authUser.id)
      .single();

    if (userError || !userData) {
      console.error("[AI COO Orchestrator] Không tìm thấy hồ sơ người dùng trong hệ thống:", userError);
      return NextResponse.json({ error: "Tài khoản của bạn không tồn tại trong hệ thống Bella EIP." }, { status: 403 });
    }

    // 4. Validate user has permission to use AI COO
    if (!canUseAiCopilotRole(userData.role)) {
      console.warn(`[AI COO Orchestrator] Người dùng ${userData.full_name} với vai trò ${userData.role} bị từ chối truy cập.`);
      return NextResponse.json({ error: "Quyền hạn không hợp lệ. Chỉ có Ban điều hành (Admin/Super Admin), Quản lý dự án, KTS trưởng và Kế toán mới có quyền điều phối AI Copilot." }, { status: 403 });
    }

    // 5. Parse request body
    const body: COORequest = await request.json();
    const { command, monthYear } = body;

    if (!command || command.trim() === "") {
      return NextResponse.json({ error: "Vui lòng cung cấp câu lệnh phân tích cho AI." }, { status: 400 });
    }

    console.log(`[AI COO Orchestrator] CEO ${userData.full_name} gửi lệnh: "${command}"`);

    // 6. Call COO orchestrator with tenantId from context
    const executiveReport = await runCOOOrchestrator(
      supabase,
      command,
      tenantId,
      {
        id: userData.id,
        full_name: userData.full_name || "Admin",
        role: userData.role
      },
      monthYear
    );

    return NextResponse.json(executiveReport);

  } catch (error: unknown) {
    console.error("[AI COO Orchestrator] Lỗi ngoại lệ nghiêm trọng:", error);
    // Trả về lỗi rõ ràng để hệ thống kiểm thử tự động nhận diện lập tức
    return NextResponse.json(
      { error: "Đã xảy ra lỗi nghiêm trọng trong quá trình xử lý của AI Orchestrator.", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
});
