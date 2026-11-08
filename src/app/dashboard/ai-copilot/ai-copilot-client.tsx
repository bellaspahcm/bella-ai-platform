'use client';

import {
  Activity,
  AlertCircle,
  Banknote,
  BookOpen,
  Bot,
  Brain,
  CheckCircle,
  ChevronRight,
  Lightbulb,
  Loader2,
  Receipt,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  XCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast, Toaster } from 'sonner';

import { useTenantModuleKey } from '@/hooks/useTenantModuleKey';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';
import { useUser } from '@/lib/user-context';

export interface ExecutiveKpi {
  readonly label: string;
  readonly value: string;
  readonly trend: string;
  readonly isPositive: boolean;
  readonly iconType: 'cash' | 'receivable' | 'payable' | 'rate';
}

export interface TableRowBreakdown {
  readonly label: string;
  readonly amount: string;
  readonly percent: string;
  readonly isHighlight?: boolean;
}

export interface TableRowReceivable {
  readonly client: string;
  readonly amount: string;
  readonly overdue: string;
  readonly overdueSeverity: 'critical' | 'warning' | 'normal' | 'none';
}

export interface TableRowPayable {
  readonly vendor: string;
  readonly amount: string;
  readonly dueIn: string;
}

export interface ExecutiveDeepReportData {
  readonly title: string;
  readonly subtitle: string;
  readonly intro: string;
  readonly kpis: readonly ExecutiveKpi[];
  readonly breakdownTable: {
    readonly title: string;
    readonly headers: readonly string[];
    readonly rows: readonly TableRowBreakdown[];
  };
  readonly receivablesTable: {
    readonly title: string;
    readonly headers: readonly string[];
    readonly rows: readonly TableRowReceivable[];
  };
  readonly payablesTable: {
    readonly title: string;
    readonly headers: readonly string[];
    readonly rows: readonly TableRowPayable[];
  };
  readonly riskAnalysis: {
    readonly title: string;
    readonly items: readonly string[];
  };
  readonly solutions: {
    readonly title: string;
    readonly items: readonly string[];
  };
  readonly rightWidgets?: {
    readonly priorityAction: {
      readonly title: string;
      readonly message: string;
      readonly targetRecipient: string;
      readonly actionType: string;
    };
    readonly trendChart: {
      readonly title: string;
      readonly labels: readonly string[];
      readonly thuPoints: readonly number[];
      readonly chiPoints: readonly number[];
    };
    readonly recoveryGauge: {
      readonly title: string;
      readonly ratePercent: number;
      readonly subtext: string;
    };
    readonly aiAdviceQuote: {
      readonly quote: string;
      readonly author: string;
    };
  };
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  report?: AiReport;
}

interface AiReport {
  status?: string;
  error?: string;
  analysis?: {
    executiveSummary?: string;
    executiveDeepReport?: ExecutiveDeepReportData;
  };
  strategicRecommendations?: string[];
  draftActions?: DraftAction[];
}

interface DraftAction {
  type: string;
  recipient: string;
  reason: string;
  draftMessage: string;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getAiWelcomeMessage(moduleKey: TenantModuleKey | null, productKey?: string | null) {
  if (productKey === 'bella_haircut') {
    return 'Xin chào Ban điều hành! Tôi là AI COO - trợ lý vận hành cho Bella Haircut Shop. Tôi có thể hỗ trợ theo dõi lịch hẹn cắt tóc, hồ sơ khách hàng, doanh thu, chấm công & lương stylist/KTV, CRM/Zalo, Meta Ads và các điểm bất thường cần xử lý trong ngày. Anh/chị cần tôi kiểm tra mảng nào hôm nay?';
  }

  if (productKey === 'bella_interior' || moduleKey === 'bella_interior') {
    return 'Xin chào Ban điều hành và Đội ngũ Dự án! Tôi là AI COO - trợ lý vận hành cho Bella Interior OS. Tôi có thể hỗ trợ kiểm tra tiến độ dự án, khóa mẫu vật tư (Spec Lock), dự toán BOQ và giá vốn, kế hoạch công trình, cảnh báo tiến độ xưởng sản xuất, lịch thi công lắp đặt và thu hồi công nợ các đợt thanh toán. Anh/chị cần tôi kiểm tra mảng nào hôm nay?';
  }

  if (moduleKey === 'real_estate') {
    return 'Xin chào Ban điều hành! Tôi là AI COO - trợ lý vận hành cho Bella Land. Tôi có thể hỗ trợ kiểm tra giỏ hàng căn hộ, tiến độ hợp đồng cọc, doanh thu dự án, tính hoa hồng môi giới, CRM nhà đầu tư và các báo cáo phân tích bất động sản trong ngày. Anh/chị cần tôi kiểm tra mảng nào hôm nay?';
  }

  if (moduleKey === 'industrial_cleaning') {
    return 'Xin chào Ban điều hành! Tôi là AI COO - trợ lý vận hành cho CleanPro. Tôi có thể hỗ trợ theo dõi lịch làm việc, hồ sơ khách hàng doanh nghiệp, doanh thu, chấm công & lương nhân viên vệ sinh, CRM/Zalo và các điểm bất thường cần xử lý trong ngày. Anh/chị cần tôi kiểm tra mảng nào hôm nay?';
  }

  if (moduleKey === 'beauty_spa') {
    return 'Xin chào Ban điều hành! Tôi là AI COO - trợ lý vận hành cho Beauty Spa. Tôi có thể hỗ trợ theo dõi lịch dịch vụ, hồ sơ khách hàng, doanh thu, chấm công & lương KTV, CRM/Zalo, Meta Ads và các điểm bất thường cần xử lý trong ngày. Anh/chị cần tôi kiểm tra mảng nào hôm nay?';
  }

  if (moduleKey === 'babycare') {
    return 'Xin chào Ban điều hành! Tôi là AI COO - trợ lý vận hành cho Bella Spa. Tôi có thể hỗ trợ phân tích tài chính, lịch chăm sóc, chấm công & lương KTV, đối soát dòng tiền, CRM/Zalo và các quyết định cải tiến trong ngày. Anh/chị cần tôi kiểm tra mảng nào hôm nay?';
  }

  return 'Xin chào Ban điều hành! Tôi là AI COO - trợ lý vận hành của hệ thống. Tôi có thể hỗ trợ phân tích lịch dịch vụ, hồ sơ khách hàng, tài chính, nhân sự, CRM/Zalo và các điểm bất thường cần xử lý. Anh/chị cần tôi kiểm tra mảng nào hôm nay?';
}

function getPlaceholderText(moduleKey: TenantModuleKey | null) {
  if (moduleKey === 'bella_interior') {
    return "Nhập yêu cầu (ví dụ: 'Kiểm tra dự án trễ hạn', 'Cảnh báo vượt ngân sách BOQ', 'Khóa vật tư Spec Lock'...)";
  }
  if (moduleKey === 'real_estate') {
    return "Nhập yêu cầu (ví dụ: 'Kiểm tra căn hộ trống', 'Tính hoa hồng dự án'...)";
  }
  if (moduleKey === 'industrial_cleaning') {
    return "Nhập yêu cầu (ví dụ: 'Xem phiếu công việc', 'Tính công nhân viên'...)";
  }
  return "Nhập yêu cầu (ví dụ: 'Đối soát quỹ', 'Tính lương KTV Hoa'...)";
}

function getActionBadgeLabel(type: string): { label: string; className: string } {
  if (type === 'attendance_warning') {
    return { label: 'Nhân sự • Kỷ luật', className: 'bg-pink-500/10 text-pink-500 border border-pink-500/20' };
  }
  if (type === 'inventory_restock') {
    return { label: 'Kho vận • Vật tư', className: 'bg-amber-500/10 text-amber-500 border border-amber-500/20' };
  }
  if (type === 'customer_apology') {
    return { label: 'CRM • Khách hàng', className: 'bg-rose-500/10 text-rose-500 border border-rose-500/20' };
  }
  if (type === 'interior_sales_followup') {
    return { label: 'Kinh doanh • Chốt HĐ', className: 'bg-blue-500/10 text-blue-500 border border-blue-500/20' };
  }
  if (type === 'interior_commercial_upsell') {
    return { label: 'Kinh doanh • Upsell', className: 'bg-sky-500/10 text-sky-500 border border-sky-500/20' };
  }
  if (type === 'interior_spec_lock_approval') {
    return { label: 'Sản xuất • Spec Lock', className: 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' };
  }
  if (type === 'interior_workshop_production_order') {
    return { label: 'Sản xuất • Lệnh xưởng', className: 'bg-amber-500/10 text-amber-500 border border-amber-500/20' };
  }
  if (type === 'interior_material_replenish') {
    return { label: 'Sản xuất • Đặt vật tư', className: 'bg-orange-500/10 text-orange-500 border border-orange-500/20' };
  }
  if (type === 'interior_schedule_recovery') {
    return { label: 'Vận hành • Bù tiến độ', className: 'bg-red-500/10 text-red-500 border border-red-500/20' };
  }
  if (type === 'interior_site_team_dispatch') {
    return { label: 'Vận hành • Đội thợ', className: 'bg-rose-500/10 text-rose-500 border border-rose-500/20' };
  }
  if (type === 'interior_architect_rebalance') {
    return { label: 'Nhân sự • Tải KTS', className: 'bg-pink-500/10 text-pink-500 border border-pink-500/20' };
  }
  if (type === 'interior_workshop_recruitment') {
    return { label: 'Nhân sự • Tuyển thợ', className: 'bg-fuchsia-500/10 text-fuchsia-500 border border-fuchsia-500/20' };
  }
  if (type === 'interior_boq_variance_review') {
    return { label: 'Tài chính • Dự toán BOQ', className: 'bg-purple-500/10 text-purple-500 border border-purple-500/20' };
  }
  if (type === 'interior_milestone_payment_followup') {
    return { label: 'Tài chính • Thu công nợ', className: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' };
  }
  if (type === 'interior_executive_action') {
    return { label: 'Quản trị • Toàn diện', className: 'bg-teal-500/10 text-teal-500 border border-teal-500/20' };
  }
  return { label: 'Kế toán • Đối soát', className: 'bg-cyan-500/10 text-cyan-600 border border-cyan-500/20' };
}

const INTERIOR_DIRECTORS = [
  { id: 'all', label: 'Tất cả / Cố vấn Quản trị', icon: '🎯', badge: 'Advisor' },
  { id: 'cco', label: 'AI GĐ Kinh doanh', icon: '📈', badge: 'CCO' },
  { id: 'cpo', label: 'AI GĐ Sản xuất & Xưởng', icon: '🏭', badge: 'CPO' },
  { id: 'coo', label: 'AI GĐ Vận hành & Thi công', icon: '🏗️', badge: 'COO' },
  { id: 'chro', label: 'AI GĐ Nhân sự & Năng suất', icon: '👥', badge: 'CHRO' },
  { id: 'cfo', label: 'AI GĐ Tài chính - Kế toán', icon: '💰', badge: 'CFO' },
] as const;

const INTERIOR_DIRECTOR_PILLS: Record<string, string[]> = {
  all: [
    'Bức tranh toàn cảnh toàn doanh nghiệp',
    'Đánh giá rủi ro chéo chuỗi giá trị',
    'Kiểm tra điểm nghẽn các dự án trọng điểm',
    'Khuyến nghị chiến lược cho Ban Giám Đốc',
  ],
  cco: [
    'Đôn đốc chốt hợp đồng thi công sau thiết kế',
    'Phân tích deal size và cơ cấu phân khúc',
    'Đề xuất gói vật tư và đồ rời cao cấp',
    'Tỷ lệ chuyển đổi chốt thầu tháng này',
  ],
  cpo: [
    'Kiểm tra vật tư chưa khóa Spec Lock',
    'Kế hoạch tăng ca xưởng máy CNC',
    'Dự trù ván MDF An Cường và phụ kiện Blum',
    'Tỷ lệ hao hụt phôi gỗ tại phân xưởng',
  ],
  coo: [
    'Kiểm tra các dự án trễ hạn bàn giao',
    'Kế hoạch bù 5% tiến độ công trình',
    'Điều động đội thợ lắp đặt hiện trường',
    'Xung đột mặt bằng và kiểm soát KCS',
  ],
  chro: [
    'Đánh giá tải công việc các KTS chủ trì',
    'Năng suất triển khai hồ sơ bản vẽ 3D/2D',
    'Kế hoạch tuyển thợ hoàn thiện cho xưởng',
    'Cân đối KTS phụ tá hỗ trợ công trình chậm',
  ],
  cfo: [
    'Dự báo dòng tiền và công nợ',
    'Cảnh báo dự án biên lợi nhuận BOQ dưới 40%',
    'Đôn đốc thu hồi công nợ các đợt nghiệm thu',
    'Phân tích P&L và cơ cấu giá vốn COGS',
  ],
};

export default function AICopilotClient() {
  const { tenantModuleKey } = useTenantModuleKey();
  const { product } = useUser();
  const productKey = product?.productKey;
  const isInterior = productKey === 'bella_interior' || tenantModuleKey === 'bella_interior';

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: getAiWelcomeMessage(null),
    },
  ]);
  const [input, setInput] = useState('');
  const [selectedDirector, setSelectedDirector] = useState<string>('cfo');
  const [isLoading, setIsLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvedActions, setApprovedActions] = useState<Record<string, boolean>>({});

  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  useEffect(() => {
    setMessages((current) => {
      if (current.length !== 1 || current[0]?.role !== 'assistant') return current;
      return [{ ...current[0], content: getAiWelcomeMessage(tenantModuleKey, productKey) }];
    });
  }, [tenantModuleKey, productKey]);

  // Extract latest deep report if available
  const latestDeepReport = [...messages]
    .reverse()
    .find((m) => m.report?.analysis?.executiveDeepReport)?.report?.analysis?.executiveDeepReport;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/v1/ai/coo-orchestrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: userMessage }),
      });

      const data = (await response.json()) as AiReport;

      if (!response.ok) {
        throw new Error(data.error || 'Lỗi xử lý của AI Orchestrator');
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.analysis?.executiveSummary || 'AI COPILOT đã hoàn tất phân tích số liệu điều hành.',
          report: data,
        },
      ]);
      toast.success('AI COPILOT đã hoàn tất báo cáo phân tích chuyên sâu!');
    } catch (error: unknown) {
      console.error('Lỗi gọi AI COO:', error);
      const message = getErrorMessage(error, 'Không thể phân tích yêu cầu.');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Đã xảy ra lỗi: ${message}. Vui lòng thử lại hoặc liên hệ bộ phận kỹ thuật.`,
        },
      ]);
      toast.error(`Lỗi phân tích: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (action: DraftAction, actionKey: string) => {
    if (approvingId === actionKey) return;

    setApprovingId(actionKey);
    const toastId = toast.loading(`Đang phê duyệt hành động cho ${action.recipient}...`);

    try {
      const response = await fetch('/api/v1/ai/action-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Lỗi từ chối phê duyệt từ hệ thống');
      }

      setApprovedActions((prev) => ({ ...prev, [actionKey]: true }));
      toast.success(`Đã duyệt hành động cho ${action.recipient}! Thông báo đã được gửi.`, { id: toastId });
    } catch (error: unknown) {
      console.error('Lỗi duyệt action:', error);
      toast.error(`Phê duyệt thất bại: ${getErrorMessage(error, 'Không thể phê duyệt hành động.')}`, { id: toastId });
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = (action: DraftAction, actionKey: string) => {
    toast.info(`Đã từ chối bản nháp đề xuất của ${action.recipient}`);
    setApprovedActions((prev) => ({ ...prev, [actionKey]: false }));
  };

  return (
    <div className="flex-1 min-h-[calc(100vh-4rem)] lg:h-screen lg:max-h-screen flex flex-col overflow-y-auto lg:overflow-hidden relative bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Toaster position="top-right" richColors />

      {/* Header Bar */}
      <header className="relative shrink-0 z-10 px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight uppercase">
              AI COO COPILOT
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
              Mức A • Trợ lý điều hành chi nhánh
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-3 py-1 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-widest">
            RLS Secured Tenant
          </span>
        </div>
      </header>

      {/* Main Board */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-visible lg:overflow-hidden relative z-10 p-3 sm:p-5 pb-0 lg:pb-0 gap-4 min-h-0">
        {/* Chat Area (Left 3/5) */}
        <div className="flex min-h-[34rem] flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs lg:flex-1 lg:min-h-0">
          {/* Scrollable messages */}
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
            {messages.map((msg, index) => {
              const deepReport = msg.report?.analysis?.executiveDeepReport;

              return (
                <div
                  key={index}
                  className={`flex gap-3 sm:gap-4 max-w-[96%] sm:max-w-[90%] ${
                    msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center shadow-xs font-black text-xs ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-900 dark:bg-slate-800 text-amber-500 border border-slate-700'
                    }`}
                  >
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : 'B'}
                  </div>

                  <div className="min-w-0 flex-1 space-y-4">
                    {/* User Text Bubble */}
                    {msg.role === 'user' && (
                      <div className="bg-blue-600 text-white rounded-2xl rounded-tr-xs p-4 text-sm leading-relaxed shadow-xs font-medium">
                        {msg.content}
                      </div>
                    )}

                    {/* Standard Welcome or simple Text Message */}
                    {msg.role === 'assistant' && !deepReport && (
                      <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl rounded-tl-xs p-4 sm:p-5 text-sm leading-relaxed text-slate-800 dark:text-slate-200 shadow-2xs font-normal">
                        {msg.content}
                      </div>
                    )}

                    {/* Deep Executive Visual Report Card */}
                    {msg.role === 'assistant' && deepReport && (
                      <div className="bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-6 text-slate-900 dark:text-slate-100">
                        {/* Report Header */}
                        <div className="space-y-1">
                          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                            {deepReport.title}
                          </h3>
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {deepReport.subtitle}
                          </p>
                          <p className="text-xs text-slate-700 dark:text-slate-300 pt-2 leading-relaxed">
                            {deepReport.intro}
                          </p>
                        </div>

                        {/* 1. Tóm tắt tổng quan (4 KPI Cards) */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                            1. Tóm tắt tổng quan
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                            {deepReport.kpis.map((kpi, kIdx) => (
                              <div
                                key={kIdx}
                                className="bg-slate-50/80 dark:bg-slate-800/60 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex items-start justify-between"
                              >
                                <div className="space-y-1">
                                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                                    {kpi.label}
                                  </span>
                                  <span
                                    className={`text-base sm:text-lg font-black tracking-tight block ${
                                      kpi.iconType === 'cash'
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-slate-900 dark:text-white'
                                    }`}
                                  >
                                    {kpi.value}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold block ${
                                      kpi.isPositive
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-slate-500 dark:text-slate-400'
                                    }`}
                                  >
                                    {kpi.trend}
                                  </span>
                                </div>
                                <div
                                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                    kpi.iconType === 'cash'
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                      : kpi.iconType === 'receivable'
                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                      : kpi.iconType === 'payable'
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                      : 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                                  }`}
                                >
                                  {kpi.iconType === 'cash' && <Banknote className="w-4 h-4" />}
                                  {kpi.iconType === 'receivable' && <BookOpen className="w-4 h-4" />}
                                  {kpi.iconType === 'payable' && <Receipt className="w-4 h-4" />}
                                  {kpi.iconType === 'rate' && <Activity className="w-4 h-4" />}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 2. Phân tích chi tiết (3 Tables) */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                            2. Phân tích chi tiết
                          </h4>
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
                            {/* Table 1: Nguồn thu / Chi */}
                            <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 p-3 sm:p-4 flex flex-col justify-between">
                              <table className="w-full text-left text-[11px]">
                                <thead>
                                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold">
                                    {deepReport.breakdownTable.headers.map((h, i) => (
                                      <th key={i} className={`pb-2 ${i > 0 ? 'text-right' : ''}`}>
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                  {deepReport.breakdownTable.rows.map((row, rIdx) => (
                                    <tr
                                      key={rIdx}
                                      className={
                                        row.isHighlight
                                          ? 'bg-emerald-50 dark:bg-emerald-950/40 font-black text-emerald-700 dark:text-emerald-400'
                                          : 'text-slate-700 dark:text-slate-300 font-medium'
                                      }
                                    >
                                      <td className="py-2 pr-1">{row.label}</td>
                                      <td className="py-2 text-right pr-2 font-mono">{row.amount}</td>
                                      <td className="py-2 text-right font-mono">{row.percent}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Table 2: Công nợ phải thu */}
                            <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 p-3 sm:p-4 flex flex-col justify-between">
                              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-2">
                                2.2 Công nợ phải thu (Top 5)
                              </div>
                              <table className="w-full text-left text-[11px]">
                                <thead>
                                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold">
                                    {deepReport.receivablesTable.headers.map((h, i) => (
                                      <th key={i} className={`pb-2 ${i > 0 ? 'text-right' : ''}`}>
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                  {deepReport.receivablesTable.rows.map((row, rIdx) => (
                                    <tr key={rIdx} className="text-slate-700 dark:text-slate-300 font-medium">
                                      <td className="py-2 pr-1">{row.client}</td>
                                      <td className="py-2 text-right pr-2 font-mono">{row.amount}</td>
                                      <td className="py-2 text-right">
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                            row.overdueSeverity === 'critical'
                                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                                              : row.overdueSeverity === 'warning'
                                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                                              : row.overdueSeverity === 'normal'
                                              ? 'text-slate-600 dark:text-slate-400'
                                              : 'text-slate-400'
                                          }`}
                                        >
                                          {row.overdue}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Table 3: Công nợ phải trả */}
                            <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 p-3 sm:p-4 flex flex-col justify-between">
                              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-2">
                                2.3 Công nợ phải trả (Top 5)
                              </div>
                              <table className="w-full text-left text-[11px]">
                                <thead>
                                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold">
                                    {deepReport.payablesTable.headers.map((h, i) => (
                                      <th key={i} className={`pb-2 ${i > 0 ? 'text-right' : ''}`}>
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                  {deepReport.payablesTable.rows.map((row, rIdx) => (
                                    <tr key={rIdx} className="text-slate-700 dark:text-slate-300 font-medium">
                                      <td className="py-2 pr-1">{row.vendor}</td>
                                      <td className="py-2 text-right pr-2 font-mono">{row.amount}</td>
                                      <td className="py-2 text-right">
                                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                                          {row.dueIn}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>

                        {/* 3 & 4. Nhận định rủi ro & Đề xuất giải pháp */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Card 3: Nhận định và rủi ro */}
                          <div className="bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 rounded-2xl p-4 sm:p-5 space-y-2.5">
                            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-black text-xs uppercase tracking-wider">
                              <AlertCircle className="w-4 h-4 shrink-0" />
                              <span>{deepReport.riskAnalysis.title}</span>
                            </div>
                            <ul className="space-y-1.5 text-xs text-rose-900 dark:text-rose-200 font-medium leading-relaxed">
                              {deepReport.riskAnalysis.items.map((it, idx) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                  <span className="text-rose-600 shrink-0">•</span>
                                  <span>{it}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Card 4: Đề xuất giải pháp */}
                          <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 rounded-2xl p-4 sm:p-5 space-y-2.5">
                            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-black text-xs uppercase tracking-wider">
                              <CheckCircle className="w-4 h-4 shrink-0" />
                              <span>{deepReport.solutions.title}</span>
                            </div>
                            <ul className="space-y-1.5 text-xs text-emerald-950 dark:text-emerald-200 font-medium leading-relaxed">
                              {deepReport.solutions.items.map((it, idx) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                  <span>{it}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Strategic Recommendations Card if simple report */}
                    {msg.report &&
                      msg.report.status === 'success' &&
                      !deepReport &&
                      msg.report.strategicRecommendations &&
                      msg.report.strategicRecommendations.length > 0 && (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-2xs space-y-3">
                          <h4 className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest flex items-center gap-2">
                            <Sparkles className="w-4 h-4" /> Đề xuất Cải tiến Chiến lược
                          </h4>
                          <ul className="space-y-2">
                            {msg.report.strategicRecommendations.map((r: string, rIdx: number) => (
                              <li
                                key={rIdx}
                                className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2"
                              >
                                <span className="text-amber-600 font-extrabold">{rIdx + 1}.</span>
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex gap-4 max-w-[80%] mr-auto">
                <div className="w-9 h-9 rounded-full bg-slate-900 text-amber-500 flex items-center justify-center font-black text-xs shadow-xs">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-2xs flex items-center gap-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider animate-pulse">
                    AI COPILOT đang phân tích số liệu vận hành và lập báo cáo...
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Executive Directors Selector for Bella Interior OS */}
          {isInterior && (
            <div className="shrink-0 px-3 sm:px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Brain className="w-3 h-3 text-amber-500" /> Đội ngũ Lãnh đạo &amp; Cố vấn AI:
                </span>
                <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">6 Giám đốc chuyên môn</span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {INTERIOR_DIRECTORS.map((d) => {
                  const isActive = selectedDirector === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSelectedDirector(d.id)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-xl shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 font-black shadow-xs ring-1 ring-amber-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-slate-700'
                      }`}
                    >
                      <span>{d.icon}</span>
                      <span>{d.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick suggestions matching selected Director */}
          {isInterior && (
            <div className="shrink-0 px-3 sm:px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex flex-wrap gap-1.5 sm:gap-2">
              {(INTERIOR_DIRECTOR_PILLS[selectedDirector] || INTERIOR_DIRECTOR_PILLS.all).map((pill) => (
                <button
                  key={pill}
                  type="button"
                  onClick={() => setInput(pill)}
                  disabled={isLoading}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-700 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer active:scale-95 disabled:opacity-50 shadow-2xs"
                >
                  ✨ {pill}
                </button>
              ))}
            </div>
          )}

          {/* Form Input */}
          <form
            onSubmit={handleSend}
            className="shrink-0 p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 sm:gap-3 relative z-10"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              placeholder={getPlaceholderText(tenantModuleKey)}
              className="min-w-0 flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 sm:px-5 py-3 sm:py-3.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="shrink-0 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 sm:px-6 py-3 sm:py-3.5 rounded-2xl shadow-xs transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Right Board: Action Board & Executive Analytics Widgets (Right 2/5) */}
        <div className="w-full lg:w-96 flex min-h-[24rem] lg:min-h-0 flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs p-4 sm:p-5 space-y-5">
          {/* Action Board Title */}
          <div className="shrink-0">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Bảng duyệt hành động (Mức A)
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Các quyết định khẩn cấp cần Ban điều hành xác nhận
            </p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
            {/* Widget 1: Hành động ưu tiên (Priority Action) */}
            {latestDeepReport?.rightWidgets?.priorityAction && (
              <div className="bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 p-4 rounded-2xl space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                    !
                  </div>
                  <h4 className="text-xs font-black text-blue-900 dark:text-blue-200">
                    {latestDeepReport.rightWidgets.priorityAction.title}
                  </h4>
                </div>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                  {latestDeepReport.rightWidgets.priorityAction.message}
                </p>
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      toast.info(`Đang chuyển đến hồ sơ: ${latestDeepReport.rightWidgets?.priorityAction.targetRecipient}`);
                    }}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Xem chi tiết</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Widget 2: XU HƯỚNG DÒNG TIỀN (6 THÁNG TỚI) */}
            {latestDeepReport?.rightWidgets?.trendChart && (
              <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    {latestDeepReport.rightWidgets.trendChart.title}
                  </span>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> Thu
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500" /> Chi
                    </span>
                  </div>
                </div>

                {/* Mini SVG Trend Line Chart */}
                <div className="relative h-28 w-full">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 280 100" preserveAspectRatio="none">
                    {/* Grid lines */}
                    <line x1="0" y1="20" x2="280" y2="20" stroke="#e2e8f0" strokeDasharray="3 3" />
                    <line x1="0" y1="50" x2="280" y2="50" stroke="#e2e8f0" strokeDasharray="3 3" />
                    <line x1="0" y1="80" x2="280" y2="80" stroke="#e2e8f0" strokeDasharray="3 3" />

                    {/* Green line: Thu */}
                    <polyline
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      points="10,65 60,35 115,35 170,20 225,20 270,12"
                    />
                    {/* Blue line: Chi */}
                    <polyline
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2.5"
                      points="10,75 60,55 115,55 170,45 225,45 270,38"
                    />

                    {/* Dots on Thu line */}
                    {[[10, 65], [60, 35], [115, 35], [170, 20], [225, 20], [270, 12]].map(([cx, cy], i) => (
                      <circle key={i} cx={cx} cy={cy} r="3" fill="#10b981" />
                    ))}
                    {/* Dots on Chi line */}
                    {[[10, 75], [60, 55], [115, 55], [170, 45], [225, 45], [270, 38]].map(([cx, cy], i) => (
                      <circle key={i} cx={cx} cy={cy} r="3" fill="#3b82f6" />
                    ))}
                  </svg>
                  <div className="flex justify-between text-[9px] text-slate-400 font-medium pt-1">
                    {latestDeepReport.rightWidgets.trendChart.labels.map((lbl, i) => (
                      <span key={i}>{lbl}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Widget 3: TỶ LỆ THU HỒI CÔNG NỢ */}
            {latestDeepReport?.rightWidgets?.recoveryGauge && (
              <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1">
                    {latestDeepReport.rightWidgets.recoveryGauge.title}
                  </span>
                  <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 block">
                    {latestDeepReport.rightWidgets.recoveryGauge.subtext}
                  </span>
                </div>
                {/* Circular Gauge */}
                <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-slate-200 dark:text-slate-700"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-emerald-500"
                      strokeDasharray="68, 100"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <span className="absolute text-xs font-black text-slate-900 dark:text-white">
                    {latestDeepReport.rightWidgets.recoveryGauge.ratePercent}%
                  </span>
                </div>
              </div>
            )}

            {/* Widget 4: GỢI Ý TỪ AI COPILOT */}
            {latestDeepReport?.rightWidgets?.aiAdviceQuote && (
              <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 p-4 rounded-2xl space-y-2">
                <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-black text-xs uppercase tracking-wider">
                  <Lightbulb className="w-4 h-4" />
                  <span>Gợi ý từ AI Copilot</span>
                </div>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium italic leading-relaxed">
                  &ldquo;{latestDeepReport.rightWidgets.aiAdviceQuote.quote}&rdquo;
                </p>
                <div className="text-right text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  {latestDeepReport.rightWidgets.aiAdviceQuote.author}
                </div>
              </div>
            )}

            {/* Draft Actions Waiting for Decision */}
            <div className="space-y-3 pt-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Đề xuất phê duyệt hành động
              </span>
              {messages.flatMap((m, mIdx) =>
                (m.report?.draftActions || []).map((action, actIdx) => {
                  const actionKey = `${mIdx}-${actIdx}-${action.recipient}`;
                  const isApproved = approvedActions[actionKey] === true;
                  const isRejected = approvedActions[actionKey] === false;

                  return (
                    <div
                      key={actionKey}
                      className="bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-2xs space-y-3"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          {(() => {
                            const badge = getActionBadgeLabel(action.type);
                            return (
                              <span
                                className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${badge.className}`}
                              >
                                {badge.label}
                              </span>
                            );
                          })()}
                          <h4 className="text-xs font-black text-slate-900 dark:text-white mt-1.5">
                            Đối tượng: {action.recipient}
                          </h4>
                        </div>

                        {isApproved && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Đã Duyệt
                          </span>
                        )}
                        {isRejected && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-rose-500 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Bỏ qua
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed font-semibold italic bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
                        Lý do: {action.reason}
                      </p>

                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider block">
                          Nội dung tin nhắn dự thảo:
                        </label>
                        <div className="text-[11px] text-slate-800 dark:text-slate-200 leading-normal bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80 break-words">
                          {action.draftMessage}
                        </div>
                      </div>

                      {!isApproved && !isRejected && (
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleApprove(action, actionKey)}
                            disabled={approvingId !== null}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest py-2 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            {approvingId === actionKey ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="w-3.5 h-3.5" /> Duyệt gửi
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(action, actionKey)}
                            disabled={approvingId !== null}
                            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Bỏ qua
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
