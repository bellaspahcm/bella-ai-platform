'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { adminUpdateKtvHrProfile } from '@/services/attendance-actions';
import { toast } from 'sonner';
import { KtvSalaryRecord } from '@/types/domain';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

const HR_STATUS_OPTIONS = [
  { value: 'active', label: 'Đang làm việc (Active)' },
  { value: 'inactive', label: 'Đã nghỉ việc (Inactive)' },
];

interface HrProfileEditorProps {
  isOpen: boolean;
  onClose: () => void;
  hrKtvProfile: KtvSalaryRecord | null;
  onSaveSuccess: () => void;
}

export default function HrProfileEditor({
  isOpen,
  onClose,
  hrKtvProfile,
  onSaveSuccess,
}: HrProfileEditorProps) {
  const [hrBaseSalary, setHrBaseSalary] = useState(0);
  const [hrHireDate, setHrHireDate] = useState('');
  const [hrResignDate, setHrResignDate] = useState('');
  const [hrStatus, setHrStatus] = useState('active');
  const [isHrSaving, setIsHrSaving] = useState(false);

  useEffect(() => {
    if (hrKtvProfile) {
      setHrBaseSalary(hrKtvProfile.baseSalary);
      setHrHireDate(hrKtvProfile.hireDate || '');
      setHrResignDate(hrKtvProfile.resignationDate || '');
      setHrStatus(hrKtvProfile.status || 'active');
    }
  }, [hrKtvProfile]);

  if (!isOpen || !hrKtvProfile) return null;

  const handleSaveHrProfile = async () => {
    setIsHrSaving(true);
    const res = await adminUpdateKtvHrProfile(hrKtvProfile.id, {
      base_salary: hrBaseSalary,
      hire_date: hrHireDate || null,
      resignation_date: hrResignDate || null,
      status: hrStatus,
    });

    if (res.success) {
      toast.success('Cập nhật thông tin nhân sự thành công!');
      onSaveSuccess();
      onClose();
    } else {
      toast.error('Lỗi: ' + res.error);
    }
    setIsHrSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-sm sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-h-[92vh] w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl sm:rounded-[32px]"
      >
        <div className="max-h-[calc(92vh-6.5rem)] overflow-y-auto p-5 sm:p-8">
          <h3 className="mb-5 text-xl font-black text-slate-900 sm:mb-6 sm:text-2xl">Thiết lập nhân sự (HR)</h3>
          <p className="text-slate-500 font-bold text-sm mb-6">
            Hồ sơ kỹ thuật viên: <span className="text-primary font-black">{hrKtvProfile.name}</span>
          </p>

          <div className="space-y-5">
            <div>
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">
                Lương cứng cơ bản (Cố định)
              </label>
              <input
                type="number"
                value={hrBaseSalary}
                onChange={(e) => setHrBaseSalary(Number(e.target.value))}
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">
                Ngày nhận việc chính thức
              </label>
              <input
                type="date"
                value={hrHireDate}
                onChange={(e) => setHrHireDate(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">
                Ngày thôi việc
              </label>
              <input
                type="date"
                value={hrResignDate}
                onChange={(e) => setHrResignDate(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">
                Trạng thái nhân sự
              </label>
              <PremiumSelect
                value={hrStatus}
                onChange={setHrStatus}
                options={HR_STATUS_OPTIONS}
                ariaLabel="Chọn trạng thái nhân sự"
                className="space-y-0"
                buttonClassName="rounded-xl border-transparent bg-slate-50 px-4 py-3 font-bold shadow-none hover:border-primary/20"
                dropdownClassName="min-w-full"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-100 bg-slate-50 p-4 sm:p-6">
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all text-sm"
          >
            Hủy bỏ
          </button>
          <button
            onClick={handleSaveHrProfile}
            disabled={isHrSaving}
            className="flex-1 py-4 bg-primary text-primary-foreground font-black rounded-2xl hover:bg-primary-hover shadow-lg shadow-primary/20 dark:shadow-none transition-all disabled:opacity-50 text-sm"
          >
            {isHrSaving ? 'Đang lưu...' : 'Lưu thông tin'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
