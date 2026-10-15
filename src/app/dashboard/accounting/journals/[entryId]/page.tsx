'use client';

import SkeletonLoader from '@/components/ui/SkeletonLoader';
import { getJournalEntryDetails,reverseJournalEntry } from '@/services/accounting-actions';
import { AnimatePresence,motion } from 'framer-motion';
import {
AlertTriangle,
ArrowLeft,
Calendar,
CheckCircle2,
Layers,
Scale,
Trash2,
User,
X
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use,useCallback,useEffect,useState } from 'react';
import { toast } from 'sonner';
import { getAccountingErrorMessage as getErrorMessage } from '@/lib/accounting-error-message';

type JournalEntryDetails = Awaited<ReturnType<typeof getJournalEntryDetails>>;
type JournalLineRow = NonNullable<JournalEntryDetails['journal_lines']>[number];

const tableWrapperClassName =
  'w-full overflow-x-auto overscroll-x-contain rounded-2xl shadow-[inset_-18px_0_18px_-18px_rgba(15,23,42,0.45)] dark:shadow-[inset_-18px_0_18px_-18px_rgba(239,233,225,0.28)]';
const tableClassName = 'w-max min-w-[48rem] border-collapse whitespace-nowrap';
const stickyHeaderCellClassName =
  'bg-slate-50 dark:bg-[#11100F]';
const stickyBodyCellClassName =
  'bg-inherit';

interface PageProps {
  params: Promise<{ entryId: string }>;
}

export default function JournalEntryDetailsPage({ params }: PageProps) {
  const router = useRouter();
  const { entryId } = use(params);

  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState<JournalEntryDetails | null>(null);
  
  // Reversal dialog states
  const [isReversing, setIsReversing] = useState(false);
  const [reversalReason, setReversalReason] = useState('');
  const [submittingReversal, setSubmittingReversal] = useState(false);

  const fetchDetails = useCallback(async () => {
    try {
      const data = await getJournalEntryDetails(entryId);
      setEntry(data);
    } catch (err: unknown) {
      console.error('Error fetching journal details:', err);
      toast.error('Không thể tải chi tiết bút toán này.');
      router.push('/dashboard/accounting/journals');
    } finally {
      setLoading(false);
    }
  }, [entryId, router]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalReason.trim()) {
      toast.warning('Vui lòng cung cấp lý do đảo bút toán.');
      return;
    }

    setSubmittingReversal(true);
    try {
      const res = await reverseJournalEntry(entryId, reversalReason.trim());
      if (res.success) {
        toast.success('Bút toán đảo ngược đã được tạo và ghi sổ thành công!');
        setIsReversing(false);
        setReversalReason('');
        fetchDetails(); // Reload page
      }
    } catch (err: unknown) {
      console.error('Reversal failed:', err);
      toast.error(getErrorMessage(err, 'Lỗi khi đảo bút toán.'));
    } finally {
      setSubmittingReversal(false);
    }
  };

  if (loading) {
    return <SkeletonLoader variant="rectangular" className="h-96" />;
  }

  if (!entry) {
    return (
      <div className="py-20 text-center text-slate-400 bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-primary/15 dark:border-[#3E3A35]/50">
        <AlertTriangle className="w-12 h-12 mx-auto text-slate-300 mb-3 animate-bounce" />
        <p className="font-extrabold uppercase text-xs tracking-wider">Không tìm thấy bút toán tương ứng</p>
      </div>
    );
  }

  // Calculate totals
  const totalDebit = entry.journal_lines?.reduce((sum: number, l: JournalLineRow) => sum + Number(l.debit_amount || 0), 0) || 0;
  const totalCredit = entry.journal_lines?.reduce((sum: number, l: JournalLineRow) => sum + Number(l.credit_amount || 0), 0) || 0;

  // Status badges
  const statusColors: Record<string, string> = {
    'DRAFT': 'bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-400 border-yellow-100/50',
    'POSTED': 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-100/50',
    'CANCELED': 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border-red-100/50',
  };

  return (
    <div className="space-y-8">
      {/* ── RETURN NAVIGATION LINK ── */}
      <Link href="/dashboard/accounting/journals" className="inline-flex items-center gap-2 text-xs font-black text-slate-400 hover:text-primary dark:text-[#CDBCAB]/80 dark:hover:text-[#EFE9E1] transition-colors uppercase tracking-widest cursor-pointer">
        <ArrowLeft className="w-4 h-4" />
        Trở lại Sổ nhật ký
      </Link>

      {/* ── CARD HEADER: METADATA ── */}
      <div className="bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-primary/15 dark:border-[#3E3A35]/50 p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`px-3 py-1.5 rounded-full text-4xs font-black uppercase tracking-wider border ${statusColors[entry.status]}`}>
              {entry.status === 'POSTED' ? 'Đã ghi sổ (POSTED)' : entry.status === 'CANCELED' ? 'Đã hủy đảo (CANCELED)' : 'Bản nháp (DRAFT)'}
            </span>
            <span className="px-2.5 py-1.5 bg-slate-50 dark:bg-[#11100F] border border-slate-100 dark:border-none rounded-lg text-4xs font-black text-slate-400 dark:text-[#CDBCAB]/70 uppercase tracking-widest">
              {entry.reference_type || 'N/A'}
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-[#EFE9E1] leading-tight">{entry.description}</h2>
        </div>

        {/* Action Button: Reversal */}
        {entry.status === 'POSTED' && (
          <button 
            onClick={() => setIsReversing(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-none bg-red-600 px-6 py-3.5 text-3xs font-black uppercase tracking-widest text-white shadow-lg shadow-red-100 transition-all hover:bg-red-500 active:scale-95 md:w-auto md:shrink-0"
          >
            <Trash2 className="w-4 h-4" />
            <span>Đảo bút toán (Reversal)</span>
          </button>
        )}
      </div>

      {/* ── BENTO DETAILS GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Entry Date */}
        <div className="bg-white dark:bg-[#1C1B19] rounded-[2rem] border border-primary/15 dark:border-[#3E3A35]/50 p-6 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-pink-50 dark:bg-primary/5 flex items-center justify-center text-primary dark:text-primary shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-4xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest block">Ngày ghi nhận</span>
            <span className="font-mono text-xs font-black text-slate-800 dark:text-[#EFE9E1]">{entry.entry_date}</span>
          </div>
        </div>

        {/* Voucher ID */}
        <div className="bg-white dark:bg-[#1C1B19] rounded-[2rem] border border-primary/15 dark:border-[#3E3A35]/50 p-6 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-pink-50 dark:bg-primary/5 flex items-center justify-center text-primary dark:text-primary shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-4xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest block">Mã bút toán</span>
            <span className="font-mono text-xs font-black text-slate-800 dark:text-[#EFE9E1] truncate block max-w-56">{entry.id}</span>
          </div>
        </div>

        {/* Created By user */}
        <div className="bg-white dark:bg-[#1C1B19] rounded-[2rem] border border-primary/15 dark:border-[#3E3A35]/50 p-6 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-pink-50 dark:bg-primary/5 flex items-center justify-center text-primary dark:text-primary shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div>
            <span className="text-4xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest block">Người kiểm soát</span>
            <span className="text-xs font-black text-slate-800 dark:text-[#EFE9E1]">Branch Auditor</span>
          </div>
        </div>
      </div>

      {/* ── BÚT TOÁN LINES TABLE ── */}
      <div className="bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-primary/15 dark:border-[#3E3A35]/50 p-6 md:p-8 shadow-sm">
        <h4 className="text-sm font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wider mb-6 pb-3 border-b border-slate-50 dark:border-[#3E3A35]/30 flex items-center gap-2">
          <Scale className="w-5 h-5 text-primary" />
          Chi tiết định khoản Nợ / Có
        </h4>

        <div className={tableWrapperClassName}>
          <table className={tableClassName}>
            <thead>
              <tr className="text-left bg-slate-50/50 dark:bg-[#11100F]/40 border-b border-slate-100 dark:border-[#3E3A35]/30">
                <th className={`${stickyHeaderCellClassName} px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest`}>Tài khoản</th>
                <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Tên tài khoản</th>
                <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-right">Số phát sinh Nợ</th>
                <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-right">Số phát sinh Có</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-[#3E3A35]/20">
              {entry.journal_lines?.map((line: JournalLineRow) => (
                <tr key={line.id} className="hover:bg-slate-50/10 dark:hover:bg-[#11100F]/10 transition-colors">
                  <td className={`${stickyBodyCellClassName} px-6 py-4`}>
                    <span className="font-mono font-black text-slate-800 dark:text-[#EFE9E1] px-2.5 py-1 bg-slate-100 dark:bg-[#3E3A35] rounded-lg">
                      {line.accounting_accounts?.account_code}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-semibold text-slate-700 dark:text-[#CDBCAB]">
                    {line.accounting_accounts?.account_name}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-mono text-xs font-black ${line.debit_amount > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                      {line.debit_amount > 0 ? `${Number(line.debit_amount).toLocaleString('vi-VN')}đ` : '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-mono text-xs font-black ${line.credit_amount > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                      {line.credit_amount > 0 ? `${Number(line.credit_amount).toLocaleString('vi-VN')}đ` : '-'}
                    </span>
                  </td>
                </tr>
              ))}

              {/* Aggregation Totals row */}
              <tr className="bg-slate-50/50 dark:bg-[#11100F]/50 font-black border-t border-slate-200 dark:border-[#3E3A35]">
                <td colSpan={2} className={`${stickyBodyCellClassName} px-6 py-5 text-xs text-slate-800 dark:text-[#EFE9E1] uppercase tracking-wider`}>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  Tổng phát sinh cân đối
                </td>
                <td className="px-6 py-5 text-right font-mono text-emerald-600 text-xs">
                  {totalDebit.toLocaleString('vi-VN')}đ
                </td>
                <td className="px-6 py-5 text-right font-mono text-rose-600 text-xs">
                  {totalCredit.toLocaleString('vi-VN')}đ
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── REVERSAL ACTION DIALOG MODAL ── */}
      <AnimatePresence>
        {isReversing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Dark overlay backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReversing(false)}
              className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-xs"
            />

            {/* Modal Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-primary/15 dark:border-[#3E3A35] shadow-2xl p-8 max-w-md w-full relative z-10 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-50 dark:border-[#3E3A35]/30 pb-4">
                <h4 className="text-lg font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wide flex items-center gap-2 text-red-500">
                  <Trash2Icon className="w-5.5 h-5.5" />
                  Xác nhận đảo bút toán
                </h4>
                <button 
                  onClick={() => setIsReversing(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#11100F] text-slate-400 hover:text-slate-600 transition-colors border-none cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs font-semibold text-slate-500 dark:text-[#CDBCAB]/70 leading-relaxed">
                Hành động này sẽ đảo ngược hoàn toàn dòng định khoản Nợ / Có của bút toán này bằng một bút toán mới tương ứng, đồng thời thay đổi trạng thái của bút toán này thành <span className="text-red-500 font-bold uppercase">CANCELED</span>. Việc này là vĩnh viễn và không thể khôi phục.
              </p>

              <form onSubmit={handleReversal} className="space-y-4">
                {/* Reversal Reason */}
                <div className="space-y-1.5">
                  <label className="text-2xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Lý do hủy đảo (Bắt buộc)</label>
                  <textarea 
                    rows={3}
                    placeholder="Nhập lý do điều chỉnh..." 
                    value={reversalReason}
                    onChange={(e) => setReversalReason(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-[#11100F] border border-slate-100 dark:border-[#3E3A35] rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 text-slate-800 dark:text-[#EFE9E1] resize-none"
                  />
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-slate-50 dark:border-[#3E3A35]/30">
                  <button 
                    type="button" 
                    onClick={() => setIsReversing(false)}
                    className="flex-1 bg-slate-50 dark:bg-[#11100F] border border-slate-200/50 dark:border-[#3E3A35]/50 hover:bg-slate-100 dark:hover:bg-[#1C1B19] text-slate-700 dark:text-[#CDBCAB] py-4 rounded-2xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button 
                    type="submit" 
                    disabled={submittingReversal}
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-red-100 disabled:opacity-50 cursor-pointer border-none"
                  >
                    {submittingReversal ? 'Đang đảo...' : 'Xác nhận đảo'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Trash2Icon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
