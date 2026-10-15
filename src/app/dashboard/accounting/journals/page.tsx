'use client';

import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { SkeletonTable } from '@/components/ui/SkeletonLoader';
import { getCachedJournalEntriesForPage } from '@/lib/accounting-subpages-client-cache';
import { getJournalEntries } from '@/services/accounting-actions';
import { motion } from 'framer-motion';
import {
AlertTriangle,
Eye,
Layers,
RefreshCw,
Search
} from 'lucide-react';
import Link from 'next/link';
import { useCallback,useEffect,useState } from 'react';
import { toast } from 'sonner';
import { usePageRefresh } from '@/hooks/usePageRefresh';

type JournalEntryRow = Awaited<ReturnType<typeof getJournalEntries>>[number];
type JournalLineRow = NonNullable<JournalEntryRow['journal_lines']>[number];
type JournalFilters = NonNullable<Parameters<typeof getJournalEntries>[0]>;

const dateInputClassName =
  'h-11 w-full min-w-0 max-w-full appearance-none truncate rounded-xl border border-slate-100 bg-slate-50 px-4 pr-3 text-xs font-bold text-slate-800 outline-none [color-scheme:light] dark:border-[#3E3A35]/50 dark:bg-[#11100F] dark:text-[#EFE9E1] dark:[color-scheme:dark]';
const fieldLabelClassName =
  'text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/50 uppercase tracking-wider block whitespace-nowrap';
const tableWrapperClassName =
  'w-full overflow-x-auto overscroll-x-contain rounded-2xl shadow-[inset_-18px_0_18px_-18px_rgba(15,23,42,0.45)] dark:shadow-[inset_-18px_0_18px_-18px_rgba(239,233,225,0.28)]';
const tableClassName = 'bella-data-table min-w-[82rem] whitespace-nowrap';
const stickyHeaderCellClassName =
  'bg-slate-50 dark:bg-[#11100F]';
const stickyBodyCellClassName =
  'bg-inherit';

export default function JournalsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entries, setEntries] = useState<JournalEntryRow[]>([]);

  // Filter states
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14); // Default past 2 weeks
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'POSTED' | 'CANCELED'>('ALL');
  const [refTypeFilter, setRefTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchJournals = useCallback(async (options: { force?: boolean } = {}) => {
    setRefreshing(true);
    try {
      const filters: JournalFilters = {
        from_date: fromDate,
        to_date: toDate,
      };
      if (statusFilter !== 'ALL') {
        filters.status = statusFilter;
      }
      if (refTypeFilter !== 'all') {
        filters.reference_type = refTypeFilter;
      }

      const data = await getCachedJournalEntriesForPage(filters, options);
      setEntries(data || []);
    } catch (err: unknown) {
      console.error('Error fetching journals:', err);
      toast.error('Không thể tải nhật ký chứng từ sổ cái.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fromDate, refTypeFilter, statusFilter, toDate]);

  useEffect(() => {
    fetchJournals();
  }, [fetchJournals]);

  const handleSoftRefresh = useCallback(async () => {
    await fetchJournals({ force: true });
  }, [fetchJournals]);

  usePageRefresh(handleSoftRefresh);

  // Client side search filter
  const filteredEntries = entries.filter((e) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesDescription = e.description?.toLowerCase().includes(searchLower);
    const matchesReferenceId = e.reference_id?.toLowerCase().includes(searchLower);
    const matchesLines = e.journal_lines?.some(
      (line: JournalLineRow) =>
        line.accounting_accounts?.account_code?.includes(searchLower) ||
        line.accounting_accounts?.account_name?.toLowerCase().includes(searchLower)
    );
    return matchesDescription || matchesReferenceId || matchesLines;
  });

  return (
    <div className="space-y-8 relative">
      {/* Synchronization Loader spinner */}
      {refreshing && (
        <div className="absolute top-0 right-0 flex items-center gap-1.5 text-xs font-semibold text-primary dark:text-primary animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Đang tải...</span>
        </div>
      )}

      {/* ── SEARCH FILTERS & QUICK ACTIONS ── */}
      <div className="bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-primary/15 dark:border-[#3E3A35]/50 p-5 sm:p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[repeat(2,minmax(10.75rem,12rem))_minmax(12rem,1fr)_minmax(14rem,1.35fr)_minmax(16rem,1.35fr)]">
          {/* Start Date */}
          <div className="min-w-0 space-y-1">
            <span className={fieldLabelClassName}>Từ ngày</span>
            <div className="relative">
              <input 
                type="date" 
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className={dateInputClassName}
              />
            </div>
          </div>

          {/* End Date */}
          <div className="min-w-0 space-y-1">
            <span className={fieldLabelClassName}>Đến ngày</span>
            <div className="relative">
              <input 
                type="date" 
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className={dateInputClassName}
              />
            </div>
          </div>

          {/* Status filter */}
          <div className="space-y-1">
            <span className={fieldLabelClassName}>Trạng thái</span>
            <PremiumSelect
              value={statusFilter}
              onChange={(val) => {
                if (val === 'DRAFT' || val === 'POSTED' || val === 'CANCELED' || val === 'ALL') {
                  setStatusFilter(val);
                }
              }}
              options={[
                { value: 'ALL', label: 'Tất cả trạng thái' },
                { value: 'DRAFT', label: 'Nháp (DRAFT)' },
                { value: 'POSTED', label: 'Đã ghi sổ (POSTED)' },
                { value: 'CANCELED', label: 'Đã hủy đảo (CANCELED)' },
              ]}
              className="w-full text-xs"
            />
          </div>

          {/* Reference type filter */}
          <div className="space-y-1">
            <span className={fieldLabelClassName}>Loại nghiệp vụ</span>
            <PremiumSelect
              value={refTypeFilter}
              onChange={(val) => setRefTypeFilter(val)}
              options={[
                { value: 'all', label: 'Tất cả nghiệp vụ' },
                { value: 'PACKAGE_SALE', label: 'Bán gói liệu trình' },
                { value: 'SESSION_DONE', label: 'Khách ca trị liệu' },
                { value: 'EXPENSE', label: 'Phiếu chi chi phí' },
                { value: 'SALARY', label: 'Duyệt bảng lương' },
                { value: 'INVENTORY', label: 'Tiêu hao kho' },
                { value: 'REFUND', label: 'Hoàn tiền khách' },
                { value: 'MANUAL', label: 'Bút toán thủ công' },
              ]}
              className="w-full text-xs"
            />
          </div>

          {/* Search bar */}
          <div className="space-y-1">
            <span className={fieldLabelClassName}>Tìm kiếm nhanh</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Mã TK, tên nghiệp vụ..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-11 w-full min-w-0 rounded-xl border border-slate-100 bg-slate-50 pl-10 pr-3 text-xs font-bold text-slate-800 outline-none dark:border-[#3E3A35]/50 dark:bg-[#11100F] dark:text-[#EFE9E1]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── BÚT TOÁN LIST ── */}
      <div className="bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-primary/15 dark:border-[#3E3A35]/50 p-6 md:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6 border-b border-slate-50 dark:border-[#3E3A35]/30 pb-4">
          <h4 className="text-base font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-5.5 h-5.5 text-primary" />
            Nhật ký chứng từ Sổ cái (General Ledger)
          </h4>
          <span className="text-xs font-bold text-slate-400 dark:text-[#CDBCAB]/60">
            Tìm thấy: <span className="text-slate-900 dark:text-[#EFE9E1] font-black">{filteredEntries.length}</span> bút toán
          </span>
        </div>

        {loading ? (
          <SkeletonTable />
        ) : filteredEntries.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <AlertTriangle className="w-12 h-12 mx-auto text-slate-300 mb-3 animate-bounce" />
            <p className="font-extrabold uppercase text-xs tracking-wider">Không tìm thấy bút toán phù hợp</p>
          </div>
        ) : (
          <div className={tableWrapperClassName}>
            <table className={tableClassName}>
              <colgroup>
                <col className="w-[10rem]" />
                <col className="w-[31rem]" />
                <col className="w-[13rem]" />
                <col className="w-[13rem]" />
                <col className="w-[9rem]" />
                <col className="w-[8rem]" />
              </colgroup>
              <thead>
                <tr className="text-left bg-slate-50/50 dark:bg-[#11100F]/40 border-b border-slate-100 dark:border-[#3E3A35]/30">
                  <th className={`${stickyHeaderCellClassName} px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest`}>Ngày ghi sổ</th>
                  <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Diễn giải nghiệp vụ</th>
                  <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Nghiệp vụ gốc</th>
                  <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-right">Tổng phát sinh Nợ/Có</th>
                  <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-center">Trạng thái</th>
                  <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-[#3E3A35]/20">
                {filteredEntries.map((entry) => {
                  // Calculate total debit from lines
                  const totalAmount = entry.journal_lines?.reduce(
                    (sum: number, line: JournalLineRow) => sum + Number(line.debit_amount || 0),
                    0
                  ) || 0;

                  // Status badges
                  const statusColors: Record<string, string> = {
                    'DRAFT': 'bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-400 border-yellow-100/50',
                    'POSTED': 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-100/50',
                    'CANCELED': 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border-red-100/50',
                  };

                  return (
                    <motion.tr 
                      key={entry.id} 
                      whileHover={{ backgroundColor: 'rgba(244,63,94,0.01)' }}
                      className="hover:bg-slate-50/20 dark:hover:bg-[#11100F]/10 transition-colors"
                    >
                      <td className={`${stickyBodyCellClassName} px-6 py-4 text-2xs font-bold text-slate-500 dark:text-[#CDBCAB]/80 font-mono`}>
                        {entry.entry_date}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="truncate text-xs font-black leading-snug text-slate-800 dark:text-[#EFE9E1]" title={entry.description || ''}>{entry.description}</p>
                          <div className="mt-1.5 flex flex-nowrap items-center gap-1.5 overflow-hidden">
                            {entry.journal_lines?.map((line: JournalLineRow) => (
                              <span 
                                key={line.id} 
                                className={`shrink-0 text-4xs font-mono px-2 py-0.5 rounded border ${
                                  line.debit_amount > 0 
                                    ? 'bg-emerald-50/50 text-emerald-700 dark:bg-emerald-500/5 dark:text-emerald-400 border-emerald-100/30' 
                                    : 'bg-rose-50/50 text-rose-700 dark:bg-rose-500/5 dark:text-rose-400 border-rose-100/30'
                                }`}
                              >
                                {line.debit_amount > 0 ? 'Nợ' : 'Có'} {line.accounting_accounts?.account_code}
                              </span>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-slate-50 dark:bg-[#11100F] border border-slate-100 dark:border-none rounded-lg text-4xs font-black text-slate-400 dark:text-[#CDBCAB]/70 uppercase tracking-widest">
                          {entry.reference_type || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-mono font-black text-slate-900 dark:text-[#EFE9E1] text-xs">
                          {totalAmount.toLocaleString('vi-VN')}đ
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-4xs font-black uppercase tracking-wider border ${statusColors[entry.status]}`}>
                          {entry.status === 'POSTED' ? 'Đã ghi sổ' : entry.status === 'CANCELED' ? 'Đã hủy đảo' : 'Bản nháp'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Link href={`/dashboard/accounting/journals/${entry.id}`}>
                          <button className="inline-flex items-center gap-1 bg-primary hover:bg-primary-hover text-primary-foreground px-3.5 py-1.5 rounded-xl text-3xs font-black uppercase tracking-widest transition-all cursor-pointer">
                            <Eye className="w-3.5 h-3.5" />
                            Chi tiết
                          </button>
                        </Link>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
