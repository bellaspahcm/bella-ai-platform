'use client';

import { motion } from 'framer-motion';
import { UserCog } from 'lucide-react';
import { KtvSalaryRecord } from '@/types/domain';

interface HrProfileTableProps {
  ktvSalaries: KtvSalaryRecord[];
  openHrEditModal: (ktv: KtvSalaryRecord) => void;
}

export default function HrProfileTable({
  ktvSalaries,
  openHrEditModal,
}: HrProfileTableProps) {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm md:rounded-[40px]">
      <div className="flex flex-col gap-4 border-b border-slate-50 p-4 sm:p-6 md:flex-row md:items-center md:justify-between md:p-8">
        <div>
          <h2 className="flex items-center gap-3 text-lg font-black tracking-tight text-slate-900 sm:text-2xl">
            <UserCog className="h-6 w-6 shrink-0 text-primary sm:h-8 sm:w-8" />
            Quản lý hồ sơ nhân sự (HR)
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Cấu hình lương cứng cơ bản, ngày nhận việc, ngày thôi việc và trạng thái hoạt động
          </p>
        </div>
      </div>
      
      <div className="overflow-x-auto overscroll-x-contain custom-scrollbar shadow-[inset_-18px_0_18px_-18px_rgba(15,23,42,0.32)]">
        <table className="bella-data-table min-w-[68rem] text-left">
          <thead>
            <tr className="bg-slate-50/80 backdrop-blur-md">
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[200px]">
                Kỹ thuật viên
              </th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                Lương cơ bản (Cứng)
              </th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                Ngày nhận việc
              </th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                Ngày thôi việc
              </th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">
                Trạng thái
              </th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {ktvSalaries.map((s, idx) => (
              <motion.tr
                key={s.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="hover:bg-slate-50/50 transition-colors"
              >
                <td className="px-8 py-6 whitespace-nowrap">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-black">
                      {s.name.charAt(0)}
                    </div>
                    <span className="font-bold text-slate-900">{s.name}</span>
                  </div>
                </td>
                <td className="px-8 py-6 whitespace-nowrap font-black text-slate-700">
                  {s.baseSalary?.toLocaleString()}đ
                </td>
                <td className="px-8 py-6 whitespace-nowrap text-sm font-bold text-slate-500">
                  {s.hireDate ? new Date(s.hireDate).toLocaleDateString('vi-VN') : '—'}
                </td>
                <td className="px-8 py-6 whitespace-nowrap text-sm font-bold text-slate-500">
                  {s.resignationDate ? new Date(s.resignationDate).toLocaleDateString('vi-VN') : '—'}
                </td>
                <td className="px-8 py-6 whitespace-nowrap text-center">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    s.status !== 'inactive' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {s.status !== 'inactive' ? 'Đang hoạt động' : 'Đã nghỉ việc'}
                  </span>
                </td>
                <td className="px-8 py-6 text-center whitespace-nowrap">
                  <button
                    onClick={() => openHrEditModal(s)}
                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                  >
                    Thiết lập HR
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
