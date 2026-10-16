'use client';

import {
AlertCircle,
Bot,
Brain,
CheckCircle,
Loader2,
Send,
ShieldCheck,
Sparkles,
TrendingUp,
User,
XCircle
} from "lucide-react";
import { useEffect,useRef,useState } from "react";
import { toast,Toaster } from "sonner";

import { useTenantModuleKey } from "@/hooks/useTenantModuleKey";
import type { TenantModuleKey } from "@/lib/business-rules/tenant-modules";
import { useUser } from "@/lib/user-context";

interface Message {
  role: "user" | "assistant";
  content: string;
  report?: AiReport;
}

interface AiReport {
  status?: string;
  error?: string;
  analysis?: {
    executiveSummary?: string;
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
  if (productKey === "bella_haircut") {
    return "Xin chào Ban điều hành! Tôi là AI COO - trợ lý vận hành cho Bella Haircut Shop. Tôi có thể hỗ trợ theo dõi lịch hẹn cắt tóc, hồ sơ khách hàng, doanh thu, chấm công & lương stylist/KTV, CRM/Zalo, Meta Ads và các điểm bất thường cần xử lý trong ngày. Anh/chị cần tôi kiểm tra mảng nào hôm nay?";
  }

  if (moduleKey === "real_estate") {
    return "Xin chào Ban điều hành! Tôi là AI COO - trợ lý vận hành cho Bella Land. Tôi có thể hỗ trợ kiểm tra giỏ hàng căn hộ, tiến độ hợp đồng cọc, doanh thu dự án, tính hoa hồng môi giới, CRM nhà đầu tư và các báo cáo phân tích bất động sản trong ngày. Anh/chị cần tôi kiểm tra mảng nào hôm nay?";
  }

  if (moduleKey === "industrial_cleaning") {
    return "Xin chào Ban điều hành! Tôi là AI COO - trợ lý vận hành cho CleanPro. Tôi có thể hỗ trợ theo dõi lịch làm việc, hồ sơ khách hàng doanh nghiệp, doanh thu, chấm công & lương nhân viên vệ sinh, CRM/Zalo và các điểm bất thường cần xử lý trong ngày. Anh/chị cần tôi kiểm tra mảng nào hôm nay?";
  }

  if (moduleKey === "beauty_spa") {
    return "Xin chào Ban điều hành! Tôi là AI COO - trợ lý vận hành cho Beauty Spa. Tôi có thể hỗ trợ theo dõi lịch dịch vụ, hồ sơ khách hàng, doanh thu, chấm công & lương KTV, CRM/Zalo, Meta Ads và các điểm bất thường cần xử lý trong ngày. Anh/chị cần tôi kiểm tra mảng nào hôm nay?";
  }

  if (moduleKey === "babycare") {
    return "Xin chào Ban điều hành! Tôi là AI COO - trợ lý vận hành cho Bella Spa. Tôi có thể hỗ trợ phân tích tài chính, lịch chăm sóc, chấm công & lương KTV, đối soát dòng tiền, CRM/Zalo và các quyết định cải tiến trong ngày. Anh/chị cần tôi kiểm tra mảng nào hôm nay?";
  }

  return "Xin chào Ban điều hành! Tôi là AI COO - trợ lý vận hành của hệ thống. Tôi có thể hỗ trợ phân tích lịch dịch vụ, hồ sơ khách hàng, tài chính, nhân sự, CRM/Zalo và các điểm bất thường cần xử lý. Anh/chị cần tôi kiểm tra mảng nào hôm nay?";
}

function getPlaceholderText(moduleKey: TenantModuleKey | null) {
  if (moduleKey === "real_estate") {
    return "Nhập yêu cầu (ví dụ: 'Kiểm tra căn hộ trống', 'Tính hoa hồng dự án'...)";
  }
  if (moduleKey === "industrial_cleaning") {
    return "Nhập yêu cầu (ví dụ: 'Xem phiếu công việc', 'Tính công nhân viên'...)";
  }
  return "Nhập yêu cầu (ví dụ: 'Đối soát quỹ', 'Tính lương KTV Hoa'...)";
}

export default function AICopilotClient() {
  const { tenantModuleKey } = useTenantModuleKey();
  const { product } = useUser();
  const productKey = product?.productKey;
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: getAiWelcomeMessage(null)
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvedActions, setApprovedActions] = useState<Record<string, boolean>>({});
  
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [messages]);

  useEffect(() => {
    setMessages((current) => {
      if (current.length !== 1 || current[0]?.role !== "assistant") return current;
      return [{ ...current[0], content: getAiWelcomeMessage(tenantModuleKey, productKey) }];
    });
  }, [tenantModuleKey, productKey]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/v1/ai/coo-orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: userMessage })
      });

      const data = (await response.json()) as AiReport;

      if (!response.ok) {
        throw new Error(data.error || "Lỗi xử lý của AI Orchestrator");
      }

      setMessages(prev => [
        ...prev, 
        { 
          role: "assistant", 
          content: data.analysis?.executiveSummary || "AI COO đã hoàn tất phân tích nhưng chưa có tóm tắt điều hành.",
          report: data
        }
      ]);
      toast.success("AI COO đã hoàn tất phân tích số liệu!");

    } catch (error: unknown) {
      console.error("Lỗi gọi AI COO:", error);
      const message = getErrorMessage(error, "Không thể phân tích yêu cầu.");
      setMessages(prev => [
        ...prev, 
        { 
          role: "assistant", 
          content: `⚠️ Đã xảy ra lỗi nghiêm trọng: ${message}. Vui lòng thử lại hoặc liên hệ bộ phận kỹ thuật.`
        }
      ]);
      toast.error(`Lỗi phân tích: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (action: DraftAction, actionKey: string) => {
    if (approvingId === actionKey) return;
    
    setApprovingId(actionKey);
    const toastId = toast.loading(`Đang tiến hành duyệt hành động nháp cho ${action.recipient}...`);

    try {
      const response = await fetch("/api/v1/ai/action-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: action.type,
          recipient: action.recipient,
          reason: action.reason,
          draftMessage: action.draftMessage
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Lỗi phê duyệt từ hệ thống");
      }

      setApprovedActions(prev => ({ ...prev, [actionKey]: true }));
      toast.success(`Đã phê duyệt thành công đề xuất cho ${action.recipient}!`, { id: toastId });

    } catch (error: unknown) {
      console.error("Lỗi duyệt hành động:", error);
      toast.error(`Phê duyệt thất bại: ${getErrorMessage(error, "Không thể phê duyệt hành động.")}`, { id: toastId });
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = (action: DraftAction, actionKey: string) => {
    toast.info(`Đã từ chối bản nháp đề xuất của ${action.recipient}`);
    setApprovedActions(prev => ({ ...prev, [actionKey]: false }));
  };

  return (
    <div className="flex-1 min-h-[calc(100vh-4rem)] lg:h-screen lg:max-h-screen flex flex-col overflow-y-auto lg:overflow-hidden relative bg-background text-foreground">
      {/* Dynamic Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] right-[10%] w-[40%] h-[40%] bg-rose-500/5 rounded-full blur-[120px] pointer-events-none" />

      <Toaster position="top-right" richColors />

      {/* Header Bar */}
      <header className="relative shrink-0 z-10 px-4 sm:px-6 py-4 border-b border-border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 animate-pulse">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black bg-gradient-to-r from-primary via-accent to-rose-500 bg-clip-text text-transparent uppercase tracking-wider">AI COO Copilot</h1>
            <p className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-widest mt-0.5">Mức A • Trợ lý điều hành chi nhánh</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">RLS Secured Tenant</span>
        </div>
      </header>

      {/* Main Board */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-visible lg:overflow-hidden relative z-10 p-4 pb-0 sm:p-6 sm:pb-0 lg:pb-0 gap-4 sm:gap-6 min-h-0">
        
        {/* Chat Area (Left 3/5) */}
        <div className="flex min-h-[32rem] flex-col bg-card/40 border border-border rounded-t-3xl rounded-b-none lg:rounded-t-[2rem] lg:rounded-b-none overflow-hidden backdrop-blur-md shadow-lg lg:flex-1 lg:min-h-0">
          {/* Scrollable messages */}
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6 custom-scrollbar"
          >
            {messages.map((msg, index) => (
              <div 
                key={index}
                className={`flex gap-3 sm:gap-4 max-w-[92%] sm:max-w-[85%] ${msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
              >
                <div className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center shadow-md ${
                  msg.role === "user" 
                    ? "bg-accent text-accent-foreground" 
                    : "bg-primary text-primary-foreground"
                }`}>
                  {msg.role === "user" ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>

                <div className="min-w-0 space-y-4">
                  <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-5 border text-sm leading-relaxed shadow-sm ${
                    msg.role === "user" 
                      ? "bg-primary text-primary-foreground border-primary/20 shadow-md" 
                      : "bg-card border-border text-foreground shadow-sm"
                  }`}>
                    {msg.content}
                  </div>

                  {/* Render analysis report details if present */}
                  {msg.report && msg.report.status === "success" && (
                    <div className="space-y-4">
                      {/* Strategic Recommendations Card */}
                      {msg.report.strategicRecommendations && msg.report.strategicRecommendations.length > 0 && (
                        <div className="bg-card/85 border border-border p-6 rounded-[2rem] shadow-sm space-y-3">
                          <h4 className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
                            <Sparkles className="w-4 h-4" /> Đề xuất Cải tiến Chiến lược
                          </h4>
                          <ul className="space-y-2">
                            {msg.report.strategicRecommendations.map((r: string, rIdx: number) => (
                              <li key={rIdx} className="text-xs text-muted-foreground flex items-start gap-2">
                                <span className="text-primary font-extrabold">{rIdx + 1}.</span>
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-4 max-w-[80%] mr-auto">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-md">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
                <div className="bg-card border border-border rounded-3xl p-5 shadow-sm flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-extrabold uppercase tracking-widest animate-pulse">AI COO đang thu thập dữ liệu và lập báo cáo...</span>
                </div>
              </div>
            )}
            {/* Scroll anchor handled via ref */}
          </div>

          {/* Form Input */}
          <form 
            onSubmit={handleSend}
            className="shrink-0 p-3 sm:p-4 border-t border-border bg-card/60 flex items-center gap-2 sm:gap-3 relative z-10"
          >
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              placeholder={getPlaceholderText(tenantModuleKey)}
              className="min-w-0 flex-1 bg-muted border border-border rounded-2xl px-4 sm:px-5 py-3.5 sm:py-4 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all disabled:opacity-50"
            />
            <button 
              type="submit"
              disabled={isLoading || !input.trim()}
              className="shrink-0 bg-primary hover:bg-primary-hover text-primary-foreground font-bold px-4 sm:px-6 py-3.5 sm:py-4 rounded-2xl shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Action Board (Right 2/5) */}
        <div className="w-full lg:w-96 flex min-h-[24rem] lg:min-h-0 flex-col bg-card/40 border border-border rounded-t-3xl rounded-b-none lg:rounded-t-[2rem] lg:rounded-b-none overflow-hidden backdrop-blur-md shadow-lg p-4 sm:p-6 space-y-5 sm:space-y-6">
          <div className="shrink-0">
            <h3 className="text-sm font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Bảng Duyệt Hành Động (Mức A)
            </h3>
            <p className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider mt-1">Các quyết định khẩn cấp cần Ban điều hành xác nhận</p>
          </div>

          {/* List of draft actions */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
            {messages.filter(m => (m.report?.draftActions?.length ?? 0) > 0).length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border border-border text-muted-foreground shadow-inner">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-foreground uppercase tracking-widest">Không có hành động chờ duyệt</h4>
                  <p className="text-[10px] text-muted-foreground mt-1 max-w-[200px] mx-auto">Khi anh ra lệnh cho AI COO phân tích bất thường, các bản nháp giải trình hoặc đối soát sẽ xuất hiện tại đây.</p>
                </div>
              </div>
            ) : (
              messages.flatMap((m, mIdx) => 
                (m.report?.draftActions || []).map((action, actIdx) => {
                  const actionKey = `${mIdx}-${actIdx}-${action.recipient}`;
                  const isApproved = approvedActions[actionKey] === true;
                  const isRejected = approvedActions[actionKey] === false;

                  return (
                    <div 
                      key={actionKey}
                      className="bg-card border border-border p-5 rounded-2xl shadow-md space-y-4 hover:border-primary/20 transition-all duration-300"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                            action.type === "attendance_warning" 
                              ? "bg-pink-500/10 text-pink-500 border border-pink-500/20" 
                              : "bg-cyan-500/10 text-cyan-600 border border-cyan-500/20"
                          }`}>
                            {action.type === "attendance_warning" ? "Nhân sự - Kỷ luật" : "Kế toán - Đối soát"}
                          </span>
                          <h4 className="text-xs font-black text-foreground mt-2">Đối tượng: {action.recipient}</h4>
                        </div>

                        {isApproved && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Đã Duyệt
                          </span>
                        )}
                        {isRejected && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-rose-500 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Đã Từ Chối
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-foreground leading-relaxed font-semibold italic bg-muted/50 p-2.5 rounded-lg border border-border">
                        Lý do: {action.reason}
                      </p>

                      <div className="space-y-1.5">
                        <label className="text-[9px] text-muted-foreground font-extrabold uppercase tracking-wider block">Nội dung tin nhắn dự thảo:</label>
                        <div className="text-[11px] text-foreground leading-normal bg-muted p-3 rounded-lg border border-border break-words">
                          {action.draftMessage}
                        </div>
                      </div>

                      {!isApproved && !isRejected && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(action, actionKey)}
                            disabled={approvingId !== null}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
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
                            onClick={() => handleReject(action, actionKey)}
                            disabled={approvingId !== null}
                            className="bg-muted hover:bg-slate-100 border border-border text-muted-foreground hover:text-foreground text-[10px] font-black uppercase tracking-widest py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Bỏ qua
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
