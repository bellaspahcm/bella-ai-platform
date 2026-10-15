'use client';

import { motion } from 'framer-motion';
import { KtvSalaryRecord } from '@/types/domain';
import { AdjustmentsBreakdown } from '@/components/salary/AdjustmentsBreakdown';
import { useTenantContext } from '@/core/hooks/useTenantContext';

interface EditSalaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingSalary: KtvSalaryRecord | null;
  setEditingSalary: (s: KtvSalaryRecord) => void;
  handleSaveConfig: () => Promise<void>;
  isSaving: boolean;
}

function getCurrentMonthString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).substring(0, 7);
}

export default function EditSalaryModal({
  isOpen,
  onClose,
  editingSalary,
  setEditingSalary,
  handleSaveConfig,
  isSaving,
}: EditSalaryModalProps) {
  const tenantContext = useTenantContext();
  
  if (!isOpen || !editingSalary) return null;

  const currentMonth = getCurrentMonthString();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-sm sm:p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-[28px] bg-white shadow-2xl sm:rounded-[32px]"
      >
        <div className="max-h-[calc(92vh-6.5rem)] overflow-y-auto p-5 sm:p-8">
          <h3 className="mb-5 text-xl font-black text-slate-900 sm:mb-6 sm:text-2xl">Chỉnh sửa Lương</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Basic Salary Adjustments */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-black text-slate-700 uppercase tracking-widest mb-1 block">Lương cứng (đ)</label>
                <input 
                  type="number" 
                  value={editingSalary.baseSalary} 
                  onChange={e => setEditingSalary({...editingSalary, baseSalary: Number(e.target.value)})}
                  className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-black text-slate-700 uppercase tracking-widest mb-1 block">Thưởng KPI (đ)</label>
                <input 
                  type="number" 
                  value={editingSalary.kpiBonus} 
                  onChange={e => setEditingSalary({...editingSalary, kpiBonus: Number(e.target.value)})}
                  className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-black text-slate-700 uppercase tracking-widest mb-1 block">Phạt (đ)</label>
                <input 
                  type="number" 
                  value={editingSalary.deductions} 
                  onChange={e => setEditingSalary({...editingSalary, deductions: Number(e.target.value)})}
                  className="w-full bg-rose-50 border-none rounded-xl px-4 py-3 font-bold text-rose-600 focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-black text-slate-700 uppercase tracking-widest mb-1 block">Tạm ứng (đ)</label>
                <input 
                  type="number" 
                  value={editingSalary.advances} 
                  onChange={e => setEditingSalary({...editingSalary, advances: Number(e.target.value)})}
                  className="w-full bg-rose-50 border-none rounded-xl px-4 py-3 font-bold text-rose-600 focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
            </div>

            {/* Right Column: Manual Adjustments Breakdown */}
            <div className="border-l border-slate-100 pl-6">
              <AdjustmentsBreakdown
                ktvId={editingSalary.id}
                month={currentMonth}
                tenantId={tenantContext.tenantId}
              />
            </div>
          </div>
        </div>
        <div className="flex gap-3 border-t border-slate-100 bg-slate-50 p-4 sm:p-6">
          <button 
            onClick={onClose}
            className="flex-1 py-4 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all"
          >
            Hủy bỏ
          </button>
          <button 
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="flex-1 py-4 bg-primary text-primary-foreground font-black rounded-2xl hover:bg-primary-hover shadow-lg shadow-primary/20 dark:shadow-none transition-all disabled:opacity-50"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
