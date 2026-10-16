'use client';

import { CurrentUser,KtvSalaryRecord } from '@/types/domain';
import { motion } from 'framer-motion';
import {
AlertCircle,
CheckCircle2,
Download,
Eye,
Filter,
Loader2,
RefreshCw,
Search,
ShieldCheck,
Star
} from 'lucide-react';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';
import { useState } from 'react';
import { SalaryDetailModal } from '@/components/salary/SalaryDetailModal';
import { useRouter } from 'next/navigation';

interface SalaryTableProps {
  filteredSalaries: KtvSalaryRecord[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  currentUser: CurrentUser | null;
  activeSalaryAction: string | null;
  activeSalaryExportId: string | null;
  openEditModal: (s: KtvSalaryRecord) => void;
  handleRecalculate: (id: string, name: string) => void;
  handleApprove: (id: string, name: string) => void;
  handleExport: (s: KtvSalaryRecord) => void;
  currentMonth: string; // YYYY-MM format
}

export default function SalaryTable({
  filteredSalaries,
  searchQuery,
  setSearchQuery,
  currentUser,
  activeSalaryAction,
  activeSalaryExportId,
  openEditModal,
  handleRecalculate,
  handleApprove,
  handleExport,
  currentMonth,
}: SalaryTableProps) {
  const router = useRouter();
  const vocab = useModuleVocabulary();
  const isNotKtv = currentUser?.role?.toLowerCase() !== 'ktv';
  
  // Modal state for salary detail
  const [viewingSalary, setViewingSalary] = useState<KtvSalaryRecord | null>(null);

  return (
    <div className="mb-6 overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm md:mb-10 md:rounded-[40px]">
      <div className="flex flex-col gap-4 border-b border-slate-50 p-4 sm:p-6 md:flex-row md:items-center md:justify-between md:p-8">
        <h2 className="flex items-center gap-3 text-lg font-black tracking-tight text-slate-900 sm:text-2xl">
          <ShieldCheck className="h-6 w-6 shrink-0 text-primary sm:h-8 sm:w-8" />
          Bảng tính lương chi tiết
        </h2>
        <div className="bella-toolbar flex w-full flex-col gap-3 sm:flex-row md:w-auto md:items-center">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder={`Tìm tên ${vocab.worker.singular.toLowerCase()}...`} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border-none bg-slate-50 py-4 pl-12 pr-6 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button className="flex min-h-12 items-center justify-center rounded-2xl bg-slate-50 p-4 text-slate-500 transition-all hover:bg-slate-100">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto overscroll-x-contain custom-scrollbar shadow-[inset_-18px_0_18px_-18px_rgba(15,23,42,0.32)]">
        <table className="bella-data-table min-w-[90rem] text-left">
          <thead>
            <tr className="bg-slate-50/80 backdrop-blur-md">
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[220px]">{vocab.worker.singular}</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[100px]">Số {vocab.workUnit.plural}</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[100px]">Ngày công</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[100px]">Đánh giá</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px]">Lương cứng</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px]">Hoa hồng {vocab.workUnit.singular}</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px]">Thưởng chất lượng</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px]">Thưởng KPI</th>
              {/* Advanced commission columns - always show for Beauty Spa */}
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px]">Hoa hồng bán hàng</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px]">Hoa hồng dịch vụ</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px]">Phạt</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px]">Tạm ứng</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[160px]">Tổng nhận</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px]">Trạng thái</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[120px]">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredSalaries.map((s, index) => {
              const isApproving = activeSalaryAction === `approve:${s.id}`;
              const isRecalculating = activeSalaryAction === `recalculate:${s.id}`;
              const isActionBlocked = activeSalaryAction !== null;
              const isExporting = activeSalaryExportId === s.id;
              const isExportBlocked = activeSalaryExportId !== null;
              const canRecalculate = s.status === 'draft';

              return (
              <motion.tr
                key={s.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="hover:bg-slate-50/50 transition-colors group"
                data-testid="salary-row"
                data-salary-id={s.id}
              >
                <td className="px-8 py-6 whitespace-nowrap" data-testid="salary-employee-name">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-primary font-black shadow-sm group-hover:scale-110 transition-transform">
                      {s.name.charAt(0)}
                    </div>
                    <span className="font-bold text-slate-900">{s.name}</span>
                  </div>
                </td>
                <td className="px-8 py-6 whitespace-nowrap" data-testid="salary-session-count">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-600">{s.sessions}</span>
                    {s.isConfirmed && (
                      <div className="flex items-center gap-1 bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tighter animate-in fade-in zoom-in duration-300">
                        <ShieldCheck className="w-3 h-3" />
                        Đã Chốt
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-8 py-6 whitespace-nowrap" data-testid="salary-actual-days">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-600">{s.actualDays ?? '—'}</span>
                    <span className="text-[10px] text-slate-400 font-medium">/26</span>
                  </div>
                </td>
                <td className="px-8 py-6 whitespace-nowrap">
                  {s.avgRating !== null && s.avgRating !== undefined ? (
                    <div className="flex items-center gap-1.5 text-amber-500 font-black">
                      <Star className="w-4 h-4 fill-current" />
                      {s.avgRating.toFixed(1)}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-300 font-black" title="Chưa có dữ liệu trong tháng">
                      <Star className="w-4 h-4" />
                      <span>—</span>
                    </div>
                  )}
                </td>
                <td className="px-8 py-6 font-bold text-slate-600 whitespace-nowrap">{s.baseSalary.toLocaleString()}đ</td>
                <td className="px-8 py-6 font-bold text-emerald-600 whitespace-nowrap" data-testid="salary-session-bonus">+{s.sessionBonus.toLocaleString()}đ</td>
                <td className="px-8 py-6 font-bold text-amber-600 whitespace-nowrap">+{s.ratingBonus?.toLocaleString() || 0}đ</td>
                <td className="px-8 py-6 font-bold text-primary whitespace-nowrap">+{s.kpiBonus.toLocaleString()}đ</td>
                {/* Advanced commission columns - always show for Beauty Spa */}
                <td className="px-8 py-6 font-bold text-emerald-600 whitespace-nowrap" data-testid="salary-product-commission">
                  +{(s.productSalesCommission || 0).toLocaleString()}đ
                </td>
                <td className="px-8 py-6 font-bold text-emerald-600 whitespace-nowrap" data-testid="salary-service-commission">
                  +{(s.serviceCommission || 0).toLocaleString()}đ
                </td>
                <td className="px-8 py-6 font-bold text-rose-500 whitespace-nowrap">-{s.deductions.toLocaleString()}đ</td>
                <td className="px-8 py-6 font-bold text-rose-500 whitespace-nowrap">-{s.advances.toLocaleString()}đ</td>
                <td className="px-8 py-6 whitespace-nowrap" data-testid="salary-total">
                  <span className="text-lg font-black text-slate-900">{s.totalSalary.toLocaleString()}đ</span>
                </td>
                <td className="px-8 py-6 whitespace-nowrap" data-testid="salary-status">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest inline-flex ${
                    s.status === 'finalized' || s.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                    s.status === 'confirmed' ? 'bg-blue-50 text-blue-600' :
                    s.status === 'disputed' ? 'bg-rose-50 text-rose-600' :
                    s.status === 'published' || s.status === 'pending' || s.status === 'pending_approval' ? 'bg-amber-50 text-amber-600' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {(s.status === 'finalized' || s.status === 'approved') ? <CheckCircle2 className="w-3 h-3" /> :
                     s.status === 'confirmed' ? <CheckCircle2 className="w-3 h-3" /> :
                     s.status === 'disputed' ? <AlertCircle className="w-3 h-3" /> :
                     <AlertCircle className="w-3 h-3" />}
                    {s.status === 'finalized' ? 'Đã chốt sổ' :
                     s.status === 'approved' ? 'Đã duyệt' :
                     s.status === 'confirmed' ? `${vocab.worker.short} đã xác nhận` :
                     s.status === 'disputed' ? `${vocab.worker.short} phản hồi` :
                     s.status === 'published' || s.status === 'pending_approval' ? `Chờ ${vocab.worker.short} xác nhận` :
                     'Bản nháp'}
                  </div>
                </td>
                <td className="px-8 py-6 whitespace-nowrap">
                  {isNotKtv && s.status !== 'approved' && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => router.push(`/dashboard/salary/${s.id}/detail?month=${currentMonth}`)}
                        className="p-3 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground rounded-xl transition-all shadow-sm"
                        title="Xem chi tiết lương"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      {canRecalculate && (
                        <button
                          onClick={() => handleRecalculate(s.id, s.name)}
                          disabled={isActionBlocked}
                          className="p-3 bg-cyan-50 text-cyan-600 hover:bg-cyan-600 hover:text-white rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:pointer-events-none"
                          title={isRecalculating ? 'Đang tính lại' : 'Tính lại'}
                        >
                          {isRecalculating ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                        </button>
                      )}
                      <button 
                        onClick={() => openEditModal(s)}
                        className="p-3 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-xl transition-all shadow-sm"
                        title="Chỉnh sửa lương"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button 
                        onClick={() => handleApprove(s.id, s.name)}
                        disabled={isActionBlocked}
                        className="p-3 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:pointer-events-none"
                        title={isApproving ? 'Đang phê duyệt' : 'Phê duyệt'}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleExport(s)}
                        disabled={isExportBlocked}
                        className="p-3 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:pointer-events-none"
                        title={isExporting ? 'Đang xuất báo cáo' : 'Xuất báo cáo chi tiết'}
                      >
                        {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                      </button>
                    </div>
                  )}
                  {!isNotKtv && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => router.push(`/dashboard/salary/${s.id}/detail?month=${currentMonth}`)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground rounded-xl transition-all font-bold text-xs"
                        title="Xem chi tiết lương"
                      >
                        <Eye className="w-4 h-4" />
                        Chi tiết
                      </button>
                      <button 
                        onClick={() => handleExport(s)}
                        disabled={isExportBlocked}
                        className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground rounded-xl transition-all font-bold text-xs disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        {isExporting ? 'Đang xuất' : 'Xuất báo cáo'}
                      </button>
                    </div>
                  )}
                </td>
              </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Salary Detail Modal */}
      {viewingSalary && currentUser?.tenant_id && (
        <SalaryDetailModal
          isOpen={!!viewingSalary}
          onClose={() => setViewingSalary(null)}
          salary={viewingSalary}
          tenantId={currentUser.tenant_id}
          currentMonth={currentMonth}
        />
      )}
    </div>
  );
}
