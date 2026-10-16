'use client';

import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import { getAccounts,postManualJournalEntry } from '@/services/accounting-actions';
import { getUsers } from '@/services/user-actions';
import {
AlertTriangle,
ArrowRight,
Calendar,
CheckCircle2,
Layers,
PenTool,
Plus,
Trash2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback,useEffect,useState } from 'react';
import { toast } from 'sonner';
import { getAccountingErrorMessage as getErrorMessage } from '@/lib/accounting-error-message';
import { usePageRefresh } from '@/hooks/usePageRefresh';

type AccountRow = Awaited<ReturnType<typeof getAccounts>>[number];
type StaffRow = Awaited<ReturnType<typeof getUsers>>[number];

interface JournalLineRow {
  account_id: string;
  debit_amount: number;
  credit_amount: number;
  ktv_id: string;
}

export default function ManualEntryPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [ktvs, setKtvs] = useState<StaffRow[]>([]);

  // Header state
  const [entryDate, setEntryDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [description, setDescription] = useState('');

  // Dynamic lines state
  const [lines, setLines] = useState<JournalLineRow[]>([
    { account_id: '', debit_amount: 0, credit_amount: 0, ktv_id: '' },
    { account_id: '', debit_amount: 0, credit_amount: 0, ktv_id: '' },
  ]);

  const loadMetadata = useCallback(async () => {
    try {
      const [accData, ktvData] = await Promise.all([
        getAccounts(),
        getUsers()
      ]);

      // Filter to only allow leaf accounts (accounts with no children) for posting
      const leafAccounts = (accData || []).filter((a) => {
        return !accData.some((sub) => sub.parent_id === a.id);
      });

      setAccounts(leafAccounts);
      setKtvs(ktvData || []);
    } catch (err: unknown) {
      console.error('Error loading metadata:', err);
      toast.error('Không thể tải siêu dữ liệu hệ thống.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  usePageRefresh(loadMetadata);

  const handleAddLine = () => {
    setLines(prev => [...prev, { account_id: '', debit_amount: 0, credit_amount: 0, ktv_id: '' }]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 2) {
      toast.warning('Một bút toán phải có ít nhất 2 dòng định khoản.');
      return;
    }
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof JournalLineRow, value: string | number) => {
    setLines(prev => {
      const copy = [...prev];
      if (field === 'debit_amount' || field === 'credit_amount') {
        const numVal = Math.max(0, Number(value) || 0);
        copy[index] = {
          ...copy[index],
          [field]: numVal,
          // An accounting line cannot be both debit and credit
          ...(field === 'debit_amount' && numVal > 0 ? { credit_amount: 0 } : {}),
          ...(field === 'credit_amount' && numVal > 0 ? { debit_amount: 0 } : {}),
        };
      } else {
        copy[index] = { ...copy[index], [field]: value };
      }
      return copy;
    });
  };

  // Calculations
  const totalDebit = lines.reduce((sum, l) => sum + l.debit_amount, 0);
  const totalCredit = lines.reduce((sum, l) => sum + l.credit_amount, 0);
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;
  
  // Validate all lines have accounts selected
  const hasAccountsSelected = lines.every(l => l.account_id !== '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.warning('Vui lòng nhập diễn giải nghiệp vụ.');
      return;
    }
    if (!hasAccountsSelected) {
      toast.warning('Vui lòng chọn tài khoản cho tất cả các dòng.');
      return;
    }
    if (!isBalanced) {
      toast.warning('Bút toán chưa cân đối Nợ/Có hoặc tổng phát sinh bằng 0đ.');
      return;
    }

    setSaving(true);
    try {
      const cleanLines = lines.map(l => ({
        account_id: l.account_id,
        debit_amount: l.debit_amount,
        credit_amount: l.credit_amount,
        ktv_id: l.ktv_id || null,
      }));

      const res = await postManualJournalEntry({
        entry_date: entryDate,
        description: description.trim(),
        lines: cleanLines,
      });

      if (res.success) {
        toast.success('Bút toán điều chỉnh đã được tạo và ghi sổ thành công!');
        router.push('/dashboard/accounting/journals');
      }
    } catch (err: unknown) {
      console.error('Post manual entry failed:', err);
      toast.error(getErrorMessage(err, 'Lỗi khi ghi nhận bút toán thủ công.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <SkeletonLoader variant="rectangular" className="h-96" />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* ── HEADER DATA: VOUCHER CONFIG ── */}
      <div className="bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-primary/15 dark:border-[#3E3A35]/50 p-6 md:p-8 shadow-sm space-y-6">
        <h4 className="text-base font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-slate-50 dark:border-[#3E3A35]/30">
          <PenTool className="w-5.5 h-5.5 text-primary" />
          Phiếu kế toán điều chỉnh thủ công (Manual Journal Voucher)
        </h4>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Entry Date */}
          <div className="space-y-1.5">
            <label className="text-2xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest block flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Ngày ghi sổ
            </label>
            <input 
              type="date" 
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="h-11 w-full min-w-[10.75rem] rounded-xl border border-slate-100 bg-slate-50 px-4 pr-10 text-xs font-bold text-slate-800 outline-none [color-scheme:light] dark:border-[#3E3A35]/50 dark:bg-[#11100F] dark:text-[#EFE9E1] dark:[color-scheme:dark]"
            />
          </div>

          {/* Description */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-2xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest block flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              Diễn giải nghiệp vụ (Chỉ tiêu điều chỉnh)
            </label>
            <input 
              type="text" 
              placeholder="Ví dụ: Khấu hao TSCĐ chi nhánh tháng 5, trích bổ sung hoa hồng..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-[#11100F] border border-slate-100 dark:border-[#3E3A35]/50 rounded-xl text-xs font-bold outline-none text-slate-800 dark:text-[#EFE9E1]" 
            />
          </div>
        </div>
      </div>

      {/* ── DYNAMIC LEDGER LINES ENTRY ── */}
      <div className="bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-primary/15 dark:border-[#3E3A35]/50 p-6 md:p-8 shadow-sm space-y-6">
        <h4 className="text-sm font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wider pb-3 border-b border-slate-50 dark:border-[#3E3A35]/30">
          Các dòng định khoản Nợ / Có chi tiết
        </h4>

        <div className="space-y-4">
          {lines.map((line, idx) => (
            <div 
              key={idx} 
              className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-[#3E3A35]/20 dark:bg-[#11100F]/30 sm:grid-cols-2 xl:grid-cols-12 xl:items-end"
            >
              {/* STT indicator */}
              <div className="flex h-10 items-center justify-start text-2xs font-black text-slate-400 dark:text-[#CDBCAB]/40 sm:col-span-2 xl:col-span-1 xl:justify-center">
                #{idx + 1}
              </div>

              {/* Account select */}
              <div className="space-y-1 sm:col-span-2 xl:col-span-4">
                <span className="text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Tài khoản</span>
                <PremiumSelect
                  value={line.account_id}
                  onChange={(val) => handleLineChange(idx, 'account_id', val)}
                  options={accounts.map(a => ({
                    value: a.id,
                    label: `[${a.account_code}] - ${a.account_name}`,
                    group: a.account_type === 'ASSET' ? 'Tài sản (Asset)' :
                           a.account_type === 'LIABILITY' ? 'Nợ phải trả (Liability)' :
                           a.account_type === 'EQUITY' ? 'Vốn chủ sở hữu (Equity)' :
                           a.account_type === 'REVENUE' ? 'Doanh thu (Revenue)' :
                           a.account_type === 'EXPENSE' ? 'Chi phí (Expense)' : undefined
                  }))}
                  placeholder="-- Chọn tài khoản --"
                  className="w-full text-xs"
                />
              </div>

              {/* Debit Amount */}
              <div className="space-y-1 xl:col-span-2">
                <span className="text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Phát sinh Nợ</span>
                <CurrencyInput 
                  value={line.debit_amount}
                  onChange={(val) => {
                    setLines(prev => {
                      const copy = [...prev];
                      copy[idx] = {
                        ...copy[idx],
                        debit_amount: val,
                        // An accounting line cannot be both debit and credit
                        ...(val > 0 ? { credit_amount: 0 } : {}),
                      };
                      return copy;
                    });
                  }}
                  placeholder="0"
                  className="text-emerald-600"
                />
              </div>

              {/* Credit Amount */}
              <div className="space-y-1 xl:col-span-2">
                <span className="text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Phát sinh Có</span>
                <CurrencyInput 
                  value={line.credit_amount}
                  onChange={(val) => {
                    setLines(prev => {
                      const copy = [...prev];
                      copy[idx] = {
                        ...copy[idx],
                        credit_amount: val,
                        // An accounting line cannot be both debit and credit
                        ...(val > 0 ? { debit_amount: 0 } : {}),
                      };
                      return copy;
                    });
                  }}
                  placeholder="0"
                  className="text-rose-600"
                />
              </div>

              {/* Dimension: KTV */}
              <div className="space-y-1 sm:col-span-2 xl:col-span-2">
                <span className="text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">KTV (Nếu có)</span>
                <PremiumSelect
                  value={line.ktv_id}
                  onChange={(val) => handleLineChange(idx, 'ktv_id', val)}
                  options={ktvs.map(k => ({
                    value: k.id,
                    label: k.full_name
                  }))}
                  placeholder="-- Chọn KTV --"
                  className="w-full text-xs"
                />
              </div>

              {/* Delete line */}
              <div className="flex justify-stretch pb-0.5 sm:col-span-2 xl:col-span-1 xl:justify-center">
                <button 
                  type="button"
                  onClick={() => handleRemoveLine(idx)}
                  className="flex w-full items-center justify-center p-2.5 rounded-xl border border-slate-100 bg-white text-rose-600 transition-all hover:border-rose-200 hover:bg-rose-50 active:scale-95 dark:border-[#3E3A35]/60 dark:bg-[#1C1B19] dark:hover:bg-red-950/20 xl:w-auto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add line button */}
        <button 
          type="button"
          onClick={handleAddLine}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-primary/15 bg-slate-50/20 px-5 py-3 text-2xs font-black uppercase tracking-widest text-[#4C243B] transition-all hover:border-primary hover:text-primary active:scale-95 dark:border-[#3E3A35] dark:bg-transparent dark:text-[#CDBCAB] dark:hover:border-primary sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm dòng định khoản</span>
        </button>
      </div>

      {/* ── REALTIME VOUCHER BALANCE STATUS CARD ── */}
      <div className="bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-primary/15 dark:border-[#3E3A35]/50 p-6 md:p-8 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Balanced indicators */}
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            isBalanced 
              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' 
              : 'bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-400 animate-pulse'
          }`}>
            {isBalanced ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          </div>
          <div>
            <h5 className="font-extrabold uppercase text-xs tracking-wider text-slate-800 dark:text-[#EFE9E1]">
              {isBalanced ? 'Định khoản cân đối Nợ/Có' : 'Bút toán chưa cân đối'}
            </h5>
            <div className="mt-1 grid grid-cols-1 gap-1 text-2xs font-mono font-bold text-slate-500 sm:grid-cols-[auto_auto] sm:gap-3">
              <span>Nợ: <span className="text-emerald-600 font-extrabold">{totalDebit.toLocaleString()}đ</span></span>
<span>Có: <span className="text-rose-600 font-extrabold">{totalCredit.toLocaleString()}đ</span></span>
            </div>
          </div>
        </div>

        {/* Submit */}
        <button 
          type="submit" 
          disabled={saving || !isBalanced || !hasAccountsSelected}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-none bg-primary px-8 py-4 text-xs font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary-hover active:scale-95 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none dark:shadow-none dark:disabled:bg-[#11100F] dark:disabled:text-slate-600 lg:w-auto lg:shrink-0"
        >
          <span>Ghi sổ bút toán</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
