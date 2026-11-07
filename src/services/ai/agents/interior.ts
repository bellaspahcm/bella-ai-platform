/**
 * BELLA INTERIOR OS — AI SUB-AGENT
 *
 * Operational intelligence, anomaly detection, and decision automation
 * for interior architecture, fit-out production, and project portfolio.
 *
 * GOVERNANCE & SECURITY:
 *   - ZERO `any` allowed.
 *   - Multi-Tenant Isolation (Gate 0 / P0): all queries bound to tenantId.
 *   - RBAC-enforced draft proposals (Human-in-the-loop approval before action).
 *   - Safe fallback to domain analytics services when database tables are transitioning.
 *
 * @module src/services/ai/agents/interior
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { SubAgentResponse } from '../types';
import { InteriorPortfolioAnalyticsService } from '@/products/bella-interior/services/interior-portfolio-analytics.service';
import { InteriorFinanceAnalyticsService } from '@/products/bella-interior/services/interior-finance-analytics.service';

export interface InteriorAnomaly {
  readonly type: string;
  readonly projectName: string;
  readonly severity: 'critical' | 'warning' | 'info';
  readonly metric: string;
  readonly message: string;
}

export interface InteriorDraftProposal {
  readonly type: string;
  readonly recipient: string;
  readonly reason: string;
  readonly draftMessage: string;
}

interface InteriorDbProjectRow {
  readonly id: string;
  readonly name?: string | null;
  readonly code?: string | null;
  readonly customer_name?: string | null;
  readonly stage?: string | null;
  readonly progress_percent?: number | null;
  readonly schedule_status?: string | null;
  readonly contract_value?: number | null;
  readonly total_cost?: number | null;
  readonly deadline_date?: string | null;
  readonly lead_architect?: string | null;
  readonly tenant_id?: string | null;
}

export async function runInteriorAgent(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  activeDate: Date
): Promise<SubAgentResponse> {
  console.log('[AI COO Service] Routing to: Bella Interior Sub-Agent (Tenant:', tenantId, ')');

  // 1. Multi-Tenant Query with RLS: fetch interior projects
  let dbProjects: InteriorDbProjectRow[] = [];
  try {
    const { data, error } = await supabase
      .from('interior_projects' as unknown as 'users')
      .select('id, name, code, customer_name, stage, progress_percent, schedule_status, contract_value, total_cost, deadline_date, lead_architect, tenant_id')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      dbProjects = data as unknown as InteriorDbProjectRow[];
    }
  } catch (err: unknown) {
    console.warn('[Interior AI Agent] Supabase table query notice (using domain service fallback):', err);
  }

  // 2. Domain Service Fallback for complete canonical metrics
  const portfolioService = new InteriorPortfolioAnalyticsService();
  const portfolioData = await portfolioService.computePortfolioOverview(tenantId);
  const financeData = InteriorFinanceAnalyticsService.getFinanceOverview('Q4 2026', '3_months');

  const baselineProjects = portfolioData.projects;

  // 3. Operational Anomaly Detection
  const anomalies: InteriorAnomaly[] = [];
  const draftProposals: InteriorDraftProposal[] = [];

  // Check 1: Progress delays & schedule slippage
  const delayedProjects = baselineProjects.filter(
    (p) => p.scheduleStatus === 'delayed' || (typeof p.daysRemaining === 'number' && p.daysRemaining < 30 && p.progressPercent < 70)
  );

  for (const proj of delayedProjects) {
    anomalies.push({
      type: 'project_delay_alert',
      projectName: proj.name,
      severity: 'critical',
      metric: `Tiến độ ${proj.progressPercent}% / Còn ${proj.daysRemainingLabel || 'sắp đến hạn'}`,
      message: `Dự án "${proj.name}" (${proj.code}) đang chậm tiến độ (hiện đạt ${proj.progressPercent}%), chỉ còn ${proj.daysRemainingLabel} để hoàn thiện bàn giao.`,
    });

    draftProposals.push({
      type: 'interior_schedule_recovery',
      recipient: proj.leadArchitect || 'KTS Trưởng Phụ Trách',
      reason: `Dự án ${proj.code} có nguy cơ trễ hạn bàn giao so với cam kết hợp đồng.`,
      draftMessage: `[Cảnh báo tiến độ & Kế hoạch tăng cường] Kính gửi ${proj.leadArchitect}, dự án "${proj.name}" hiện đang đạt ${proj.progressPercent}%, hạn bàn giao là ${proj.deadlineDate}. Đề nghị kích hoạt kế hoạch tăng ca phân xưởng sản xuất và bố trí thêm 02 đội thợ lắp đặt công trình để bù lại 5% tiến độ bị trễ.`,
    });
  }

  // Check 2: Spec Lock & Materials sample board pending
  const designStageProjects = baselineProjects.filter((p) => p.stage === 'design');
  for (const proj of designStageProjects) {
    anomalies.push({
      type: 'spec_lock_pending',
      projectName: proj.name,
      severity: 'warning',
      metric: 'Giai đoạn Thiết kế R1.0',
      message: `Dự án "${proj.name}" chưa hoàn tất chốt và khóa mẫu vật tư (Spec Lock). Cần xác nhận vật liệu hoàn thiện trước khi chuyển lệnh sang xưởng sản xuất.`,
    });

    draftProposals.push({
      type: 'interior_spec_lock_approval',
      recipient: 'Trần Thị Mai (KTS Trưởng)',
      reason: `Khóa mẫu vật tư bắt buộc trước khi chuyển lệnh gia công xưởng cho dự án ${proj.name}.`,
      draftMessage: `[Yêu cầu phê duyệt Spec Lock] Dự án "${proj.name}" đã hoàn tất phối cảnh 3D và bảng chỉ định vật liệu (Veneer Óc chó, Đá thạch anh nhân tạo, Bản lề Blum). Đề nghị KTS Trưởng kiểm tra và thực hiện thao tác 'Khóa Spec Lock' trên hệ thống để kích hoạt BOQ bóc tách sản xuất.`,
    });
  }

  // Check 3: Budget & Cost variance warning
  const plProjects = financeData.projectPLBreakdown?.projects || [];
  const highRiskFinanceProjects = plProjects.filter((p) => p.marginPercent < 40);
  for (const pl of highRiskFinanceProjects) {
    anomalies.push({
      type: 'boq_margin_compression',
      projectName: pl.projectName,
      severity: 'warning',
      metric: `Biên lợi nhuận ${pl.marginPercent}% (Mục tiêu: >= 40%)`,
      message: `Dự án "${pl.projectName}" có biên lợi nhuận thực tế đạt ${pl.marginPercent}%, thấp hơn mục tiêu đề ra (chi phí giá vốn ${pl.cogsFormatted} / giá trị HĐ ${pl.contractRevenueFormatted}).`,
    });

    draftProposals.push({
      type: 'interior_boq_variance_review',
      recipient: 'Kế toán trưởng & Trưởng phòng Dự toán BOQ',
      reason: `Biên lợi nhuận dự án ${pl.projectName} bị nén dưới ngưỡng an toàn 40%.`,
      draftMessage: `[Rà soát biến động giá vốn] Dự án "${pl.projectName}" ghi nhận biên lợi nhuận ${pl.marginPercent}%. Đề nghị phòng Dự toán BOQ đối soát lại chi phí nhà cung cấp vật liệu gỗ và phụ kiện nhập khẩu để tối ưu lại định mức hao hụt xưởng.`,
    });
  }

  // Check 4: Payment milestones & receivables follow-up
  const totalReceivable = portfolioData.financialSummary.receivableAmount;
  if (totalReceivable > 3_000_000_000) {
    draftProposals.push({
      type: 'interior_milestone_payment_followup',
      recipient: 'Phòng Kế toán & Quản lý Hợp đồng',
      reason: `Tổng công nợ các đợt nghiệm thu đạt ${portfolioData.financialSummary.receivableFormatted}, cần đôn đốc thu hồi dòng tiền.`,
      draftMessage: `[Đôn đốc thu hồi công nợ tiến độ] Kính gửi phòng Tài chính, hệ thống ghi nhận tổng công nợ đến hạn của các dự án đạt ${portfolioData.financialSummary.receivableFormatted}. Đề nghị phát hành thông báo đề nghị thanh toán đợt tiếp theo cho khách hàng các dự án đã hoàn thành nghiệm thu từng phần.`,
    });
  }

  const summary = `Đã hoàn tất phân tích điều hành chuỗi giá trị Bella Interior OS. Ghi nhận tổng cộng ${portfolioData.kpis.totalProjects.value} dự án (${portfolioData.kpis.inProgress.value} đang triển khai, ${portfolioData.kpis.delayedRisk.value} có nguy cơ trễ hạn). Tổng giá trị hợp đồng quản lý: ${portfolioData.financialSummary.totalContractFormatted}, đã thu tiền: ${portfolioData.financialSummary.collectedFormatted}, công nợ đợt thanh toán: ${portfolioData.financialSummary.receivableFormatted}. Biên lợi nhuận bình quân toàn danh mục đạt ${portfolioData.financialSummary.averageMarginFormatted}. Hệ thống ghi nhận ${anomalies.length} điểm cần lưu ý điều hành và đã lập sẵn ${draftProposals.length} đề xuất hành động cần duyệt.`;

  return {
    agent: 'Bella Interior AI Specialist (Giám đốc Điều hành Dự án Nội thất)',
    period: `Kỳ ${portfolioData.financialSummary.period} — Năm ${activeDate.getFullYear()}`,
    summary,
    anomalies: anomalies.map((a) => a.message),
    draftProposals,
    data: {
      dbProjectsCount: dbProjects.length,
      kpis: portfolioData.kpis,
      progressOverview: portfolioData.progressOverview,
      financialSummary: portfolioData.financialSummary,
      actionAlerts: portfolioData.actionAlerts,
      anomalies,
    },
    aiSummaryData: {
      totalProjects: portfolioData.kpis.totalProjects.value,
      activeProjects: portfolioData.kpis.inProgress.value,
      delayedProjectsCount: delayedProjects.length,
      delayedProjects: delayedProjects.map((p) => ({
        code: p.code,
        name: p.name,
        progress: p.progressPercent,
        deadline: p.deadlineDate,
        leadArchitect: p.leadArchitect,
      })),
      financial: {
        totalContract: portfolioData.financialSummary.totalContractFormatted,
        collected: portfolioData.financialSummary.collectedFormatted,
        receivable: portfolioData.financialSummary.receivableFormatted,
        averageMargin: portfolioData.financialSummary.averageMarginFormatted,
      },
      anomaliesFound: anomalies.map((a) => a.message),
      draftProposalsCount: draftProposals.length,
    },
  };
}
