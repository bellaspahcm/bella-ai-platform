'use client';

import { motion } from 'framer-motion';
import { Calendar as CalendarIcon, FileSpreadsheet, Lock, CheckCircle2, AlertCircle, Clock, Send, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';
import { KtvSessionMatrix, KtvSalaryRecord } from '@/types/domain';

interface SessionMatrixTableProps {
  matrixData: KtvSessionMatrix | null;
  searchQuery: string;
  ktvSalaries: KtvSalaryRecord[];
  isExportingMatrix: boolean;
  activeSalaryAction: string | null;
  handleExportMatrix: () => Promise<void>;
  handleFinalizeOne: (id: string, name: string) => void;
  handleConfirmOnBehalf: (id: string, name: string) => void;
  handlePublishOne: (id: string, name: string) => void;
}

function getPackageCount(ktv: KtvSessionMatrix['ktvs'][number], packageName: string) {
  const value = ktv[packageName];
  return typeof value === 'number' ? value : 0;
}

export default function SessionMatrixTable({
  matrixData,
  searchQuery,
  ktvSalaries,
  isExportingMatrix,
  activeSalaryAction,
  handleExportMatrix,
  handleFinalizeOne,
  handleConfirmOnBehalf,
  handlePublishOne,
}: SessionMatrixTableProps) {
  const vocab = useModuleVocabulary();
  
  if (!matrixData) return null;

  const filteredKtvs = matrixData.ktvs.filter((ktv) =>
    ktv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mb-6 overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm md:mb-10 md:rounded-[40px]">
      <div className="bella-toolbar flex flex-col gap-4 border-b border-slate-50 p-4 sm:p-6 md:flex-row md:items-center md:justify-between md:p-8">
        <div>
          <h2 className="flex items-center gap-3 text-lg font-black tracking-tight text-slate-900 sm:text-2xl">
            <CalendarIcon className="h-6 w-6 shrink-0 text-primary sm:h-8 sm:w-8" />
            Đối soát số buổi làm chi tiết
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Chi tiết {vocab.workUnit.plural.toLowerCase()} thực hiện theo từng {vocab.worker.singular.toLowerCase()} và gói dịch vụ
          </p>
        </div>
        <button
          onClick={handleExportMatrix}
          disabled={isExportingMatrix || !matrixData}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary/10 px-5 py-3 text-xs font-black uppercase tracking-widest text-primary transition-all hover:bg-primary hover:text-primary-foreground disabled:opacity-50 sm:px-6"
        >
          <FileSpreadsheet className="w-5 h-5" />
          <span>Xuất file đối soát</span>
        </button>
      </div>

      <div className="overflow-x-auto overscroll-x-contain custom-scrollbar shadow-[inset_-18px_0_18px_-18px_rgba(15,23,42,0.32)]">
        <table className="bella-data-table min-w-[72rem] text-left">
          <thead>
            <tr className="bg-slate-50/80 backdrop-blur-md">
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[200px] bg-slate-50">
                {vocab.worker.singular}
              </th>
              {matrixData.packageNames.map((pkg: string) => (
                <th
                  key={pkg}
                  className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[150px] text-center"
                >
                  {pkg}
                </th>
              ))}
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[120px] text-center bg-slate-100/50">
                Tổng buổi
              </th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[180px] text-center">
                Trạng thái đối soát
              </th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[200px] text-center">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredKtvs.map((ktv, index) => (
              <motion.tr
                key={ktv.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  'hover:bg-slate-50/50 transition-colors group',
                  ktv.isConfirmed && 'bg-emerald-50/30 opacity-90'
                )}
                data-testid="salary-matrix-row"
                data-ktv-id={ktv.id}
              >
                <td className="px-8 py-6 whitespace-nowrap bg-white group-hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-black text-xs">
                      {ktv.name.charAt(0)}
                    </div>
                    <span className="font-bold text-slate-900">{ktv.name}</span>
                  </div>
                </td>
                {matrixData.packageNames.map((pkg: string) => {
                  const packageCount = getPackageCount(ktv, pkg);
                  return (
                    <td key={pkg} className="px-8 py-6 text-center whitespace-nowrap">
                      <span className={cn('font-black text-sm', packageCount > 0 ? 'text-primary' : 'text-slate-300')}>
                        {packageCount}
                      </span>
                    </td>
                  );
                })}
                <td className="px-8 py-6 text-center whitespace-nowrap bg-slate-50/30">
                  <span className="font-black text-slate-900 text-lg">
                    {matrixData.packageNames.reduce((acc: number, pkg: string) => acc + getPackageCount(ktv, pkg), 0)}
                  </span>
                </td>
                {/* Status column */}
                <td className="px-8 py-6 text-center whitespace-nowrap">
                  {(() => {
                    const salaryRow = ktvSalaries.find((s) => s.id === ktv.id);
                    const st = salaryRow?.status;
                    if (st === 'finalized' || st === 'approved') {
                      return (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg text-[10px] font-black">
                          <Lock className="w-3 h-3" />
                          Đã chốt sổ
                        </span>
                      );
                    }
                    if (st === 'confirmed') {
                      return (
                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[10px] font-black">
                          <CheckCircle2 className="w-3 h-3" />
                          {vocab.worker.short} đã xác nhận
                        </span>
                      );
                    }
                    if (st === 'disputed') {
                      return (
                        <div className="text-left">
                          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-600 px-3 py-1 rounded-lg text-[10px] font-black mb-1">
                            <AlertCircle className="w-3 h-3" />
                            {vocab.worker.short} phản hồi
                          </span>
                          {salaryRow?.disputeReason && (
                            <p className="text-[10px] text-rose-500 max-w-[160px] truncate" title={salaryRow.disputeReason}>
                              {salaryRow.disputeReason}
                            </p>
                          )}
                        </div>
                      );
                    }
                    if (st === 'published' || st === 'pending_approval') {
                      return (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 px-3 py-1 rounded-lg text-[10px] font-black">
                          <Clock className="w-3 h-3" />
                          Chờ {vocab.worker.short} xác nhận
                        </span>
                      );
                    }
                    return <span className="text-slate-300 text-[10px]">—</span>;
                  })()}
                </td>
                {/* Action column */}
                <td className="px-8 py-6 text-center whitespace-nowrap">
                  <div className="flex items-center justify-center gap-2">
                    {(() => {
                      const salaryRow = ktvSalaries.find((s) => s.id === ktv.id);
                      const st = salaryRow?.status;
                      const isActionBlocked = activeSalaryAction !== null;
                      const actionButtonClassName =
                        'flex items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:pointer-events-none';
                      if (st === 'finalized' || st === 'approved') return <span className="text-slate-300 text-[10px]">Hoàn tất</span>;
                      if (st === 'confirmed') {
                        return (
                          <button
                            onClick={() => handleFinalizeOne(ktv.id, ktv.name)}
                            disabled={isActionBlocked}
                            data-testid="salary-finalize-one-button"
                            className={`${actionButtonClassName} bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white`}
                          >
                            <Lock className="w-3 h-3" />
                            {activeSalaryAction === `finalize:${ktv.id}` ? 'Đang xử lý' : 'Chốt sổ'}
                          </button>
                        );
                      }
                      if (st === 'published' || st === 'pending_approval') {
                        return (
                          <button
                            onClick={() => handleConfirmOnBehalf(ktv.id, ktv.name)}
                            disabled={isActionBlocked}
                            data-testid="salary-confirm-one-button"
                            className={`${actionButtonClassName} bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white`}
                          >
                            <UserCheck className="w-3 h-3" />
                            {activeSalaryAction === `confirm:${ktv.id}` ? 'Đang xử lý' : 'Xác nhận thay'}
                          </button>
                        );
                      }
                      if (st === 'disputed') {
                        return (
                          <button
                            onClick={() => handlePublishOne(ktv.id, ktv.name)}
                            disabled={isActionBlocked}
                            data-testid="salary-publish-one-button"
                            className={`${actionButtonClassName} bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white`}
                          >
                            <Send className="w-3 h-3" />
                            {activeSalaryAction === `publish:${ktv.id}` ? 'Đang xử lý' : 'Gửi lại'}
                          </button>
                        );
                      }
                      return (
                        <button
                          onClick={() => handlePublishOne(ktv.id, ktv.name)}
                          disabled={isActionBlocked}
                          data-testid="salary-publish-one-button"
                          className={`${actionButtonClassName} bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white`}
                        >
                          <Send className="w-3 h-3" />
                          {activeSalaryAction === `publish:${ktv.id}` ? 'Đang xử lý' : 'Gửi đối soát'}
                        </button>
                      );
                    })()}
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
