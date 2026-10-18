'use client';
import { LandPreviewNotice, unavailableLandAction } from "@/modules/real_estate/components/LandUiControls";

/**
 * @module app/dashboard/real-estate/marketing/page
 *
 * Bella Land - Marketing & Kênh Phân Phối (Marketing & Distribution Channels Subsystem)
 * Provides comprehensive campaign management, ad spend tracking, CPL analytics, and F1/F2 Agency Network operations.
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Megaphone, Search, Plus, Filter, Globe, DollarSign, Users,
  TrendingUp, BarChart3, ArrowUpRight, ArrowDownRight, CheckCircle2,
  Clock, PauseCircle, PlayCircle, Settings, Download, RefreshCw,
  Building2, SlidersHorizontal, Eye, ChevronRight, X, Sparkles,
  Layers, Tag, Phone, Mail, Award, CheckSquare, ShieldCheck, Share2,
  Target, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

// ── Types & Interfaces ────────────────────────────────────────────────────────

export interface CampaignItem {
  id: string;
  code: string;
  name: string;
  project: string;
  channel: 'facebook' | 'zalo' | 'google' | 'tiktok' | 'event' | 'billboard';
  channelLabel: string;
  budget: number; // VNĐ
  spent: number; // VNĐ
  leadsCount: number;
  convertedCount: number;
  cpl: number; // Chi phí / lead (VNĐ)
  status: 'active' | 'paused' | 'draft' | 'completed';
  startDate: string;
  endDate: string;
  manager: string;
}

export interface AgencyItem {
  id: string;
  code: string;
  name: string;
  tier: 'F1_EXCLUSIVE' | 'F1_STANDARD' | 'F2_PARTNER' | 'CTV_VIP';
  tierLabel: string;
  assignedProject: string;
  leadQuota: number;
  leadsDelivered: number;
  dealsClosed: number;
  commissionRate: number; // %
  revenueGenerated: number; // VNĐ
  contactPerson: string;
  contactPhone: string;
  status: 'active' | 'pending' | 'suspended';
}

const CAMPAIGN_CHANNELS = ['facebook', 'zalo', 'google', 'tiktok', 'event', 'billboard'] as const satisfies readonly CampaignItem['channel'][];
const AGENCY_TIERS = ['F1_EXCLUSIVE', 'F1_STANDARD', 'F2_PARTNER', 'CTV_VIP'] as const satisfies readonly AgencyItem['tier'][];

function isCampaignChannel(value: string): value is CampaignItem['channel'] {
  return (CAMPAIGN_CHANNELS as readonly string[]).includes(value);
}

function isAgencyTier(value: string): value is AgencyItem['tier'] {
  return (AGENCY_TIERS as readonly string[]).includes(value);
}

function getSafeTelHref(phone: string): string | null {
  const normalizedPhone = phone.replace(/[^\d+#*]/g, '');
  return normalizedPhone.length > 0 ? `tel:${encodeURIComponent(normalizedPhone)}` : null;
}

// ── Seed Data ─────────────────────────────────────────────────────────────────

const INITIAL_CAMPAIGNS: CampaignItem[] = [
  {
    id: 'camp-001',
    code: 'CMP-2026-001',
    name: 'Chiến dịch Shophouse Marina - Mở bán Q3',
    project: 'Elyse Island',
    channel: 'facebook',
    channelLabel: 'Facebook Ads',
    budget: 800000000,
    spent: 540000000,
    leadsCount: 420,
    convertedCount: 38,
    cpl: 1285000,
    status: 'active',
    startDate: '01/08/2026',
    endDate: '30/09/2026',
    manager: 'Nguyễn Văn A'
  },
  {
    id: 'camp-002',
    code: 'CMP-2026-002',
    name: 'Zalo OA Exclusive - Căn hộ 2PN View Sông',
    project: 'Elyse Island',
    channel: 'zalo',
    channelLabel: 'Zalo OA Ads',
    budget: 450000000,
    spent: 310000000,
    leadsCount: 290,
    convertedCount: 29,
    cpl: 1068000,
    status: 'active',
    startDate: '10/08/2026',
    endDate: '15/10/2026',
    manager: 'Trần Thị B'
  },
  {
    id: 'camp-003',
    code: 'CMP-2026-003',
    name: 'Google Search Ads - Từ khóa "Biệt thự Elyse"',
    project: 'Sunrise Residence',
    channel: 'google',
    channelLabel: 'Google Search',
    budget: 600000000,
    spent: 580000000,
    leadsCount: 310,
    convertedCount: 42,
    cpl: 1870000,
    status: 'active',
    startDate: '15/07/2026',
    endDate: '30/09/2026',
    manager: 'Lê Hoàng C'
  },
  {
    id: 'camp-004',
    code: 'CMP-2026-004',
    name: 'TikTok Short Video Tour Căn Hộ Mẫu',
    project: 'Lumière Bay',
    channel: 'tiktok',
    channelLabel: 'TikTok Ads',
    budget: 300000000,
    spent: 210000000,
    leadsCount: 510,
    convertedCount: 19,
    cpl: 411000,
    status: 'active',
    startDate: '20/08/2026',
    endDate: '20/10/2026',
    manager: 'Nguyễn Văn A'
  },
  {
    id: 'camp-005',
    code: 'CMP-2026-005',
    name: 'Sự kiện Tri ân & Mở bán GEM Center Q3',
    project: 'Elyse Island',
    channel: 'event',
    channelLabel: 'Sự kiện VIP',
    budget: 1200000000,
    spent: 1200000000,
    leadsCount: 180,
    convertedCount: 55,
    cpl: 6666000,
    status: 'completed',
    startDate: '10/08/2026',
    endDate: '10/08/2026',
    manager: 'Phạm Thanh D'
  },
  {
    id: 'camp-006',
    code: 'CMP-2026-006',
    name: 'Billboard Quảng cáo Cao Tốc Long Thành',
    project: 'Lumière Bay',
    channel: 'billboard',
    channelLabel: 'Billboard OOH',
    budget: 500000000,
    spent: 250000000,
    leadsCount: 130,
    convertedCount: 12,
    cpl: 1923000,
    status: 'paused',
    startDate: '01/06/2026',
    endDate: '31/12/2026',
    manager: 'Trần Thị B'
  }
];

const INITIAL_AGENCIES: AgencyItem[] = [
  {
    id: 'ag-001',
    code: 'AG-DXMN',
    name: 'Sàn Đất Xanh Miền Nam',
    tier: 'F1_EXCLUSIVE',
    tierLabel: 'Đại lý Độc quyền F1',
    assignedProject: 'Elyse Island',
    leadQuota: 500,
    leadsDelivered: 468,
    dealsClosed: 48,
    commissionRate: 3.5,
    revenueGenerated: 288000000000,
    contactPerson: 'Ông Võ Văn Nam',
    contactPhone: '0908 111 222',
    status: 'active'
  },
  {
    id: 'ag-002',
    code: 'AG-KHANGL',
    name: 'Sàn Khải Hoàn Land',
    tier: 'F1_STANDARD',
    tierLabel: 'Đại lý Chính thức F1',
    assignedProject: 'Sunrise Residence',
    leadQuota: 400,
    leadsDelivered: 382,
    dealsClosed: 36,
    commissionRate: 3.0,
    revenueGenerated: 180000000000,
    contactPerson: 'Bà Lê Thu Hà',
    contactPhone: '0912 333 444',
    status: 'active'
  },
  {
    id: 'ag-003',
    code: 'AG-VHGREAL',
    name: 'Công ty BĐS VHG Real',
    tier: 'F1_STANDARD',
    tierLabel: 'Đại lý Chính thức F1',
    assignedProject: 'Lumière Bay',
    leadQuota: 300,
    leadsDelivered: 245,
    dealsClosed: 22,
    commissionRate: 3.0,
    revenueGenerated: 110000000000,
    contactPerson: 'Ông Đỗ Quốc Huy',
    contactPhone: '0938 555 666',
    status: 'active'
  },
  {
    id: 'ag-004',
    code: 'AG-NAMLONG',
    name: 'Liên minh Sàn Nam Long Partner',
    tier: 'F2_PARTNER',
    tierLabel: 'Đại lý Liên kết F2',
    assignedProject: 'Elyse Island',
    leadQuota: 200,
    leadsDelivered: 165,
    dealsClosed: 14,
    commissionRate: 2.2,
    revenueGenerated: 70000000000,
    contactPerson: 'Bà Nguyễn Phương Mai',
    contactPhone: '0977 888 999',
    status: 'active'
  },
  {
    id: 'ag-005',
    code: 'AG-VIPCLUB',
    name: 'CLB Investor VIP Club (Cộng tác viên)',
    tier: 'CTV_VIP',
    tierLabel: 'Cộng tác viên VIP',
    assignedProject: 'Tất cả dự án',
    leadQuota: 100,
    leadsDelivered: 89,
    dealsClosed: 11,
    commissionRate: 1.5,
    revenueGenerated: 55000000000,
    contactPerson: 'Ông Trần Hoàng Giang',
    contactPhone: '0903 999 888',
    status: 'active'
  }
];

export default function RealEstateMarketingPage() {
  const [activeSubsystem, setActiveSubsystem] = useState<'campaigns' | 'channels' | 'analytics'>('campaigns');
  const [campaigns, setCampaigns] = useState<CampaignItem[]>(INITIAL_CAMPAIGNS);
  const [agencies, setAgencies] = useState<AgencyItem[]>(INITIAL_AGENCIES);
  const [selectedAgency, setSelectedAgency] = useState<AgencyItem | null>(null);

  // Filters
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Syncing state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Modals
  const [showAddCampaignModal, setShowAddCampaignModal] = useState<boolean>(false);
  const [showAddAgencyModal, setShowAddAgencyModal] = useState<boolean>(false);

  // New Campaign Form State
  const [newCamp, setNewCamp] = useState({
    name: '',
    project: 'Elyse Island',
    channel: 'facebook' as CampaignItem['channel'],
    budget: '500000000',
    manager: 'Nguyễn Văn A',
    startDate: '10/09/2026',
    endDate: '31/10/2026'
  });

  // New Agency Form State
  const [newAgency, setNewAgency] = useState({
    name: '',
    tier: 'F1_STANDARD' as AgencyItem['tier'],
    assignedProject: 'Elyse Island',
    commissionRate: '3.0',
    leadQuota: '300',
    contactPerson: '',
    contactPhone: ''
  });

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalBudget = campaigns.reduce((sum, c) => sum + c.budget, 0);
    const totalSpent = campaigns.reduce((sum, c) => sum + c.spent, 0);
    const totalLeads = campaigns.reduce((sum, c) => sum + c.leadsCount, 0);
    const totalConverted = campaigns.reduce((sum, c) => sum + c.convertedCount, 0);
    const avgCPL = totalLeads > 0 ? Math.round(totalSpent / totalLeads) : 0;
    const conversionRate = totalLeads > 0 ? ((totalConverted / totalLeads) * 100).toFixed(1) : '0';

    return {
      totalBudget,
      totalSpent,
      totalLeads,
      totalConverted,
      avgCPL,
      conversionRate,
      activeCampaigns: campaigns.filter(c => c.status === 'active').length,
      activeAgencies: agencies.filter(a => a.status === 'active').length,
    };
  }, [campaigns, agencies]);

  // Filtered Campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      if (filterProject !== 'all' && c.project !== filterProject) return false;
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;
      if (filterChannel !== 'all' && c.channel !== filterChannel) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = c.name.toLowerCase().includes(q);
        const matchCode = c.code.toLowerCase().includes(q);
        const matchProj = c.project.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchProj) return false;
      }
      return true;
    });
  }, [campaigns, filterProject, filterStatus, filterChannel, searchQuery]);

  const filteredAgencies = agencies.filter(agency => filterProject === "all" || agency.assignedProject.includes(filterProject));
  // Actions
  const handleSyncAdsApi = () => { unavailableLandAction("Cập nhật Marketing / Ads"); };

  const handleToggleCampaignStatus = (id: string) => { unavailableLandAction("Cập nhật Marketing / Ads"); };

  const handleCreateCampaign = (e: React.FormEvent) => { e.preventDefault(); unavailableLandAction("Cập nhật Marketing / Ads"); };

  const handleCreateAgency = (e: React.FormEvent) => { e.preventDefault(); unavailableLandAction("Cập nhật Marketing / Ads"); };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto font-sans text-slate-900 dark:text-slate-100">
      <LandPreviewNotice />
      
      {/* ── 1. Header Bar & Navigation ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
            <span>Bella Land</span>
            <span>/</span>
            <span>Vận hành</span>
            <span>/</span>
            <span className="text-slate-900 dark:text-white font-bold">Marketing & Kênh phân phối</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Marketing & Kênh phân phối
          </h1>
          <p className="text-xs md:text-sm text-slate-500 font-semibold mt-0.5">
            Quản lý chiến dịch truyền thông, ngân sách quảng cáo và mạng lưới sàn đại lý F1/F2
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Project Selector */}
          <PremiumSelect
            value={filterProject}
            onChange={setFilterProject}
            className="w-44"
            options={[
              { value: "all", label: "Tất cả dự án" },
              { value: "Elyse Island", label: "Elyse Island" },
              { value: "Sunrise Residence", label: "Sunrise Residence" },
              { value: "Lumière Bay", label: "Lumière Bay" },
            ]}
          />

          {/* Sync API Button */}
          <button
            onClick={handleSyncAdsApi}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 transition-all shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ Ads API'}</span>
          </button>

          {/* Primary Action Button */}
          {activeSubsystem === 'campaigns' ? (
            <button
              onClick={() => setShowAddCampaignModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" /> Tạo chiến dịch mới
            </button>
          ) : (
            <button
              onClick={() => setShowAddAgencyModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" /> Thêm đại lý / Sàn F1
            </button>
          )}
        </div>
      </div>

      {/* ── 2. 5 Marketing Operational KPI Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Budget */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">Tổng ngân sách</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black">
              Q3/2026
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {(metrics.totalBudget / 1000000000).toFixed(2)} tỷ
            </div>
            <div className="text-[11px] text-slate-500 font-semibold mt-1 flex items-center justify-between">
              <span>Đã chi: {(metrics.totalSpent / 1000000000).toFixed(2)} tỷ</span>
              <span className="text-blue-600 font-bold">{Math.round((metrics.totalSpent / metrics.totalBudget) * 100)}%</span>
            </div>
          </div>
        </div>

        {/* Total Leads */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-emerald-600 uppercase tracking-wider text-[11px]">Lead thu về</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold flex items-center gap-0.5">
              ↑ 18.5%
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div>
              <span className="text-3xl font-black text-emerald-600">{metrics.totalLeads.toLocaleString('vi-VN')}</span>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Lead hợp lệ</p>
            </div>
            <Users className="w-6 h-6 text-emerald-500 opacity-60" />
          </div>
        </div>

        {/* CPL (Cost Per Lead) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-amber-600 uppercase tracking-wider text-[11px]">CPL Trung bình</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-extrabold flex items-center gap-0.5">
              ↓ 8.2% tối ưu
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div>
              <span className="text-2xl font-black text-amber-600">{(metrics.avgCPL / 1000).toLocaleString('vi-VN')}k</span>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">VNĐ / lead</p>
            </div>
            <Target className="w-6 h-6 text-amber-500 opacity-60" />
          </div>
        </div>

        {/* Converted & Deposit */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-indigo-600 uppercase tracking-wider text-[11px]">Chốt HĐ / Cọc</span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black">
              {metrics.conversionRate}% Conv
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div>
              <span className="text-3xl font-black text-indigo-600">{metrics.totalConverted}</span>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Giao dịch thành công</p>
            </div>
            <CheckCircle2 className="w-6 h-6 text-indigo-500 opacity-60" />
          </div>
        </div>

        {/* Active Channels & Agencies */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-purple-600 uppercase tracking-wider text-[11px]">Kênh & Đại lý</span>
            <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-black">
              Active
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div>
              <span className="text-3xl font-black text-purple-600">{metrics.activeAgencies}</span>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">{metrics.activeCampaigns} chiến dịch chạy</p>
            </div>
            <Building2 className="w-6 h-6 text-purple-500 opacity-60" />
          </div>
        </div>
      </div>

      {/* ── 3. Subsystem View Tabs ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubsystem('campaigns')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
            activeSubsystem === 'campaigns'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          Chiến dịch Marketing ({campaigns.length})
        </button>

        <button
          onClick={() => setActiveSubsystem('channels')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
            activeSubsystem === 'channels'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Kênh phân phối & Đại lý F1/F2 ({agencies.length})
        </button>

        <button
          onClick={() => setActiveSubsystem('analytics')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
            activeSubsystem === 'analytics'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Phân tích ROI & CPL
        </button>
      </div>

      {/* ── 4. Main Subsystem Content ── */}

      {/* TAB 1: CAMPAIGNS MANAGEMENT */}
      {activeSubsystem === 'campaigns' && (
        <div className="space-y-4">
          {/* Filter Toolbar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <PremiumSelect
                value={filterChannel}
                onChange={setFilterChannel}
                placeholder="Tất cả kênh quảng cáo"
                className="w-48"
                options={[
                  { value: "all", label: "Tất cả kênh quảng cáo" },
                  { value: "facebook", label: "Facebook Ads" },
                  { value: "zalo", label: "Zalo OA Ads" },
                  { value: "google", label: "Google Search" },
                  { value: "tiktok", label: "TikTok Ads" },
                  { value: "event", label: "Sự kiện VIP" },
                ]}
              />

              <PremiumSelect
                value={filterStatus}
                onChange={setFilterStatus}
                placeholder="Tất cả trạng thái"
                className="w-44"
                options={[
                  { value: "all", label: "Tất cả trạng thái" },
                  { value: "active", label: "Đang chạy" },
                  { value: "paused", label: "Tạm dừng" },
                  { value: "completed", label: "Đã hoàn thành" },
                ]}
              />

              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  placeholder="Tìm tên chiến dịch, mã CMP..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none"
                />
              </div>
            </div>

            <div className="text-xs text-slate-500 font-semibold">
              Hiển thị <span className="font-bold text-slate-900 dark:text-white">{filteredCampaigns.length}</span> / {campaigns.length} chiến dịch
            </div>
          </div>

          {/* Campaign Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
                <thead className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Chiến dịch / Mã</th>
                    <th className="p-4">Dự án</th>
                    <th className="p-4">Kênh truyền thông</th>
                    <th className="p-4">Ngân sách / Đã chi</th>
                    <th className="p-4 text-center">Lead / Chốt HĐ</th>
                    <th className="p-4 text-right">Chi phí / Lead (CPL)</th>
                    <th className="p-4 text-center">Trạng thái</th>
                    <th className="p-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredCampaigns.map(camp => {
                    const spendPercent = Math.round((camp.spent / camp.budget) * 100);
                    return (
                      <tr key={camp.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all">
                        <td className="p-4">
                          <p className="font-extrabold text-slate-900 dark:text-white text-xs">{camp.name}</p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold mt-0.5">
                            <span className="font-mono text-blue-600 dark:text-blue-400">{camp.code}</span>
                            <span>•</span>
                            <span>{camp.startDate} - {camp.endDate}</span>
                          </div>
                        </td>

                        <td className="p-4">
                          <span className="font-bold text-slate-800 dark:text-slate-200 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
                            {camp.project}
                          </span>
                        </td>

                        <td className="p-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                            <Globe className="w-3.5 h-3.5" />
                            {camp.channelLabel}
                          </span>
                        </td>

                        <td className="p-4 min-w-[180px]">
                          <div className="flex justify-between text-xs font-bold mb-1">
                            <span className="text-slate-900 dark:text-white">{(camp.spent / 1000000).toLocaleString('vi-VN')}tr</span>
                            <span className="text-slate-400">/ {(camp.budget / 1000000).toLocaleString('vi-VN')}tr</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${spendPercent > 90 ? 'bg-rose-500' : 'bg-blue-600'}`}
                              style={{ width: `${Math.min(spendPercent, 100)}%` }}
                            />
                          </div>
                        </td>

                        <td className="p-4 text-center">
                          <p className="font-black text-slate-900 dark:text-white text-sm">{camp.leadsCount}</p>
                          <p className="text-[10px] text-emerald-600 font-bold">Chốt: {camp.convertedCount} HĐ</p>
                        </td>

                        <td className="p-4 text-right font-black text-slate-900 dark:text-white text-sm">
                          {camp.cpl > 0 ? `${(camp.cpl / 1000).toLocaleString('vi-VN')}k` : '-'}
                        </td>

                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black ${
                            camp.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : camp.status === 'paused'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {camp.status === 'active' ? '● Đang chạy' : camp.status === 'paused' ? '❚❚ Tạm dừng' : '✓ Hoàn thành'}
                          </span>
                        </td>

                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleToggleCampaignStatus(camp.id)}
                            className="px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 transition-all"
                          >
                            {camp.status === 'active' ? 'Tạm dừng' : 'Tiếp tục'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                {filteredCampaigns.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-slate-500">Không có chiến dịch phù hợp với bộ lọc.</td></tr>}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AGENCY NETWORK (F1/F2 KÊNH PHÂN PHỐI) */}
      {activeSubsystem === 'channels' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgencies.length === 0 && <p className="p-4">Không có đại lý phù hợp.</p>}
          {filteredAgencies.map(agency => (
            <div key={agency.id} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4 hover:border-blue-400 transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md">
                    {agency.tierLabel}
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1.5">{agency.name}</h3>
                  <p className="text-xs text-slate-500 font-semibold">{agency.code} • Phụ trách: {agency.assignedProject}</p>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Active" />
              </div>

              <div className="grid grid-cols-2 gap-3 py-2 border-y border-slate-100 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 text-[11px] font-semibold">Chỉ tiêu Lead</span>
                  <p className="font-extrabold text-slate-900 dark:text-white mt-0.5">
                    {agency.leadsDelivered} / {agency.leadQuota}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] font-semibold">Hoa hồng sàn</span>
                  <p className="font-extrabold text-emerald-600 mt-0.5">{agency.commissionRate}%</p>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] font-semibold">Giao dịch chốt</span>
                  <p className="font-extrabold text-slate-900 dark:text-white mt-0.5">{agency.dealsClosed} HĐ</p>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] font-semibold">Doanh số tạo ra</span>
                  <p className="font-extrabold text-indigo-600 mt-0.5">{(agency.revenueGenerated / 1000000000).toFixed(0)} tỷ</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold pt-1">
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{agency.contactPerson} ({agency.contactPhone})</span>
                </div>
                <button
                  onClick={() => setSelectedAgency(agency)}
                  className="text-blue-600 font-bold hover:underline cursor-pointer"
                >
                  Chi tiết ➔
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: ANALYTICS & ROI */}
      {activeSubsystem === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" /> Hiệu quả Lead theo Kênh Marketing
            </h3>

            <div className="space-y-3 pt-2">
              {[
                { channel: 'Facebook Ads', leads: 420, percent: 35, color: 'bg-blue-600' },
                { channel: 'TikTok Ads', leads: 510, percent: 28, color: 'bg-slate-900 dark:bg-white' },
                { channel: 'Google Search', leads: 310, percent: 20, color: 'bg-amber-500' },
                { channel: 'Zalo OA Ads', leads: 290, percent: 12, color: 'bg-cyan-500' },
                { channel: 'Sự kiện & Billboard', leads: 310, percent: 5, color: 'bg-purple-600' },
              ].map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-800 dark:text-slate-200">{item.channel}</span>
                    <span className="text-slate-600 dark:text-slate-400">{item.leads} lead ({item.percent}%)</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${item.color}`} style={{ width: `${Math.min(100, Math.max(0, item.percent))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" /> Bảng xếp hạng Đại lý / Sàn F1 xuất sắc
            </h3>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {agencies.map((agency, i) => (
                <div key={agency.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full font-black text-xs flex items-center justify-center ${
                      i === 0 ? 'bg-amber-400 text-slate-950' : i === 1 ? 'bg-slate-300 text-slate-900' : 'bg-amber-700 text-white'
                    }`}>
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-900 dark:text-white">{agency.name}</p>
                      <p className="text-[10px] text-slate-400">{agency.tierLabel}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-black text-emerald-600 text-sm">{(agency.revenueGenerated / 1000000000).toFixed(0)} tỷ</p>
                    <p className="text-[10px] text-slate-500 font-bold">{agency.dealsClosed} HĐ chốt</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: TẠO CHIẾN DỊCH MOÍ ── */}
      <AnimatePresence>
        {showAddCampaignModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-blue-600" /> Tạo chiến dịch Marketing mới
                </h3>
                <button onClick={() => setShowAddCampaignModal(false)} className="p-1 rounded-lg hover:bg-slate-100">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleCreateCampaign} className="space-y-4 text-xs font-semibold">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Tên chiến dịch *</label>
                  <input
                    required
                    placeholder="VD: Mở bán Căn hộ Elyse View Sông Q4"
                    value={newCamp.name}
                    onChange={e => setNewCamp({ ...newCamp, name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">Dự án áp dụng</label>
                    <PremiumSelect
                      value={newCamp.project}
                      onChange={val => setNewCamp({ ...newCamp, project: val })}
                      options={[
                        { value: "Elyse Island", label: "Elyse Island" },
                        { value: "Sunrise Residence", label: "Sunrise Residence" },
                        { value: "Lumière Bay", label: "Lumière Bay" },
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">Kênh truyền thông</label>
                    <PremiumSelect
                      value={newCamp.channel}
                      onChange={val => {
                        if (isCampaignChannel(val)) {
                          setNewCamp({ ...newCamp, channel: val });
                        }
                      }}
                      options={[
                        { value: "facebook", label: "Facebook Ads" },
                        { value: "zalo", label: "Zalo OA Ads" },
                        { value: "google", label: "Google Search" },
                        { value: "tiktok", label: "TikTok Ads" },
                        { value: "event", label: "Sự kiện VIP" },
                      ]}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">Ngân sách (VNĐ)</label>
                    <input
                      type="number"
                      value={newCamp.budget}
                      onChange={e => setNewCamp({ ...newCamp, budget: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">Người quản lý</label>
                    <input
                      value={newCamp.manager}
                      onChange={e => setNewCamp({ ...newCamp, manager: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddCampaignModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-black text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-xs"
                  >
                    Kích hoạt chiến dịch
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: THÊM ĐẠI LÝ F1/F2 ── */}
      <AnimatePresence>
        {showAddAgencyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-600" /> Thêm đại lý / Sàn liên kết F1/F2
                </h3>
                <button onClick={() => setShowAddAgencyModal(false)} className="p-1 rounded-lg hover:bg-slate-100">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleCreateAgency} className="space-y-4 text-xs font-semibold">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Tên sàn đại lý *</label>
                  <input
                    required
                    placeholder="VD: Sàn Đất Xanh Đông Nam Bộ"
                    value={newAgency.name}
                    onChange={e => setNewAgency({ ...newAgency, name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">Cấp đại lý</label>
                    <PremiumSelect
                      value={newAgency.tier}
                      onChange={val => {
                        if (isAgencyTier(val)) {
                          setNewAgency({ ...newAgency, tier: val });
                        }
                      }}
                      options={[
                        { value: "F1_EXCLUSIVE", label: "F1 Độc quyền" },
                        { value: "F1_STANDARD", label: "F1 Chính thức" },
                        { value: "F2_PARTNER", label: "F2 Liên kết" },
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">Dự án phụ trách</label>
                    <PremiumSelect
                      value={newAgency.assignedProject}
                      onChange={val => setNewAgency({ ...newAgency, assignedProject: val })}
                      options={[
                        { value: "Elyse Island", label: "Elyse Island" },
                        { value: "Sunrise Residence", label: "Sunrise Residence" },
                        { value: "Lumière Bay", label: "Lumière Bay" },
                      ]}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">% Hoa hồng</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newAgency.commissionRate}
                      onChange={e => setNewAgency({ ...newAgency, commissionRate: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">Chỉ tiêu Lead</label>
                    <input
                      type="number"
                      value={newAgency.leadQuota}
                      onChange={e => setNewAgency({ ...newAgency, leadQuota: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">Người đại diện liên hệ</label>
                    <input
                      required
                      placeholder="VD: Ông Nguyễn Văn B"
                      value={newAgency.contactPerson}
                      onChange={e => setNewAgency({ ...newAgency, contactPerson: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">Số điện thoại</label>
                    <input
                      placeholder="0909 xxx xxx"
                      value={newAgency.contactPhone}
                      onChange={e => setNewAgency({ ...newAgency, contactPhone: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddAgencyModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-black text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-xs"
                  >
                    Lưu đại lý
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
        {/* AGENCY DETAIL MODAL */}
        {selectedAgency && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedAgency(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider">Hồ sơ sàn liên kết F1</span>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">{selectedAgency.name}</h3>
                </div>
                <button
                  onClick={() => setSelectedAgency(null)}
                  className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-slate-400 font-semibold block text-[10px]">Dự án phân phối</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedAgency.assignedProject}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block text-[10px]">Cấp độ sàn</span>
                    <span className="font-bold text-emerald-600">{selectedAgency.tier}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block text-[10px]">Hạn mức Lead tháng</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedAgency.leadsDelivered} / {selectedAgency.leadQuota} leads</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block text-[10px]">Chỉ tiêu chuyển đổi</span>
                    <span className="font-bold text-blue-600">{selectedAgency.dealsClosed} giao dịch ({((selectedAgency.dealsClosed / selectedAgency.leadsDelivered) * 100).toFixed(1)}%)</span>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-amber-900 dark:text-amber-300">Tỷ lệ hoa hồng hợp đồng:</span>
                    <span className="font-black text-amber-700 dark:text-amber-400 text-sm">{selectedAgency.commissionRate}%</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-amber-200/60">
                    <span className="font-bold text-amber-900 dark:text-amber-300">Tổng doanh số tạo ra:</span>
                    <span className="font-black text-indigo-600 text-sm">{(selectedAgency.revenueGenerated / 1000000000).toFixed(1)} Tỷ VNĐ</span>
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <a
                    href={getSafeTelHref(selectedAgency.contactPhone) ?? undefined}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5" /> Gọi điện ({selectedAgency.contactPhone})
                  </a>
                  <button
                    onClick={() => setSelectedAgency(null)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs hover:bg-slate-200"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

