import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database.types";
import { canUseAiCopilotRole } from "@/lib/business-rules/permissions";
import { withTenantContext, type NextRequestWithContext } from "@/core/middleware/tenantContext";

type AppNotificationInsert = Database["public"]["Tables"]["app_notifications"]["Insert"];
type AIAgentLogInsert = Database["public"]["Tables"]["ai_agent_logs"]["Insert"];

interface ApprovalRequest {
  type: string;
  recipient: string;
  reason: string;
  draftMessage: string;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" && message ? message : "Lỗi hệ thống.";
  }
  return "Lỗi hệ thống.";
}

function appendRollbackError(message: string, rollbackError?: string) {
  return rollbackError ? `${message}; rollback failed: ${rollbackError}` : message;
}

function getActionNotificationTitle(type: string): string {
  if (type === "attendance_warning") return "Phê duyệt từ CEO: Giải trình chấm công KTV";
  if (type === "inventory_restock") return "Phê duyệt từ CEO: Lệnh nhập kho vật tư bổ sung";
  if (type === "customer_apology") return "Phê duyệt từ CEO: Xử lý phản hồi khiếu nại khách hàng";
  if (type === "royalty_payment_reminder") return "Phê duyệt từ CEO: Đôn đốc phí nhượng quyền";
  if (type === "real_estate_release_next_block") return "Phê duyệt từ Ban Giám Đốc: Mở bán phân khu BĐS tiếp theo";
  if (type === "interior_spec_lock_approval") return "Phê duyệt từ Ban Điều Hành: Xác nhận khóa mẫu Spec Lock vật liệu";
  if (type === "interior_boq_variance_review") return "Phê duyệt từ Ban Điều Hành: Rà soát điều chỉnh dự toán BOQ";
  if (type === "interior_schedule_recovery") return "Phê duyệt từ Ban Điều Hành: Kích hoạt kế hoạch bù tiến độ công trình";
  if (type === "interior_milestone_payment_followup") return "Phê duyệt từ Ban Điều Hành: Đôn đốc thu hồi công nợ nghiệm thu";
  return `Phê duyệt từ Ban Điều Hành: Hành động điều phối ${type}`;
}

export const POST = withTenantContext(async (request: NextRequestWithContext) => {
  console.log("[AI Action Approval] Nhận yêu cầu duyệt hành động nháp...");

  try {
    // 1. Extract tenant context from middleware (already validated)
    const context = request.tenantContext;
    const tenantId = context.tenantId;

    // 2. Get authenticated user from Supabase session
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      console.error("[AI Action Approval] Lỗi xác thực người dùng:", authError);
      return NextResponse.json({ error: "Yêu cầu đăng nhập để truy cập tính năng phê duyệt." }, { status: 401 });
    }

    // 3. Fetch user profile for role and full_name (tenant_id already validated by middleware)
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, role, full_name")
      .eq("id", authUser.id)
      .single();

    if (userError || !userData) {
      console.error("[AI Action Approval] Không tìm thấy hồ sơ người dùng:", userError);
      return NextResponse.json({ error: "Tài khoản của bạn không tồn tại trên hệ thống." }, { status: 403 });
    }

    // 4. Validate user has permission to approve AI actions
    if (!canUseAiCopilotRole(userData.role)) {
      console.warn(`[AI Action Approval] Người dùng ${userData.full_name} với vai trò ${userData.role} bị từ chối phê duyệt.`);
      return NextResponse.json({ error: "Quyền hạn không hợp lệ. Chỉ có Ban điều hành (Admin/Super Admin), Quản lý dự án, KTS trưởng và Kế toán mới có quyền phê duyệt hành động của AI." }, { status: 403 });
    }

    // 5. Parse request body
    const body: ApprovalRequest = await request.json();
    const { type, recipient, reason, draftMessage } = body;

    if (!type || !recipient || !reason || !draftMessage) {
      return NextResponse.json({ error: "Vui lòng cung cấp đầy đủ thông tin hành động nháp." }, { status: 400 });
    }

    console.log(`[AI Action Approval] CEO ${userData.full_name} phê duyệt hành động: "${type}" cho "${recipient}"`);

    // 6. Insert notification using tenantId from context
    const notificationPayload: AppNotificationInsert = {
      tenant_id: tenantId,
      type: type,
      title: getActionNotificationTitle(type),
      message: draftMessage,
      data: {
        recipient: recipient,
        reason: reason,
        approved_by: userData.full_name
      },
      is_read: false
    };

    const { data: notif, error: notifError } = await supabase
      .from("app_notifications")
      .insert(notificationPayload)
      .select("id")
      .single();

    if (notifError) {
      console.error("[AI Action Approval] Lỗi khi tạo thông báo hệ thống:", notifError);
      throw notifError; // Zero Silent DB Failures
    }

    // 7. Insert audit log using tenantId from context
    const logPayload: AIAgentLogInsert = {
      tenant_id: tenantId,
      user_id: userData.id,
      sender: "ceo",
      message: `CEO ${userData.full_name} chính thức phê duyệt hành động nháp "${type}" cho "${recipient}". Lý do: ${reason}`,
      metadata: {
        action_type: type,
        recipient: recipient,
        notification_id: notif.id,
        reason: reason
      }
    };

    const { error: logError } = await supabase
      .from("ai_agent_logs")
      .insert(logPayload);

    if (logError) {
      console.error("[AI Action Approval] Lỗi khi ghi audit log:", logError);
      const { error: rollbackError } = await supabase
        .from("app_notifications")
        .delete()
        .eq("id", notif.id)
        .eq("tenant_id", tenantId);

      throw new Error(appendRollbackError(logError.message, rollbackError?.message));
    }

    return NextResponse.json({
      success: true,
      message: "Hành động đã được phê duyệt và gửi đi thành công.",
      notificationId: notif.id
    });

  } catch (error: unknown) {
    console.error("[AI Action Approval] Lỗi ngoại lệ nghiêm trọng:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi nghiêm trọng khi xử lý phê duyệt hành động.", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
});
