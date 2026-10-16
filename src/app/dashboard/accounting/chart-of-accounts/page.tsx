'use client';

import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { SkeletonTable } from '@/components/ui/SkeletonLoader';
import { createAccount,getAccounts } from '@/services/accounting-actions';
import { AnimatePresence,motion } from 'framer-motion';
import {
ChevronDown,
ChevronRight,
HelpCircle,
PlusCircle,
Search,
X
} from 'lucide-react';
import { useCallback,useEffect,useState } from 'react';
import { toast } from 'sonner';
import { getAccountingErrorMessage as getErrorMessage } from '@/lib/accounting-error-message';
import { usePageRefresh } from '@/hooks/usePageRefresh';

type AccountRow = Awaited<ReturnType<typeof getAccounts>>[number];
type TreeAccount = AccountRow & { children: TreeAccount[] };
type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

const ACCOUNT_TYPES_SET: ReadonlySet<AccountType> = new Set(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']);
const accountTypes: { value: AccountType; label: string }[] = [
  { value: 'ASSET', label: '1xx, 2xx - TÀI SẢN (ASSETS)' },
  { value: 'LIABILITY', label: '3xx - NỢ PHẢI TRẢ (LIABILITY)' },
  { value: 'EQUITY', label: '4xx, 9xx - VỐN CHỦ SỞ HỮU (EQUITY)' },
  { value: 'REVENUE', label: '5xx, 7xx - DOANH THU (REVENUE)' },
  { value: 'EXPENSE', label: '6xx, 8xx - CHI PHÍ (EXPENSE)' },
];

const treeScrollClassName =
  'overflow-x-auto overscroll-x-contain -mx-6 px-6 pb-2 shadow-[inset_-18px_0_18px_-18px_rgba(15,23,42,0.45)] dark:shadow-[inset_-18px_0_18px_-18px_rgba(239,233,225,0.28)] md:-mx-8 md:px-8';
const stickyAccountCellClassName =
  'bg-inherit pr-4';

export default function ChartOfAccountsPage() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  
  // Add modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newAccount, setNewAccount] = useState({
    account_code: '',
    account_name: '',
    account_type: 'ASSET' as AccountType,
    parent_id: '',
  });

  // Expanded tree nodes
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const fetchCOA = useCallback(async () => {
    try {
      const data = await getAccounts();
      setAccounts(data || []);
      
      // Auto expand all top nodes initially
      const initialExpanded: Record<string, boolean> = {};
      data.forEach((acc) => {
        if (!acc.parent_id) {
          initialExpanded[acc.id] = true;
        }
      });
      setExpandedNodes(initialExpanded);
    } catch (err: unknown) {
      console.error('Error fetching COA:', err);
      toast.error('Không thể tải hệ thống tài khoản.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCOA();
  }, [fetchCOA]);

  usePageRefresh(fetchCOA);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.account_code || !newAccount.account_name) {
      toast.warning('Vui lòng nhập đầy đủ mã và tên tài khoản.');
      return;
    }

    setSaving(true);
    try {
      const res = await createAccount({
        account_code: newAccount.account_code,
        account_name: newAccount.account_name,
        account_type: newAccount.account_type,
        parent_id: newAccount.parent_id || null,
      });

      if (res.success) {
        toast.success(`Đã thêm tài khoản "${newAccount.account_code} - ${newAccount.account_name}" thành công!`);
        setIsModalOpen(false);
        setNewAccount({ account_code: '', account_name: '', account_type: 'ASSET', parent_id: '' });
        fetchCOA();
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Lỗi khi thêm tài khoản mới.'));
    } finally {
      setSaving(false);
    }
  };

  // Group accounts in parent-child tree hierarchy
  const buildTree = (list: AccountRow[]): TreeAccount[] => {
    const map: Record<string, TreeAccount> = {};
    const roots: TreeAccount[] = [];

    // Filter by type if needed
    let filteredList = list;
    if (selectedTypeFilter !== 'all') {
      filteredList = list.filter(a => a.account_type === selectedTypeFilter);
    }

    // Filter by search term
    if (searchTerm) {
      const normalizedSearch = searchTerm.toLowerCase();
      filteredList = list.filter(
        a => a.account_code.includes(normalizedSearch) || a.account_name.toLowerCase().includes(normalizedSearch)
      );
      // When searching, display as flat list instead of nested tree for better visibility
      return filteredList.map((a): TreeAccount => ({ ...a, children: [] }));
    }

    filteredList.forEach((acc) => {
      map[acc.id] = { ...acc, children: [] };
    });

    filteredList.forEach((acc) => {
      const mapped = map[acc.id];
      if (acc.parent_id && map[acc.parent_id]) {
        map[acc.parent_id].children.push(mapped);
      } else {
        // If it has a parent that is filtered out, or it is a root node
        roots.push(mapped);
      }
    });

    return roots;
  };

  const treeData = buildTree(accounts);

  // Render tree node component helper
  const renderTreeNode = (node: TreeAccount, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = !!expandedNodes[node.id];
    
    // Type colors
    const typeBadges: Record<string, string> = {
      'ASSET': 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20',
      'LIABILITY': 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border-rose-100 dark:border-rose-500/20',
      'EQUITY': 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border-amber-100 dark:border-amber-500/20',
      'REVENUE': 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border-blue-100 dark:border-blue-500/20',
      'EXPENSE': 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 border-purple-100 dark:border-purple-500/20',
    };

    return (
      <div key={node.id} className="w-full">
        <div
          className={`flex min-w-[52rem] items-center justify-between rounded-xl border border-slate-50 px-4 py-3 transition-colors hover:bg-slate-50/50 dark:border-[#3E3A35]/30 dark:hover:bg-[#1C1B19]/50 ${
            depth === 0 ? 'bg-white dark:bg-[#1C1B19] font-black' : 'bg-transparent font-medium'
          }`}
          style={{ paddingLeft: `${Math.max(16, depth * 28)}px` }}
        >
          <div className={`${stickyAccountCellClassName} flex min-w-[22rem] items-center gap-3`}>
            {hasChildren ? (
              <button 
                onClick={() => toggleNode(node.id)}
                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-[#3E3A35] text-slate-400"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <div className="w-6 flex items-center justify-center shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-[#3E3A35]" />
              </div>
            )}
            
            <span className="font-mono text-xs px-2.5 py-0.5 bg-slate-100 dark:bg-[#3E3A35] text-slate-700 dark:text-[#EFE9E1] rounded-md border border-slate-200/50 dark:border-none">
              {node.account_code}
            </span>
            <span className="text-sm whitespace-nowrap text-slate-800 dark:text-[#EFE9E1]">{node.account_name}</span>
          </div>

          <div className="flex shrink-0 items-center gap-4">
            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wider border uppercase ${typeBadges[node.account_type]}`}>
              {node.account_type}
            </span>
            <span className={`text-[10px] font-bold ${node.is_active ? 'text-emerald-500' : 'text-slate-300'}`}>
              ● Active
            </span>
          </div>
        </div>

        {/* Render child nodes recursively */}
        {hasChildren && isExpanded && (
          <div className="space-y-1 mt-1">
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Find candidate parent accounts matching currently chosen account type
  const parentCandidates = accounts.filter(
    a => a.account_type === newAccount.account_type && !a.parent_id
  );

  return (
    <div className="space-y-8">
      {/* ── HEADER SEARCH & FILTERS ── */}
      <div className="bella-toolbar flex flex-col justify-between gap-4 rounded-[2.5rem] border border-primary/15 bg-white p-5 shadow-sm dark:border-[#3E3A35]/50 dark:bg-[#1C1B19] sm:p-6 xl:flex-row xl:items-center">
        <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(14rem,1fr)_minmax(13rem,16rem)] xl:max-w-3xl">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm kiếm tài khoản..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-[#11100F] border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all text-slate-800 dark:text-[#EFE9E1]"
            />
          </div>

          {/* Type filter dropdown */}
          <PremiumSelect
            value={selectedTypeFilter}
            onChange={(val) => setSelectedTypeFilter(val)}
            options={[
              { value: 'all', label: 'Tất cả loại' },
              { value: 'ASSET', label: 'Tài sản (Asset)' },
              { value: 'LIABILITY', label: 'Nợ phải trả (Liability)' },
              { value: 'EQUITY', label: 'Vốn chủ sở hữu (Equity)' },
              { value: 'REVENUE', label: 'Doanh thu (Revenue)' },
              { value: 'EXPENSE', label: 'Chi phí (Expense)' },
            ]}
            className="w-full text-xs"
          />
        </div>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-xs font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary-hover active:scale-95 dark:shadow-none sm:w-auto xl:shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Thêm tài khoản</span>
        </button>
      </div>

      {/* ── TREE VIEW LIST ── */}
      <div className="bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-primary/15 dark:border-[#3E3A35]/50 p-6 md:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6 border-b border-slate-50 dark:border-[#3E3A35]/30 pb-4">
          <h4 className="text-base font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wider">Hệ thống Tài khoản số cái (COA)</h4>
          <span className="text-xs font-bold text-slate-400 dark:text-[#CDBCAB]/60">
            Tổng cộng: <span className="text-slate-900 dark:text-[#EFE9E1] font-black">{accounts.length}</span> tài khoản
          </span>
        </div>

        {loading ? (
          <SkeletonTable />
        ) : treeData.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <HelpCircle className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="font-extrabold uppercase text-xs tracking-wider">Không tìm thấy tài khoản phù hợp</p>
          </div>
        ) : (
          <div className={treeScrollClassName}>
            <div className="min-w-[52rem] space-y-2">
              {treeData.map((node) => renderTreeNode(node, 0))}
            </div>
          </div>
        )}
      </div>

      {/* ── ADD NEW ACCOUNT DIALOG MODAL ── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Dark overlay backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-xs"
            />

            {/* Modal Glass Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-primary/15 dark:border-[#3E3A35] shadow-2xl p-8 max-w-lg w-full relative z-10 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-50 dark:border-[#3E3A35]/30 pb-4">
                <h4 className="text-lg font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wide">Thêm Tài khoản Mới</h4>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#11100F] text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                {/* Account Type */}
                <div className="space-y-1.5">
                  <label className="text-2xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Loại tài khoản</label>
                  <PremiumSelect
                    value={newAccount.account_type}
                    onChange={(val) => {
                      if (ACCOUNT_TYPES_SET.has(val as AccountType)) {
                        setNewAccount(prev => ({ ...prev, account_type: val as AccountType, parent_id: '' }));
                      }
                    }}
                    options={accountTypes}
                    className="w-full"
                  />
                </div>

                {/* Parent Account */}
                <div className="space-y-1.5">
                  <label className="text-2xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Tài khoản cấp cha (Tùy chọn)</label>
                  <PremiumSelect
                    value={newAccount.parent_id}
                    onChange={(val) => setNewAccount(prev => ({ ...prev, parent_id: val }))}
                    options={[
                      { value: '', label: 'Tài khoản gốc (Root / Không có cha)' },
                      ...parentCandidates.map(p => ({
                        value: p.id,
                        label: `[${p.account_code}] - ${p.account_name}`,
                      })),
                    ]}
                    className="w-full"
                  />
                </div>

                {/* Account Code */}
                <div className="space-y-1.5">
                  <label className="text-2xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Mã số tài khoản (Mã số phụ)</label>
                  <input 
                    type="text" 
                    placeholder="Ví dụ: 1121" 
                    value={newAccount.account_code}
                    onChange={(e) => setNewAccount(prev => ({ ...prev, account_code: e.target.value.replace(/\D/g, '') }))}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-[#11100F] border border-slate-100 dark:border-[#3E3A35] rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 text-slate-800 dark:text-[#EFE9E1]"
                  />
                </div>

                {/* Account Name */}
                <div className="space-y-1.5">
                  <label className="text-2xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Tên tài khoản</label>
                  <input 
                    type="text" 
                    placeholder="Ví dụ: Tiền gửi BIDV VND" 
                    value={newAccount.account_name}
                    onChange={(e) => setNewAccount(prev => ({ ...prev, account_name: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-[#11100F] border border-slate-100 dark:border-[#3E3A35] rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 text-slate-800 dark:text-[#EFE9E1]"
                  />
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-50 pt-4 dark:border-[#3E3A35]/30 sm:flex-row sm:items-center">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 bg-slate-50 dark:bg-[#11100F] border border-slate-200/50 dark:border-[#3E3A35]/50 hover:bg-slate-100 dark:hover:bg-[#1C1B19] text-slate-700 dark:text-[#CDBCAB] py-4 rounded-2xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button 
                    type="submit" 
                    disabled={saving}
                    className="flex-1 bg-primary hover:bg-primary-hover text-primary-foreground py-4 rounded-2xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-primary/20 dark:shadow-none disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? 'Đang lưu...' : 'Thêm tài khoản'}
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
