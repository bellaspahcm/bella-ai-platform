'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Search,
  RefreshCw,
  Zap,
  Phone,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Car,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';
import type { Database } from '@/types/database.types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const SOURCE_CONFIG: Record<string, { bg: string; dot: string }> = {
  'Facebook Ads':    { bg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-100 dark:border-blue-900/30', dot: 'bg-blue-500' },
  'Google Search':   { bg: 'bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400 border-teal-100 dark:border-teal-900/30', dot: 'bg-teal-500' },
  'Showroom Visit':  { bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-100 dark:border-amber-900/30', dot: 'bg-amber-500' },
  'Website Bella':   { bg: 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 border-purple-100 dark:border-purple-900/30', dot: 'bg-purple-500' },
};

const STATUS_CONFIG: Record<string, { label: string; bg: string }> = {
  new:         { label: 'Mới Nhận',    bg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400' },
  contacted:   { label: 'Đã Tiếp Cận', bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' },
  test_drive:  { label: 'Lái Thử',     bg: 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400' },
  negotiating: { label: 'Thương Thảo', bg: 'bg-pink-50 text-pink-700 dark:bg-pink-950/30 dark:text-pink-400' },
  won:         { label: 'Chốt Đơn',    bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' },
  lost:        { label: 'Thất Bại',    bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400' },
};

type AutoLeadRow = Database['public']['Tables']['auto_leads']['Row'];
type CustomerRow = Database['public']['Tables']['customers']['Row'];
type VariantRow = Database['public']['Tables']['auto_variants']['Row'];
type UserRow = Database['public']['Tables']['users']['Row'];

type LeadQueryRow = Pick<
  AutoLeadRow,
  | 'id'
  | 'status'
  | 'source'
  | 'created_at'
  | 'preferred_color'
  | 'budget_limit'
  | 'assigned_sales_agent_id'
> & {
  customers: Pick<CustomerRow, 'name_mother' | 'phone'> | null;
  auto_variants: Pick<VariantRow, 'name' | 'year'> | null;
  users: Pick<UserRow, 'full_name'> | null;
};

type Lead = {
  id: string;
  name: string;
  phone: string;
  status: string;
  source: string;
  created_at: string;
  variantName: string;
  color: string;
  budget: string;
  agentName: string;
  assigned_sales_agent_id: string | null;
};

function formatLeadBudget(value: number | null) {
  if (value === null) return 'Chưa cập nhật';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function mapLeadRow(row: LeadQueryRow): Lead {
  return {
    id: row.id,
    name: row.customers?.name_mother ?? 'Chưa cập nhật',
    phone: row.customers?.phone ?? '',
    status: row.status,
    source: row.source,
    created_at: row.created_at,
    variantName: row.auto_variants
      ? `${row.auto_variants.name} ${row.auto_variants.year}`
      : 'Chưa chọn dòng xe',
    color: row.preferred_color ?? 'Chưa chọn',
    budget: formatLeadBudget(row.budget_limit),
    agentName: row.users?.full_name ?? 'Chưa phân bổ',
    assigned_sales_agent_id: row.assigned_sales_agent_id,
  };
}

export default function LeadCenterPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchLeads = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const supabase = createClient();
      if (!supabase) throw new Error('Client unavailable');
      const { data, error } = await supabase
        .from('auto_leads')
        .select(`
          id,
          status,
          source,
          created_at,
          preferred_color,
          budget_limit,
          assigned_sales_agent_id,
          customers(name_mother, phone),
          auto_variants(name, year),
          users(full_name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLeads((data || []).map(mapLeadRow));
    } catch {
      setLoadError('Không thể tải danh sách lead. Vui lòng tải lại trang để thử lại.');
      toast.error('Không thể tải danh sách lead');
    }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const filtered = leads.filter(l => {
    const matchSearch = (l.name ?? '').toLowerCase().includes(search.toLowerCase()) || (l.phone ?? '').includes(search) || (l.variantName ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="flex-1 overflow-auto bg-slate-50/30 dark:bg-slate-950 p-6 md:p-10 space-y-8" data-auto-layout>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-slate-100 dark:border-slate-900 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/15 dark:from-blue-500/20 dark:to-indigo-500/5 border border-blue-100/50 dark:border-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm shrink-0">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide">Lead Center & Phân Bổ TVBH</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Sales Lead Center — Theo dõi lead và TVBH phụ trách</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT: Lead Table ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors w-4 h-4" />
              <input
                type="text"
                aria-label="Tìm lead"
                placeholder="Tìm tên, SĐT, dòng xe..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-xs font-semibold placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-all shadow-sm"
              />
            </div>
            <select
              aria-label="Lọc trạng thái lead"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-xl text-xs font-bold outline-none text-slate-700 dark:text-slate-300 shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="new">Mới nhận</option>
              <option value="contacted">Đã tiếp cận</option>
              <option value="test_drive">Lái thử</option>
              <option value="negotiating">Thương thảo</option>
              <option value="won">Chốt đơn</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-900 rounded-3xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.015)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-900 text-[10px] font-extrabold uppercase text-slate-400 tracking-widest">
                    <th className="py-4 px-5">Lead</th>
                    <th className="py-4 px-5">Xe Quan Tâm</th>
                    <th className="py-4 px-5">Nguồn</th>
                    <th className="py-4 px-5">Trạng Thái</th>
                    <th className="py-4 px-5">TVBH Phụ Trách</th>
                    <th className="py-4 px-5">Hành Động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-900/80">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          <p className="text-xs text-slate-400 font-semibold">Đang tải leads...</p>
                        </div>
                      </td>
                    </tr>
                  ) : loadError ? (
                    <tr>
                      <td colSpan={6} className="p-5">
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Không tải được dữ liệu lead</AlertTitle>
                          <AlertDescription>{loadError}</AlertDescription>
                        </Alert>
                      </td>
                    </tr>
                  ) : filtered.length > 0 ? filtered.map((l, idx) => {
                    const srcCfg = SOURCE_CONFIG[l.source] ?? { bg: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' };
                    const stsCfg = STATUS_CONFIG[l.status] ?? { label: l.status, bg: 'bg-slate-100 text-slate-600' };
                    return (
                      <motion.tr
                        key={l.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-900/30 transition-all text-xs group"
                      >
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-extrabold flex items-center justify-center shrink-0">
                              {(l.name ?? 'L').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 dark:text-slate-200">{l.name}</div>
                              <div className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5" />{l.phone}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2">
                            <Car className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700 shrink-0" />
                            <div>
                              <div className="font-bold text-slate-800 dark:text-slate-200">{l.variantName}</div>
                              <div className="text-[10px] text-slate-400 font-medium mt-0.5">Màu: {l.color} · {l.budget}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${srcCfg.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${srcCfg.dot}`} />
                            {l.source}
                          </span>
                        </td>
                        <td className="py-4 px-5">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${stsCfg.bg}`}>
                            {stsCfg.label}
                          </span>
                        </td>
                        <td className="py-4 px-5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[10px] ${l.agentName === 'Chưa phân bổ' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400'}`}>
                            {l.agentName !== 'Chưa phân bổ' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                            {l.agentName}
                          </span>
                        </td>
                        <td className="py-4 px-5">
                          {l.agentName === 'Chưa phân bổ' ? (
                            <div className="flex gap-1.5">
                              <button
                                disabled
                                aria-label="Phân bổ xoay vòng"
                                aria-describedby="lead-allocation-unavailable"
                                title="Phân bổ xoay vòng"
                                className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl transition-all border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-none hover:-translate-y-0.5"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                disabled
                                aria-label="Phân bổ thông minh AI"
                                aria-describedby="lead-allocation-unavailable"
                                title="Phân bổ thông minh AI"
                                className="p-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl transition-all border border-indigo-100/30 dark:border-indigo-900/20 shadow-sm hover:shadow-none hover:-translate-y-0.5"
                              >
                                <Zap className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-300 dark:text-slate-700 font-bold italic">Đã phân bổ</span>
                          )}
                        </td>
                      </motion.tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <AlertCircle className="w-10 h-10 text-slate-200 dark:text-slate-800 mx-auto mb-3" />
                        <p className="text-xs text-slate-400 font-bold italic">Không tìm thấy lead nào</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Agent Performance + Smart Card ── */}
        <div className="space-y-5">

          {/* Agent Leaderboard */}
          <div className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-900 rounded-3xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.015)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 border border-violet-100/30 dark:border-violet-900/20 shadow-sm">
                <TrendingUp className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Bảng Hiệu Suất TVBH</h3>
            </div>

            <Alert>
              <AlertTitle>Chưa có dữ liệu hiệu suất TVBH</AlertTitle>
              <AlertDescription>Bảng hiệu suất chưa kết nối dữ liệu vận hành.</AlertDescription>
            </Alert>
          </div>

          {/* Smart Allocation info card */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-950 border border-slate-800/60 p-6 shadow-lg">
            {/* BG decoration */}
            <div className="absolute -bottom-4 -right-4 opacity-5 pointer-events-none">
              <Sparkles className="w-40 h-40 text-white" />
            </div>
            <div className="relative space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/10 border border-white/10">
                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
                <h3 className="font-extrabold text-sm text-white tracking-wide">Smart Allocation AI</h3>
              </div>
              <p className="text-xs leading-relaxed font-medium text-slate-300">
                Chức năng phân bổ xoay vòng và phân bổ thông minh chưa sẵn sàng. Lead và TVBH hiện tại vẫn được giữ nguyên.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <span id="lead-allocation-unavailable" className="text-xs font-bold text-slate-300">Chưa thể phân bổ lead từ màn hình này.</span>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-900 rounded-2xl p-4 shadow-sm text-center">
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{isLoading || loadError ? '—' : leads.length}</div>
              <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mt-1">Tổng Lead</div>
            </div>
            <div className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-900 rounded-2xl p-4 shadow-sm text-center">
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {isLoading || loadError ? '—' : leads.filter(l => l.agentName === 'Chưa phân bổ').length}
              </div>
              <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mt-1">Chờ Phân Bổ</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
