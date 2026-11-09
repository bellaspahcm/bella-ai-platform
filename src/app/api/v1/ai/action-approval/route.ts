import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database.types";
import { canUseAiCopilotRole } from "@/lib/business-rules/permissions";
import { withTenantContext, type NextRequestWithContext } from "@/core/middleware/tenantContext";
import { SupabasePlatformActionAuthorization } from "@/platform/authorization";
import type { SupabaseClient } from "@supabase/supabase-js";

type AppNotificationInsert = Database["public"]["Tables"]["app_notifications"]["Insert"];
type AIAgentLogInsert = Database["public"]["Tables"]["ai_agent_logs"]["Insert"];

interface ApprovalRequest {
  type: string;
  recipient: string;
  reason: string;
  draftMessage: string;
}

const INTERIOR_ACTION_PERMISSIONS: Readonly<Record<string, string>> = {
  interior_sales_followup: 'interior:contract:write',
  interior_commercial_upsell: 'interior:contract:write',
  interior_spec_lock_approval: 'interior:design:approve',
  interior_workshop_production_order: 'interior:production:write',
  interior_material_replenish: 'interior:production:write',
  interior_schedule_recovery: 'interior:schedule:write',
  interior_site_team_dispatch: 'interior:installation:write',
  interior_architect_rebalance: 'interior:design:write',
  interior_workshop_recruitment: 'interior:production:write',
  interior_boq_variance_review: 'interior:boq:write',
  interior_milestone_payment_followup: 'interior:finance:write',
  interior_executive_action: 'interior:executive:approve',
};

const LEGACY_ACTION_TYPES = new Set([
  'attendance_warning',
  'inventory_restock',
  'customer_apology',
  'royalty_payment_reminder',
  'real_estate_release_next_block',
]);

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
  // Bella Interior OS Executive Actions
  if (type === "interior_sales_followup") return "Phê duyệt Kinh doanh: Đôn đốc ký Hợp đồng thi công trọn gói";
  if (type === "interior_commercial_upsell") return "Phê duyệt Kinh doanh: Đề xuất gói vật tư & đồ rời cao cấp";
  if (type === "interior_spec_lock_approval") return "Phê duyệt Sản xuất: Xác nhận khóa mẫu Spec Lock vật liệu";
  if (type === "interior_workshop_production_order") return "Phê duyệt Sản xuất: Lệnh tăng ca Phân xưởng gia công CNC";
  if (type === "interior_material_replenish") return "Phê duyệt Sản xuất: Đặt mua bổ sung phôi gỗ và phụ kiện";
  if (type === "interior_schedule_recovery") return "Phê duyệt Vận hành: Kích hoạt kế hoạch bù tiến độ công trình";
  if (type === "interior_site_team_dispatch") return "Phê duyệt Vận hành: Điều động đội thợ lắp đặt hiện trường";
  if (type === "interior_architect_rebalance") return "Phê duyệt Nhân sự: Tái phân bổ tải công việc KTS thiết kế";
  if (type === "interior_workshop_recruitment") return "Phê duyệt Nhân sự: Tuyển dụng bổ sung thợ hoàn thiện xưởng";
  if (type === "interior_boq_variance_review") return "Phê duyệt Tài chính: Rà soát điều chỉnh dự toán BOQ";
  if (type === "interior_milestone_payment_followup") return "Phê duyệt Tài chính: Đôn đốc thu hồi công nợ nghiệm thu";
  if (type === "interior_executive_action") return "Phê duyệt Quản trị: Nghị quyết điều hành toàn diện chuỗi giá trị";
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

    // 4. Parse and validate the approved action type before authorization.
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
    }
    const { type, recipient, reason, draftMessage } = body as Partial<ApprovalRequest>;
    if (typeof type !== 'string' || typeof recipient !== 'string' || typeof reason !== 'string' || typeof draftMessage !== 'string'
      || !recipient.trim() || !reason.trim() || !draftMessage.trim()
      || recipient.length > 500 || reason.length > 2000 || draftMessage.length > 5000) {
      return NextResponse.json({ error: "Vui lòng cung cấp đầy đủ thông tin hành động nháp." }, { status: 400 });
    }
    const interiorPermission = INTERIOR_ACTION_PERMISSIONS[type];
    if (interiorPermission) {
      const authorization = new SupabasePlatformActionAuthorization(supabase as unknown as SupabaseClient<Database>);
      const decision = await authorization.authorize({ permissionId: interiorPermission, tenantId });
      if (decision.status === 'DENY') {
        return NextResponse.json({ error: "Không có quyền phê duyệt hành động Interior này." }, { status: 403 });
      }
      if (decision.status === 'UNAVAILABLE') {
        return NextResponse.json({ error: "Không thể xác thực quyền phê duyệt Interior." }, { status: 503 });
      }
    } else if (LEGACY_ACTION_TYPES.has(type)) {
      if (!canUseAiCopilotRole(userData.role)) {
        return NextResponse.json({ error: "Quyền hạn không hợp lệ để phê duyệt hành động này." }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: "Loại hành động không được hỗ trợ." }, { status: 400 });
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
      sender: "user",
      message: `${userData.full_name} đã phê duyệt hành động nháp "${type}" cho "${recipient}". Lý do: ${reason}`,
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
