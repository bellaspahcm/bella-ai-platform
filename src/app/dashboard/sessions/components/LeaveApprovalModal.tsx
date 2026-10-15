'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Calendar, 
  Clock, 
  AlertCircle, 
  UserCircle, 
  CheckCircle2, 
  Loader2, 
  Check, 
  XCircle 
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { getPendingLeaveRequests, getKTVConflictSessions, approveLeaveRequest, rejectLeaveRequest, getProcessedLeaveRequests } from '@/services/attendance-actions';
import { getUsers } from '@/services/user-actions';
import { LeaveRequest, ConflictSession, KtvUser } from '../types';
import { getLeaveDecisionRecommendation } from '../actions';

function getErrorMessage(error: unknown, fallback = 'Da xay ra loi') {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string') return error || fallback;
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

interface LeaveApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  userRole: string;
}

export function LeaveApprovalModal({ isOpen, onClose, onSuccess, userRole }: LeaveApprovalModalProps) {
  const vocab = useModuleVocabulary();
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [conflictSessions, setConflictSessions] = useState<ConflictSession[]>([]);
  const [allKTVs, setAllKTVs] = useState<KtvUser[]>([]);
  const [reassignmentMapping, setReassignmentMapping] = useState<Record<string, string>>({}); // session_log_id -> new_ktv_id
  const [isApprovingLeave, setIsApprovingLeave] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejectingLeave, setIsRejectingLeave] = useState(false);
  const [recommendation, setRecommendation] = useState<
    | { outcome: string; explanation: string; executionTime: number; policyId: string; policyVersion: string; message: { title: string; description: string; color: string }; knowledge: unknown }
    | { error: true; message: string }
    | null
  >(null);
  const [isLoadingRecommendation, setIsLoadingRecommendation] = useState(false);
  const isRecError = recommendation && 'error' in recommendation ? recommendation : null;
  const successRec = recommendation && !('error' in recommendation) ? recommendation : null;

  interface ProcessedLeaveRequest extends LeaveRequest {
    rejection_reason?: string | null;
    approved_by?: string | null;
  }

  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [filterMonth, setFilterMonth] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });
  const [processedLeaves, setProcessedLeaves] = useState<ProcessedLeaveRequest[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadPendingLeaves = async () => {
    try {
      const leaves = (await getPendingLeaveRequests()) as LeaveRequest[];
      setPendingLeaves(leaves);
    } catch (err: unknown) {
      console.error("Failed to load pending leaves:", err);
      toast.error("Không thể tải danh sách đơn nghỉ phép");
    }
  };

  const loadProcessedLeaves = useCallback(async (month: string) => {
    setIsLoadingHistory(true);
    try {
      const leaves = (await getProcessedLeaveRequests(month)) as ProcessedLeaveRequest[];
      setProcessedLeaves(leaves);
    } catch (err: unknown) {
      console.error("Failed to load leave history:", err);
      toast.error("Không thể tải lịch sử đơn nghỉ phép");
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const loadKTVs = async () => {
    try {
      const users = (await getUsers()) as KtvUser[];
      const activeKTVs = users.filter((u) => u.role === 'ktv' && u.status === 'active');
      setAllKTVs(activeKTVs);
    } catch (err: unknown) {
      console.error("Failed to load KTVs:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPendingLeaves();
      if (userRole === 'admin') {
        loadKTVs();
      }
    } else {
      // Reset state on close
      setSelectedLeave(null);
      setConflictSessions([]);
      setReassignmentMapping({});
      setRejectionReason('');
      setRecommendation(null);
      setActiveTab('pending');
    }
  }, [isOpen, userRole]);

  useEffect(() => {
    if (isOpen && activeTab === 'history') {
      loadProcessedLeaves(filterMonth);
    }
  }, [isOpen, activeTab, filterMonth, loadProcessedLeaves]);

  const handleSelectLeave = async (leave: LeaveRequest) => {
    setSelectedLeave(leave);
    setReassignmentMapping({});
    setRejectionReason('');
    setRecommendation(null);
    
    try {
      // Load conflict sessions
      const conflicts = (await getKTVConflictSessions(leave.user_id, leave.leave_date, leave.leave_type)) as unknown as ConflictSession[];
      setConflictSessions(conflicts);
      
      // Load Decision Engine recommendation
      setIsLoadingRecommendation(true);
      try {
        const response = await getLeaveDecisionRecommendation(leave.id);
        console.log('[LeaveApprovalModal] Decision response:', response);
        
        // Check if response has error
        if ('error' in response) {
          setRecommendation({ 
            error: true, 
            message: response.message || 'Không thể tải khuyến nghị' 
          });
        } else if (response.outcome) {
          setRecommendation({
            outcome: response.outcome,
            explanation: response.explanation ?? '',
            executionTime: response.executionTime,
            policyId: response.policyId,
            policyVersion: response.policyVersion,
            message: response.message,
            knowledge: response.knowledge,
          });
        } else {
          // Unknown format
          setRecommendation({ 
            error: true, 
            message: 'Định dạng response không hợp lệ' 
          });
        }
      } catch (decisionErr) {
        console.error('[LeaveApprovalModal] Failed to load decision recommendation:', decisionErr);
        // Non-blocking - continue even if recommendation fails
        setRecommendation({ 
          error: true, 
          message: decisionErr instanceof Error ? decisionErr.message : 'Unknown error' 
        });
      }
    } catch (err: unknown) {
      console.error("Failed to load conflict sessions:", err);
      toast.error("Không thể tải đầy đủ thông tin đơn nghỉ phép");
    } finally {
      setIsLoadingRecommendation(false);
    }
  };

  const handleApproveLeave = async () => {
    if (!selectedLeave) return;
    setIsApprovingLeave(true);
    try {
      const unassigned = conflictSessions.filter(session => !reassignmentMapping[session.id]);
      if (unassigned.length > 0) {
        toast.error("Vui lòng phân công người thay thế cho tất cả các ca trùng lịch");
        setIsApprovingLeave(false);
        return;
      }
      const reassignmentsArray = Object.entries(reassignmentMapping).map(([sessionLogId, newKtvId]) => ({
        sessionLogId,
        newKtvId
      }));
      
      const res = await approveLeaveRequest(selectedLeave.id, reassignmentsArray);
      if (res?.success) {
        toast.success("Phê duyệt đơn xin nghỉ phép thành công!");
        setSelectedLeave(null);
        setConflictSessions([]);
        setReassignmentMapping({});
        loadPendingLeaves();
        loadProcessedLeaves(filterMonth);
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      } else {
        toast.error(res?.error || "Phê duyệt thất bại");
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error(getErrorMessage(err));
    } finally {
      setIsApprovingLeave(false);
    }
  };

  const handleRejectLeave = async () => {
    if (!selectedLeave) return;
    if (!rejectionReason.trim()) {
      toast.error("Vui lòng nhập lý do từ chối");
      return;
    }
    setIsRejectingLeave(true);
    try {
      const res = await rejectLeaveRequest(selectedLeave.id, rejectionReason.trim());
      if (res?.success) {
        toast.success("Đã từ chối đơn xin nghỉ phép");
        setSelectedLeave(null);
        setConflictSessions([]);
        setReassignmentMapping({});
        setRejectionReason('');
        loadPendingLeaves();
        loadProcessedLeaves(filterMonth);
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast.error(res?.error || "Từ chối thất bại");
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error(getErrorMessage(err));
    } finally {
      setIsRejectingLeave(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Slide over */}
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col h-full border-l border-slate-100"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Duyệt nghỉ phép {vocab.worker.short}</h2>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-0.5">Xử lý yêu cầu xin nghỉ & điều phối lịch trùng</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors border border-slate-200 shadow-sm"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs and filter */}
              <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center gap-4 flex-shrink-0">
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('pending');
                      setSelectedLeave(null);
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-wider",
                      activeTab === 'pending'
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    Chờ duyệt ({pendingLeaves.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('history');
                      setSelectedLeave(null);
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-wider",
                      activeTab === 'history'
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    Lịch sử
                  </button>
                </div>

                {activeTab === 'history' && (
                  <input
                    type="month"
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-black bg-white focus:outline-none focus:ring-2 focus:ring-[#1A0A0E]/15 hover:border-slate-300 transition-all text-slate-800"
                  />
                )}
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {activeTab === 'history' && isLoadingHistory ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                    <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Đang tải lịch sử...</p>
                  </div>
                ) : (activeTab === 'pending' ? pendingLeaves.length : processedLeaves.length) === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                      <Calendar className="w-8 h-8" />
                    </div>
                    {activeTab === 'pending' ? (
                      <div>
                        <p className="text-slate-800 font-black text-sm uppercase">Không có đơn xin nghỉ nào</p>
                        <p className="text-slate-400 text-xs mt-1">Tất cả đơn xin nghỉ phép của KTV đã được xử lý xong.</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-slate-800 font-black text-sm uppercase">Không có lịch sử xin nghỉ</p>
                        <p className="text-slate-400 text-xs mt-1">Chưa có đơn xin nghỉ phép nào được xử lý trong tháng này.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full min-h-[400px]">
                    {/* Left: Leave list */}
                    <div className={cn("space-y-3", selectedLeave ? "md:col-span-5" : "md:col-span-12")}>
                      <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                        {activeTab === 'pending' ? 'Danh sách chờ duyệt' : 'Lịch sử đã xử lý'}
                      </h3>
                      <div className="space-y-3">
                        {(activeTab === 'pending' ? pendingLeaves : processedLeaves).map((leave) => {
                          const isSelected = selectedLeave?.id === leave.id;
                          return (
                            <button
                              key={leave.id}
                              onClick={() => handleSelectLeave(leave)}
                              className={cn(
                                "w-full text-left p-4 rounded-2xl border transition-all flex flex-col gap-2 relative overflow-hidden",
                                isSelected 
                                  ? "bg-[#1A0A0E] text-white border-transparent shadow-xl" 
                                  : "bg-white border-slate-200 hover:border-slate-300 text-slate-800 shadow-sm"
                              )}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-black text-sm">{leave.users?.full_name || 'KTV'}</p>
                                  <p className={cn("text-[10px] font-bold mt-0.5", isSelected ? "text-slate-400" : "text-slate-500")}>
                                    {leave.users?.email}
                                  </p>
                                </div>
                                {leave.status === 'pending' && (
                                  <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                    Chờ duyệt
                                  </span>
                                )}
                                {leave.status === 'approved' && (
                                  <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                    Đã duyệt
                                  </span>
                                )}
                                {leave.status === 'rejected' && (
                                  <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                    Từ chối
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-dashed border-slate-100/10">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-3.5 h-3.5 text-rose-500" />
                                  <span className="text-xs font-black">
                                    {new Date(leave.leave_date).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' })}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span className="text-[10px] font-semibold text-slate-500 italic">
                                    Gửi lúc: {new Date(leave.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ({new Date(leave.created_at).toLocaleDateString('vi-VN')})
                                  </span>
                                </div>
                              </div>
                              <div className="text-[11px] italic opacity-90 mt-1 line-clamp-2">
                                Lý do: {leave.reason || 'Không có lý do'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right: Leave detail & conflict resolution */}
                    {selectedLeave && (
                      <div className="md:col-span-7 space-y-4 border-l border-slate-100 pl-0 md:pl-6">
                        <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                          {selectedLeave.status === 'pending' ? 'Chi tiết & Xử lý trùng lịch' : 'Chi tiết đơn phép'}
                        </h3>
                        
                        {/* Only show Decision recommendation for pending leaves */}
                        {selectedLeave.status === 'pending' && (
                          <>
                            {/* Decision Engine Recommendation Panel */}
                            {isLoadingRecommendation ? (
                              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3">
                                <Loader2 className="w-5 h-5 text-slate-400 animate-spin flex-shrink-0" />
                                <div>
                                  <p className="text-xs font-black text-slate-700 uppercase">Đang phân tích...</p>
                                  <p className="text-[11px] text-slate-500 mt-0.5">Decision Engine đang đánh giá đơn nghỉ phép</p>
                                </div>
                              </div>
                            ) : isRecError ? (
                              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-xs font-black text-amber-800 uppercase">⚠️ Decision Engine không khả dụng</p>
                                  <p className="text-[11px] text-amber-700 mt-0.5">Lỗi: {isRecError.message || 'Không thể tải khuyến nghị tự động'}</p>
                                  <p className="text-[10px] text-amber-600 mt-1 italic">Bạn vẫn có thể phê duyệt/từ chối thủ công.</p>
                                </div>
                              </div>
                            ) : successRec ? (
                              <div className={cn(
                                "p-4 border rounded-2xl flex gap-3",
                                successRec.outcome === 'APPROVE' && "bg-emerald-50 border-emerald-200",
                                successRec.outcome === 'REJECT' && "bg-rose-50 border-rose-200",
                                successRec.outcome === 'ESCALATE' && "bg-amber-50 border-amber-200"
                              )}>
                                {successRec.outcome === 'APPROVE' && <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />}
                                {successRec.outcome === 'REJECT' && <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />}
                                {successRec.outcome === 'ESCALATE' && <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />}
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <p className={cn(
                                      "text-xs font-black uppercase tracking-tight",
                                      successRec.outcome === 'APPROVE' && "text-emerald-800",
                                      successRec.outcome === 'REJECT' && "text-rose-800",
                                      successRec.outcome === 'ESCALATE' && "text-amber-800"
                                    )}>
                                      {successRec.outcome === 'APPROVE' && '✅ Khuyến nghị: PHÊ DUYỆT'}
                                      {successRec.outcome === 'REJECT' && '❌ Khuyến nghị: TỪ CHỐI'}
                                      {successRec.outcome === 'ESCALATE' && '⚠️ Khuyến nghị: CẦN XEM XÉT'}
                                    </p>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">
                                      {successRec.executionTime}ms
                                    </span>
                                  </div>
                                  <p className={cn(
                                    "text-[11px] mt-1.5 leading-relaxed",
                                    successRec.outcome === 'APPROVE' && "text-emerald-700",
                                    successRec.outcome === 'REJECT' && "text-rose-700",
                                    successRec.outcome === 'ESCALATE' && "text-amber-700"
                                  )}>
                                    {successRec.explanation}
                                  </p>
                                  <div className="mt-2 pt-2 border-t border-dashed border-slate-200/50">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                      🤖 AI Decision Engine • Policy: {successRec.policyId} v{successRec.policyVersion}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </>
                        )}
                        
                        <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Kỹ thuật viên</span>
                            <span className="text-xs font-black text-slate-800">{selectedLeave.users?.full_name}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Ngày xin nghỉ</span>
                            <span className="text-xs font-black text-rose-600">
                              {new Date(selectedLeave.leave_date).toLocaleDateString('vi-VN', { year: 'numeric', month: 'numeric', day: 'numeric' })}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Thời gian gửi đơn</span>
                            <span className="text-xs font-black text-slate-800">
                              {new Date(selectedLeave.created_at).toLocaleString('vi-VN', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {selectedLeave.leave_type && (
                            <div className="flex justify-between items-center">
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Ca xin nghỉ</span>
                              <span className="text-xs font-black text-slate-800 uppercase bg-slate-200/50 px-2 py-0.5 rounded-md text-[10px]">
                                {selectedLeave.leave_type === 'full_day' ? 'Cả ngày' : selectedLeave.leave_type === 'morning' ? 'Ca sáng' : 'Ca chiều'}
                              </span>
                            </div>
                          )}
                          <div className="pt-2 border-t border-slate-200/60">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Lý do xin nghỉ</p>
                            <p className="text-xs text-slate-700 italic bg-white p-2.5 rounded-xl border border-slate-200/50">
                              &quot;{selectedLeave.reason || 'Không có lý do'}&quot;
                            </p>
                          </div>
                        </div>

                        {selectedLeave.status === 'pending' ? (
                          <>
                            {/* Conflicts Area */}
                            <div className="space-y-3">
                              {conflictSessions.length > 0 ? (
                                <>
                                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex gap-3">
                                    <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                      <p className="text-xs font-black text-rose-800 uppercase tracking-tight">Cần phân công người thay thế</p>
                                      <p className="text-[11px] text-rose-700/90 mt-1 leading-relaxed">
                                        KTV này đang được phân công phụ trách <strong>{conflictSessions.length} ca tập</strong> trong ngày xin nghỉ. 
                                        Vui lòng chọn KTV thay thế cho từng ca để đảm bảo tiến độ điều trị của khách hàng.
                                      </p>
                                    </div>
                                  </div>

                                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                    {conflictSessions.map((session) => (
                                      <div key={session.id} className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2.5">
                                        <div className="flex justify-between items-start">
                                          <div>
                                            <p className="text-xs font-black text-slate-800">
                                              Khách {session.bookings?.customers?.full_name || 'Khách hàng'}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">
                                              {session.bookings?.package_name || 'Liệu trình'} - Buổi {session.session_number}
                                            </p>
                                          </div>
                                          <span className="text-[10px] font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-slate-400" />
                                            {session.assigned_time || 'Chưa hẹn giờ'}
                                          </span>
                                        </div>
                                        
                                        <div className="pt-1.5 border-t border-slate-100">
                                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">KTV thay thế hôm nay</label>
                                          <PremiumSelect
                                            value={reassignmentMapping[session.id] || ''}
                                            options={allKTVs
                                              .filter((u) => u.id !== selectedLeave.user_id)
                                              .map((u) => ({
                                                value: u.id,
                                                label: u.full_name,
                                                icon: <UserCircle className="w-4 h-4" />
                                              }))}
                                            onChange={(value) => setReassignmentMapping(prev => ({ ...prev, [session.id]: value }))}
                                            placeholder="-- Chọn KTV thay thế --"
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              ) : (
                                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex gap-3">
                                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                  <div>
                                    <p className="text-xs font-black text-emerald-800 uppercase tracking-tight">Không có ca trùng lịch</p>
                                    <p className="text-[11px] text-emerald-700/90 mt-1 leading-relaxed">
                                      Không phát hiện ca liệu trình nào KTV này phụ trách vào ngày xin nghỉ. Bạn có thể duyệt trực tiếp.
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Approval / Rejection Actions */}
                            <div className="pt-4 border-t border-slate-100 space-y-4">
                              {/* Rejection input */}
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ghi chú khi từ chối</label>
                                <textarea
                                  placeholder="Nhập lý do từ chối đơn xin nghỉ (bắt buộc nếu từ chối)..."
                                  value={rejectionReason}
                                  onChange={(e) => setRejectionReason(e.target.value)}
                                  className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[60px]"
                                />
                              </div>

                              <div className="flex gap-3">
                                <button
                                  type="button"
                                  onClick={handleRejectLeave}
                                  disabled={isRejectingLeave || isApprovingLeave || !rejectionReason.trim()}
                                  className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-transparent hover:border-rose-100 text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                                >
                                  {isRejectingLeave ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <XCircle className="w-4 h-4" />
                                  )}
                                  Từ chối
                                </button>
                                <button
                                  type="button"
                                  onClick={handleApproveLeave}
                                  disabled={
                                    isApprovingLeave || 
                                    isRejectingLeave || 
                                    (conflictSessions.length > 0 && conflictSessions.some(session => !reassignmentMapping[session.id]))
                                  }
                                  className="flex-1 py-3 px-4 rounded-xl bg-[#1A0A0E] text-white hover:bg-slate-900 text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-lg shadow-rose-100/10 dark:shadow-none"
                                >
                                  {isApprovingLeave ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Check className="w-4 h-4" />
                                  )}
                                  Phê duyệt
                                </button>
                              </div>
                            </div>
                          </>
                        ) : (
                          /* Processed leave detail */
                          <div className="pt-2 space-y-4">
                            {selectedLeave.status === 'approved' ? (
                              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 shadow-sm">
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                                <div>
                                  <p className="text-xs font-black text-emerald-800 uppercase tracking-tight">Đã phê duyệt</p>
                                  <p className="text-[11px] text-emerald-700 mt-0.5">
                                    Đơn xin nghỉ phép của KTV đã được phê duyệt và đồng bộ sang hệ thống chấm công.
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl space-y-2.5 shadow-sm">
                                <div className="flex items-center gap-3">
                                  <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs font-black text-rose-800 uppercase tracking-tight">Đã từ chối</p>
                                    <p className="text-[11px] text-rose-700 mt-0.5">
                                      Đơn xin nghỉ phép đã bị từ chối phê duyệt.
                                    </p>
                                  </div>
                                </div>
                                {(selectedLeave as ProcessedLeaveRequest).rejection_reason && (
                                  <div className="pt-2 border-t border-rose-100/50">
                                    <span className="text-[9px] font-black text-rose-500/80 uppercase tracking-widest block mb-0.5">Lý do từ chối</span>
                                    <p className="text-xs text-rose-800 italic">
                                      &quot;{(selectedLeave as ProcessedLeaveRequest).rejection_reason}&quot;
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
