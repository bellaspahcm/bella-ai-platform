'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Users,
  Plus,
  Search,
  ArrowLeft,
  Briefcase,
  Handshake,
  Trophy,
  BarChart3,
  TrendingUp,
  AlertCircle,
  Clock,
  Info,
  CheckCircle2,
  DollarSign,
  PieChart as PieChartIcon,
  Lightbulb,
  MoreHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Bell,
  List,
  LayoutGrid,
  PhoneCall,
  UserCheck,
  HeartHandshake,
  Building2,
  MapPin,
  Phone,
  Mail,
  Loader2,
  FileText,
  User,
} from 'lucide-react';

import type {
  CustomerOverviewResponse,
  CustomerItem,
  CustomerType,
  CustomerStatus,
  CustomerSource,
} from '@/products/bella-interior/domain/customer-overview.types';
import { supabase } from '@/lib/supabase-client';
import { Customer360Modal } from './customer-360-modal';

/**
 * Resolves a valid access token for API requests.
 * In development mode, if no active Supabase session is present (e.g. user arrived
 * via mock_user_email cookie), automatically signs in with the demo admin credentials.
 */
async function getAuthToken(): Promise<string | undefined> {
  const { data: authData } = await supabase.auth.getSession();
  let token = authData?.session?.access_token;
  if (!token && process.env.NODE_ENV === 'development') {
    try {
      const { data: signInData } = await supabase.auth.signInWithPassword({
        email: 'demo.interior@bellaspa.vn',
        password: 'password123',
      });
      token = signInData?.session?.access_token;
    } catch {
      // Non-critical fallback
    }
  }
  return token;
}

// Canonical initial overview matching domain layer definition exactly (zero mock data)
const INITIAL_CUSTOMER_OVERVIEW: CustomerOverviewResponse = {
  success: true,
  tenantId: 'tenant-preloaded',
  kpis: {
    totalCustomers: {
      value: 0,
      label: 'Tổng khách hàng',
      trend: '',
      isPositiveTrend: true,
    },
    potentialCustomers: {
      value: 0,
      label: 'Khách hàng tiềm năng',
      trend: '',
      isPositiveTrend: true,
    },
    activeTransacting: {
      value: 0,
      label: 'Đang giao dịch',
      trend: '',
      isPositiveTrend: true,
    },
    vipCustomers: {
      value: 0,
      label: 'Khách hàng VIP',
      trend: '',
      isPositiveTrend: true,
    },
  },
  salesFunnel: {
    steps: [
      { stepNumber: 1, label: 'Khách hàng tiềm năng', count: 0, color: '#3b82f6' },
      { stepNumber: 2, label: 'Khảo sát & tư vấn', count: 0, color: '#10b981' },
      { stepNumber: 3, label: 'Báo giá đề xuất', count: 0, color: '#f59e0b' },
      { stepNumber: 4, label: 'Đàm phán', count: 0, color: '#8b5cf6' },
      { stepNumber: 5, label: 'Ký hợp đồng', count: 0, color: '#6366f1' },
    ],
    conversionRatePercent: 0,
    conversionRateTrend: '',
    isConversionPositive: true,
    targetAchievementLabel: '',
    targetAchievementSub: '',
  },
  growthChart: {
    timeRangeLabel: '12 tháng',
    dataPoints: [
      { month: 'T1', customerCount: 0, revenueBillion: 0 },
      { month: 'T2', customerCount: 0, revenueBillion: 0 },
      { month: 'T3', customerCount: 0, revenueBillion: 0 },
      { month: 'T4', customerCount: 0, revenueBillion: 0 },
      { month: 'T5', customerCount: 0, revenueBillion: 0 },
      { month: 'T6', customerCount: 0, revenueBillion: 0 },
      { month: 'T7', customerCount: 0, revenueBillion: 0 },
      { month: 'T8', customerCount: 0, revenueBillion: 0 },
      { month: 'T9', customerCount: 0, revenueBillion: 0 },
      { month: 'T10', customerCount: 0, revenueBillion: 0 },
      { month: 'T11', customerCount: 0, revenueBillion: 0 },
      { month: 'T12', customerCount: 0, revenueBillion: 0 },
    ],
  },
  customers: [],
  alerts: [],
  financialSummary: {
    totalContractValue: 0,
    totalContractValueFormatted: '0 ₫',
    collected: 0,
    collectedFormatted: '0 ₫',
    receivableDebt: 0,
    receivableDebtFormatted: '0 ₫',
    collectionRatePercent: 0,
  },
  sourceDistribution: [],
  actionSuggestion: {
    title: '',
    description: '',
    ctaLabel: '',
    ctaLink: '',
  },
};

export default function CustomersPage() {
  const [data, setData] = useState<CustomerOverviewResponse>(INITIAL_CUSTOMER_OVERVIEW);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  // Shared auth token: obtained once on page load, passed to all child modals
  const [sharedAuthToken, setSharedAuthToken] = useState<string | undefined>(undefined);

  // Pagination State (ensures fast rendering, avoids endless table layout shifts)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Form Fields for Customer Creation
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerType, setNewCustomerType] = useState<'individual' | 'enterprise'>('individual');
  const [newCustomerTier, setNewCustomerTier] = useState<'standard' | 'silver' | 'gold' | 'vip'>('standard');
  const [newCustomerLegalName, setNewCustomerLegalName] = useState('');
  const [newCustomerTaxCode, setNewCustomerTaxCode] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [newCustomerCity, setNewCustomerCity] = useState('TP. Hồ Chí Minh');
  const [newCustomerDistrict, setNewCustomerDistrict] = useState('');
  const [newCustomerSource, setNewCustomerSource] = useState<CustomerSource>('website');
  const [newCustomerSale, setNewCustomerSale] = useState('');
  const [newCustomerArchitect, setNewCustomerArchitect] = useState('');
  const [newCustomerStatus, setNewCustomerStatus] = useState<CustomerStatus>('lead');
  const [newCustomerNotes, setNewCustomerNotes] = useState('');
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [customerSuccessNotice, setCustomerSuccessNotice] = useState<string | null>(null);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string | undefined>(undefined);
  const [is360ModalOpen, setIs360ModalOpen] = useState(false);

  const handleOpenCustomer360 = (cust: CustomerItem) => {
    setSelectedCustomerId(cust.id);
    setSelectedCustomerName(cust.name);
    setIs360ModalOpen(true);
  };

  const resetCustomerForm = () => {
    setNewCustomerName('');
    setNewCustomerPhone('');
    setNewCustomerEmail('');
    setNewCustomerType('individual');
    setNewCustomerTier('standard');
    setNewCustomerLegalName('');
    setNewCustomerTaxCode('');
    setNewCustomerAddress('');
    setNewCustomerCity('TP. Hồ Chí Minh');
    setNewCustomerDistrict('');
    setNewCustomerSource('website');
    setNewCustomerSale('');
    setNewCustomerArchitect('');
    setNewCustomerStatus('lead');
    setNewCustomerNotes('');
    setCustomerError(null);
  };

  const refreshCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      // Use the canonical CRM overview route which includes all customers (including lead-only, no project)
      const token = await getAuthToken();
      // Cache token so Customer360Modal can reuse it without re-authenticating
      if (token) setSharedAuthToken(token);
      const authHeaders: Record<string, string> = {};
      if (token) authHeaders['Authorization'] = `Bearer ${token}`;
      // Sort desc so newly created customers appear at the top
      const res = await fetch('/api/interior/crm/customers?page=1&limit=200&sortOrder=desc', { headers: authHeaders });
      if (!res.ok) {
        if (res.status === 401) {
          console.warn('[CRM] Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        }
        return;
      }
      const json = await res.json();
      // CRM route returns: { success, data: { customers, total, kpis, salesFunnel, growthChart } }
      const incomingCustomers: unknown[] = json.data?.customers ?? [];
      if (!Array.isArray(incomingCustomers)) return;

      setData((prev) => {
        const mappedCustomers: CustomerItem[] = incomingCustomers.map(
          (c: any, idx: number) => {
            const fallback = prev.customers.find((df) => df.id === c.id || df.name === c.name);
            const avatarFallback =
              c.avatar ||
              fallback?.avatar ||
              'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/team/staff-female-1.jpg';
            const managerAvatarFallback =
              c.managerAvatar ||
              fallback?.managerAvatar ||
              'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/team/staff-male-architect-1.jpg';
            const sourceMap: Record<string, { label: string; cls: string }> = {
              referral:  { label: 'Khách hàng cũ giới thiệu', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
              returning: { label: 'Khách hàng quay lại',      cls: 'bg-green-50 text-green-700 border-green-200' },
              marketing: { label: 'Marketing / Digital',       cls: 'bg-purple-50 text-purple-700 border-purple-200' },
              partner:   { label: 'Showroom / Đối tác',        cls: 'bg-orange-50 text-orange-700 border-orange-200' },
              website:   { label: 'Website / KTS',             cls: 'bg-blue-50 text-blue-700 border-blue-200' },
            };
            const srcKey = c.source || fallback?.source || 'website';
            const srcInfo = sourceMap[srcKey] ?? sourceMap['website'];
            return {
              id: c.id,
              code: c.code || fallback?.code || `KH-${String(idx + 1).padStart(3, '0')}`,
              name: c.name || fallback?.name || `Khách hàng ${c.id}`,
              avatar: avatarFallback,
              type: c.type || fallback?.type || 'individual',
              typeLabel: c.typeLabel || (c.type === 'enterprise' ? 'Doanh nghiệp' : 'Cá nhân'),
              typeBadgeClass: c.typeBadgeClass || (c.type === 'enterprise' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'),
              source: srcKey,
              sourceLabel: c.sourceLabel || srcInfo.label,
              sourceClass: c.sourceClass || srcInfo.cls,
              managerName: (() => {
                if (typeof c.notes === 'string') {
                  const saleMatch = c.notes.match(/Sale[:\s]+([^|\]]+)/i);
                  const ktsMatch = c.notes.match(/KTS[:\s]+([^|\]]+)/i);
                  const genericMatch = c.notes.match(/(?:Phụ trách|Quản lý)[:\s]+([^|\]]+)/i);

                  if (saleMatch && ktsMatch) {
                    return `${saleMatch[1].trim()} (Sale) • ${ktsMatch[1].trim()}`;
                  } else if (saleMatch) {
                    return `${saleMatch[1].trim()} (Sale)`;
                  } else if (ktsMatch) {
                    return ktsMatch[1].trim();
                  } else if (genericMatch) {
                    return genericMatch[1].trim();
                  }
                }
                return c.managerName || fallback?.managerName || (c.code?.startsWith('KH-0000') ? '— Chưa phân công —' : 'Trần Văn Quản Lý');
              })(),
              managerAvatar: managerAvatarFallback,
              opportunityCount: c.opportunityCount ?? fallback?.opportunityCount ?? 1,
              projectCount: c.projectCount ?? fallback?.projectCount ?? 0,
              totalValue: c.totalValue ?? fallback?.totalValue ?? 0,
              totalValueFormatted: c.totalValueFormatted || (c.totalValue ? `${Number(c.totalValue).toLocaleString('vi-VN')} ₫` : '0 ₫'),
              debt: c.debt ?? fallback?.debt ?? 0,
              debtFormatted: c.debtFormatted || (c.debt ? `${Number(c.debt).toLocaleString('vi-VN')} ₫` : '0 ₫'),
              hasDebt: c.hasDebt ?? fallback?.hasDebt ?? false,
              lastInteractionDate: c.lastInteractionDate || fallback?.lastInteractionDate || 'Vừa xong',
              status: c.status || fallback?.status || 'lead',
              statusLabel: c.statusLabel || fallback?.statusLabel || 'Khách hàng tiềm năng',
              statusBadgeClass: c.statusBadgeClass || fallback?.statusBadgeClass || 'bg-blue-50 text-blue-700 border-blue-200',
              tier: c.tier || fallback?.tier || 'standard',
              createdAt: c.createdAt || fallback?.createdAt,
              notes: c.notes || fallback?.notes || undefined,
            };
          }
        );
        let localExtras: CustomerItem[] = [];
        try {
          if (typeof window !== 'undefined') {
            const rawLocal = localStorage.getItem('bella_interior_crm_local_customers');
            if (rawLocal) {
              const parsed: CustomerItem[] = JSON.parse(rawLocal);
              // Purge legacy mock customer entries (e.g. cust-001..cust-004) from localStorage
              localExtras = parsed.filter((loc) => loc && loc.id && !loc.id.startsWith('cust-'));
            }
          }
        } catch {
          // Ignore localStorage errors
        }

        const localMap = new Map(localExtras.map((loc) => [loc.id, loc]));

        // Overlay any locally updated status if newer than server
        const mergedCustomers = mappedCustomers.map((mc) => {
          const loc = localMap.get(mc.id);
          if (loc && loc.status && loc.status !== mc.status) {
            return {
              ...mc,
              status: loc.status,
              statusLabel: loc.statusLabel || mc.statusLabel,
              statusBadgeClass: loc.statusBadgeClass || mc.statusBadgeClass,
            };
          }
          return mc;
        });

        const serverIds = new Set(mappedCustomers.map((c) => c.id));
        const unmergedLocals = localExtras.filter((loc) => !serverIds.has(loc.id));
        const finalCustomers = [...unmergedLocals, ...mergedCustomers];

        return {
          ...prev,
          kpis: json.data?.kpis || prev.kpis,
          salesFunnel: json.data?.salesFunnel || prev.salesFunnel,
          growthChart: json.data?.growthChart || prev.growthChart,
          financialSummary: json.data?.financialSummary || prev.financialSummary,
          sourceDistribution: json.data?.sourceDistribution || prev.sourceDistribution,
          alerts: json.data?.alerts || prev.alerts,
          actionSuggestion: json.data?.actionSuggestion || prev.actionSuggestion,
          customers: finalCustomers.length > 0 ? finalCustomers : prev.customers,
        };
      });
    } catch {
      // Retain current state on network error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCustomers();
  }, [refreshCustomers]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) {
      setCustomerError('Vui lòng nhập họ và tên khách hàng.');
      return;
    }
    if (!newCustomerPhone.trim()) {
      setCustomerError('Vui lòng nhập số điện thoại liên hệ.');
      return;
    }

    setIsSubmittingCustomer(true);
    setCustomerError(null);

    try {
      const assignedStaffParts: string[] = [];
      if (newCustomerSale.trim()) assignedStaffParts.push(`Sale: ${newCustomerSale.trim()}`);
      if (newCustomerArchitect.trim()) assignedStaffParts.push(`KTS: ${newCustomerArchitect.trim()}`);
      const displayManager = assignedStaffParts.length > 0
        ? (newCustomerSale.trim() && newCustomerArchitect.trim()
          ? `${newCustomerSale.trim()} (Sale) • ${newCustomerArchitect.trim()}`
          : (newCustomerSale.trim() ? `${newCustomerSale.trim()} (Sale)` : newCustomerArchitect.trim()))
        : '— Chưa phân công —';

      const noteParts: string[] = [];
      if (newCustomerNotes.trim()) noteParts.push(newCustomerNotes.trim());
      if (assignedStaffParts.length > 0) noteParts.push(assignedStaffParts.join(' | '));
      if (newCustomerStatus) noteParts.push(`[Lead stage: ${newCustomerStatus}]`);
      if (newCustomerSource) noteParts.push(`[Nguồn: ${newCustomerSource}]`);
      const finalNotes = noteParts.length > 0 ? noteParts.join(' | ') : undefined;

      const payload = {
        name: newCustomerName.trim(),
        legalName: newCustomerType === 'enterprise' && newCustomerLegalName.trim() ? newCustomerLegalName.trim() : undefined,
        taxCode: newCustomerType === 'enterprise' && newCustomerTaxCode.trim() ? newCustomerTaxCode.trim() : undefined,
        type: newCustomerType,
        tier: newCustomerTier,
        primaryPhone: newCustomerPhone.trim(),
        primaryEmail: newCustomerEmail.trim() || undefined,
        notes: finalNotes,
        fullAddress: newCustomerAddress.trim() || undefined,
        city: newCustomerCity.trim() || 'TP. Hồ Chí Minh',
        district: newCustomerDistrict.trim() || undefined,
        contactName: newCustomerName.trim(),
        source: newCustomerSource,
        status: newCustomerStatus,
        assignedStaffId: undefined, // Non-UUID manager string safely preserved in notes
      };

      const token = await getAuthToken();
      const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) authHeaders['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/interior/crm/customers', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Không thể lưu hồ sơ khách hàng. Vui lòng kiểm tra lại kết nối.');
      }

      const createdCustomer = json.data;

      // Optimistic update so customer immediately appears in table without waiting
      const optimisticCustomer: CustomerItem = {
        id: createdCustomer.id,
        code: createdCustomer.code || `KH-${Date.now().toString().slice(-4)}`,
        name: createdCustomer.name,
        avatar: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/team/staff-female-1.jpg',
        type: createdCustomer.type || 'individual',
        typeLabel: createdCustomer.type === 'enterprise' ? 'Doanh nghiệp' : 'Cá nhân',
        typeBadgeClass: createdCustomer.type === 'enterprise' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200',
        source: newCustomerSource,
        sourceLabel:
          newCustomerSource === 'referral'
            ? 'Khách hàng cũ giới thiệu'
            : newCustomerSource === 'returning'
            ? 'Khách hàng quay lại'
            : newCustomerSource === 'marketing'
            ? 'Marketing / Digital'
            : newCustomerSource === 'partner'
            ? 'Showroom / Đối tác'
            : 'Website / KTS',
        sourceClass: 'bg-blue-50 text-blue-700 border-blue-200',
        managerName: displayManager,
        managerAvatar: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/team/staff-male-architect-1.jpg',
        opportunityCount: 1,
        projectCount: 0,
        totalValue: 0,
        totalValueFormatted: '0 ₫',
        debt: 0,
        debtFormatted: '0 ₫',
        hasDebt: false,
        lastInteractionDate: 'Vừa xong',
        status: newCustomerStatus || 'lead',
        statusLabel:
          newCustomerStatus === 'transacting' ? 'Đang theo dự án'
          : newCustomerStatus === 'negotiating' ? 'Đang đàm phán'
          : newCustomerStatus === 'quotation' ? 'Báo giá đề xuất'
          : newCustomerStatus === 'survey' ? 'Khảo sát & tư vấn'
          : newCustomerStatus === 're_engagement' ? 'Chăm sóc lại'
          : newCustomerStatus === 'inactive' ? 'Tạm dừng'
          : 'Khách hàng tiềm năng',
        statusBadgeClass:
          newCustomerStatus === 'transacting' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : newCustomerStatus === 'negotiating' ? 'bg-violet-50 text-violet-700 border-violet-200'
          : newCustomerStatus === 'quotation' ? 'bg-amber-50 text-amber-700 border-amber-200'
          : newCustomerStatus === 'survey' ? 'bg-teal-50 text-teal-700 border-teal-200'
          : newCustomerStatus === 're_engagement' ? 'bg-amber-50 text-amber-700 border-amber-200'
          : newCustomerStatus === 'inactive' ? 'bg-stone-100 text-stone-600 border-stone-300'
          : 'bg-blue-50 text-blue-700 border-blue-200',
        tier: createdCustomer.tier || newCustomerTier || 'standard',
        notes: finalNotes,
      };

      setData((prev) => ({
        ...prev,
        customers: [optimisticCustomer, ...prev.customers.filter((c) => c.id !== createdCustomer.id)],
      }));

      // Persist in local storage so page reload/refresh never loses freshly created customer
      try {
        if (typeof window !== 'undefined') {
          const rawLocal = localStorage.getItem('bella_interior_crm_local_customers');
          const existingList: CustomerItem[] = rawLocal ? JSON.parse(rawLocal) : [];
          const updated = [optimisticCustomer, ...existingList.filter((x) => x.id !== optimisticCustomer.id)];
          localStorage.setItem('bella_interior_crm_local_customers', JSON.stringify(updated.slice(0, 50)));
        }
      } catch {
        // Ignore localStorage errors
      }

      setCustomerSuccessNotice(`Đã lưu khách hàng "${createdCustomer.name}" (${createdCustomer.code}) thành công!`);

      // Refresh from server to ensure perfect synchronization
      void refreshCustomers();

      setTimeout(() => {
        setIsAddCustomerOpen(false);
        setCustomerSuccessNotice(null);
        resetCustomerForm();
      }, 900);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu khách hàng.';
      setCustomerError(msg);
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  const handleUpdateCustomerStatus = async (customerId: string, newStatus: CustomerStatus) => {
    // 1. Optimistic update in UI state
    setData((prev) => ({
      ...prev,
      customers: prev.customers.map((c) =>
        c.id === customerId
          ? {
              ...c,
              status: newStatus,
              statusLabel:
                newStatus === 'lead' ? 'Khách hàng tiềm năng'
                : newStatus === 'survey' ? 'Khảo sát & tư vấn'
                : newStatus === 'quotation' ? 'Báo giá đề xuất'
                : newStatus === 'negotiating' ? 'Đang đàm phán'
                : newStatus === 'transacting' ? 'Đang theo dự án'
                : newStatus === 'completed' ? 'Đã hoàn thành'
                : newStatus === 'vip' ? 'Khách hàng VIP'
                : newStatus === 'inactive' ? 'Tạm dừng'
                : newStatus === 're_engagement' ? 'Chăm sóc lại'
                : 'Đã gộp',
              statusBadgeClass:
                newStatus === 'transacting' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : newStatus === 'survey' ? 'bg-teal-50 text-teal-700 border-teal-200'
                : newStatus === 'quotation' ? 'bg-amber-50 text-amber-700 border-amber-200'
                : newStatus === 'vip' ? 'bg-purple-50 text-purple-700 border-purple-200'
                : newStatus === 'negotiating' ? 'bg-violet-50 text-violet-700 border-violet-200'
                : newStatus === 'completed' ? 'bg-slate-50 text-slate-700 border-slate-200'
                : newStatus === 'inactive' ? 'bg-stone-100 text-stone-600 border-stone-300'
                : newStatus === 're_engagement' ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-blue-50 text-blue-700 border-blue-200',
            }
          : c
      ),
    }));

    // 2. Persist in local storage so page reload/refresh preserves the updated status
    try {
      if (typeof window !== 'undefined') {
        const rawLocal = localStorage.getItem('bella_interior_crm_local_customers');
        const list: CustomerItem[] = rawLocal ? JSON.parse(rawLocal) : [];
        const target = data.customers.find((c) => c.id === customerId);
        const exists = list.some((c) => c.id === customerId);
        const updated = exists
          ? list.map((c) => c.id === customerId ? { ...c, status: newStatus } : c)
          : [...list, { ...(target || { id: customerId }), status: newStatus } as CustomerItem];
        localStorage.setItem('bella_interior_crm_local_customers', JSON.stringify(updated.slice(0, 50)));
      }
    } catch {
      // Ignore localStorage errors
    }

    // 3. Persist to PostgreSQL database via PATCH
    try {
      const targetCustomer = data.customers.find((c) => c.id === customerId);
      const prevNotes = targetCustomer?.notes || '';
      const cleanedNotes = prevNotes.replace(/\[Lead stage[^\]]*\]/gi, '').trim();
      const updatedNotes = cleanedNotes
        ? `${cleanedNotes} | [Lead stage: ${newStatus}]`
        : `[Lead stage: ${newStatus}]`;

      const token = await getAuthToken();
      const patchHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) patchHeaders['Authorization'] = `Bearer ${token}`;

      await fetch(`/api/interior/crm/customers/${customerId}`, {
        method: 'PATCH',
        headers: patchHeaders,
        body: JSON.stringify({
          status: newStatus,
          tier: newStatus === 'vip' ? 'vip' : undefined,
          profileStatus: newStatus === 'inactive' ? 'inactive' : 'active',
          notes: updatedNotes,
        }),
      });
    } catch {
      // Non-critical: optimistic update already applied; server sync on next refresh
    }
  };

  const customersList = data.customers;

  // Filter customers by search and category
  const filteredCustomers = useMemo(() => {
    const list = Array.isArray(customersList) ? customersList : [];
    return list.filter((c: CustomerItem) => {
      const matchesSearch =
        (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.managerName || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = typeFilter === 'all' || c.type === (typeFilter as CustomerType);
      const matchesStatus = statusFilter === 'all' || c.status === (statusFilter as CustomerStatus);

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [customersList, searchQuery, typeFilter, statusFilter]);

  // Reset pagination to page 1 on query/filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter, statusFilter]);

  const totalItems = filteredCustomers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedCustomers = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, safePage, pageSize]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 dark:bg-slate-950 dark:text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ─── Top Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard/interior"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Quay lại Tổng quan
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center text-orange-600 dark:text-orange-400 shadow-2xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Khách hàng &amp; Chủ đầu tư
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Quản trị vòng đời khách hàng, phát triển quan hệ và tối ưu doanh thu
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Top user profile header matching mock image */}
          <div className="hidden sm:flex items-center gap-3 pr-2">
            <button
              type="button"
              className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Thông báo"
            >
              <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center">
                3
              </span>
            </button>
            <div className="flex items-center gap-2 pl-1 border-l border-slate-200 dark:border-slate-800">
              <div className="relative w-8 h-8 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                <Image
                  src={'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/team/finance-director-male.jpg'}
                  alt="Nguyễn Văn Quang"
                  fill
                  sizes="32px"
                  className="object-cover"
                />
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Nguyễn Văn Quang
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAddCustomerOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs sm:text-sm shadow-sm hover:shadow transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Thêm khách hàng
          </button>
        </div>
      </div>

      {/* ─── Row 1: 4 KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tổng khách hàng */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700" />
                <div className="w-16 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
              <div className="space-y-1.5 mt-3">
                <div className="w-16 h-8 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="w-24 h-3 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
              <div className="w-full h-6 bg-slate-100 dark:bg-slate-800 rounded mt-3" />
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Users className="w-5 h-5" />
                </div>
                {data.kpis.totalCustomers.trend && (
                  <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {data.kpis.totalCustomers.trend}
                  </span>
                )}
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                  {data.kpis.totalCustomers.value}
                </div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  {data.kpis.totalCustomers.label}
                </div>
              </div>
              {/* Mini Sparkline Wave (Blue) */}
              <div className="mt-3 h-6 w-full">
                <svg viewBox="0 0 100 24" className="w-full h-full" preserveAspectRatio="none">
                  <path
                    d="M0 18 Q 20 8, 40 16 T 80 8 T 100 12 L 100 24 L 0 24 Z"
                    fill="url(#blue-gradient)"
                    opacity="0.3"
                  />
                  <path
                    d="M0 18 Q 20 8, 40 16 T 80 8 T 100 12"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                  />
                  <defs>
                    <linearGradient id="blue-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </>
          )}
        </div>

        {/* KPI 2: Khách hàng tiềm năng */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700" />
                <div className="w-16 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
              <div className="space-y-1.5 mt-3">
                <div className="w-16 h-8 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="w-28 h-3.5 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
              <div className="w-full h-6 bg-slate-100 dark:bg-slate-800 rounded mt-3" />
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Briefcase className="w-5 h-5" />
                </div>
                {data.kpis.potentialCustomers.trend && (
                  <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {data.kpis.potentialCustomers.trend}
                  </span>
                )}
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                  {data.kpis.potentialCustomers.value}
                </div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  {data.kpis.potentialCustomers.label}
                </div>
              </div>
              {/* Mini Sparkline Wave (Green) */}
              <div className="mt-3 h-6 w-full">
                <svg viewBox="0 0 100 24" className="w-full h-full" preserveAspectRatio="none">
                  <path
                    d="M0 19 Q 25 10, 50 14 T 100 6 L 100 24 L 0 24 Z"
                    fill="url(#green-gradient)"
                    opacity="0.3"
                  />
                  <path
                    d="M0 19 Q 25 10, 50 14 T 100 6"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                  />
                  <defs>
                    <linearGradient id="green-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </>
          )}
        </div>

        {/* KPI 3: Đang giao dịch */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700" />
                <div className="w-16 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
              <div className="space-y-1.5 mt-3">
                <div className="w-16 h-8 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="w-24 h-3 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
              <div className="w-full h-6 bg-slate-100 dark:bg-slate-800 rounded mt-3" />
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Handshake className="w-5 h-5" />
                </div>
                {data.kpis.activeTransacting.trend && (
                  <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {data.kpis.activeTransacting.trend}
                  </span>
                )}
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                  {data.kpis.activeTransacting.value}
                </div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  {data.kpis.activeTransacting.label}
                </div>
              </div>
              {/* Mini Sparkline Wave (Purple) */}
              <div className="mt-3 h-6 w-full">
                <svg viewBox="0 0 100 24" className="w-full h-full" preserveAspectRatio="none">
                  <path
                    d="M0 16 Q 30 18, 55 10 T 100 8 L 100 24 L 0 24 Z"
                    fill="url(#purple-gradient)"
                    opacity="0.3"
                  />
                  <path
                    d="M0 16 Q 30 18, 55 10 T 100 8"
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="2"
                  />
                  <defs>
                    <linearGradient id="purple-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </>
          )}
        </div>

        {/* KPI 4: Khách hàng VIP */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700" />
                <div className="w-16 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
              <div className="space-y-1.5 mt-3">
                <div className="w-16 h-8 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="w-24 h-3 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
              <div className="w-full h-6 bg-slate-100 dark:bg-slate-800 rounded mt-3" />
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Trophy className="w-5 h-5" />
                </div>
                {data.kpis.vipCustomers.trend && (
                  <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {data.kpis.vipCustomers.trend}
                  </span>
                )}
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                  {data.kpis.vipCustomers.value}
                </div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  {data.kpis.vipCustomers.label}
                </div>
              </div>
              {/* Mini Sparkline Wave (Amber) */}
              <div className="mt-3 h-6 w-full">
                <svg viewBox="0 0 100 24" className="w-full h-full" preserveAspectRatio="none">
                  <path
                    d="M0 17 Q 35 15, 60 7 T 100 11 L 100 24 L 0 24 Z"
                    fill="url(#amber-gradient)"
                    opacity="0.3"
                  />
                  <path
                    d="M0 17 Q 35 15, 60 7 T 100 11"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2"
                  />
                  <defs>
                    <linearGradient id="amber-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Row 2: Sales Funnel &amp; Customer Growth Charts ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Phễu kinh doanh (Funnel) - 5 Cols */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Phễu kinh doanh</h2>
            </div>
            <button
              type="button"
              onClick={() => setCustomerSuccessNotice('📅 Đang lọc số liệu phễu kinh doanh: Tháng này')}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Tháng này
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
          </div>

          {isLoading ? (
            <div className="py-4 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center animate-pulse">
              <div className="sm:col-span-8 flex flex-col items-center gap-1.5 w-full">
                <div className="h-7 w-full bg-slate-200 dark:bg-slate-700 rounded-md" />
                <div className="h-7 w-[84%] bg-slate-200 dark:bg-slate-700 rounded-md" />
                <div className="h-7 w-[68%] bg-slate-200 dark:bg-slate-700 rounded-md" />
                <div className="h-7 w-[52%] bg-slate-200 dark:bg-slate-700 rounded-md" />
                <div className="h-7 w-[38%] bg-slate-200 dark:bg-slate-700 rounded-md" />
              </div>
              <div className="sm:col-span-4 flex flex-col items-center sm:items-start pl-0 sm:pl-2 space-y-2">
                <div className="w-16 h-8 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="w-24 h-3 bg-slate-100 dark:bg-slate-800 rounded" />
                <div className="w-20 h-3 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
            </div>
          ) : (
            <div className="py-4 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              {/* Funnel Shapes (Col 8) */}
              <div className="sm:col-span-8 flex flex-col items-center gap-1.5 w-full">
                {data.salesFunnel.steps.map((step) => {
                  // Width progression for funnel trapezoids
                  const widths = ['w-full', 'w-[84%]', 'w-[68%]', 'w-[52%]', 'w-[38%]'];
                  const bgColors = [
                    'bg-blue-600 text-white',
                    'bg-emerald-700 text-white',
                    'bg-amber-700 text-white',
                    'bg-purple-700 text-white',
                    'bg-indigo-600 text-white',
                  ];
                  const widthClass = widths[step.stepNumber - 1] || 'w-full';
                  const bgClass = bgColors[step.stepNumber - 1] || 'bg-blue-600 text-white';

                  return (
                    <div
                      key={step.stepNumber}
                      className={`h-7 ${widthClass} ${bgClass} rounded-md flex items-center justify-center text-[11px] font-bold shadow-2xs transition-all hover:brightness-105`}
                    >
                      <span>
                        {step.count} {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Funnel Metrics &amp; Award (Col 4) */}
              <div className="sm:col-span-4 flex flex-col items-center sm:items-start text-center sm:text-left justify-center pl-0 sm:pl-2">
                <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {data.salesFunnel.conversionRatePercent}%
                </div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                  Tỷ lệ chuyển đổi
                </div>
                <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                  {data.salesFunnel.conversionRateTrend}
                </div>

                {/* Award Pill */}
                <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                  <Trophy className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                  <div className="text-[11px] leading-tight">
                    <span className="font-bold block">
                      {data.salesFunnel.targetAchievementLabel}
                    </span>
                    <span className="text-[10px] text-emerald-600/90 dark:text-emerald-400/90">
                      {data.salesFunnel.targetAchievementSub}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tăng trưởng khách hàng &amp; doanh thu (Combo Bar/Line) - 7 Cols */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Tăng trưởng khách hàng &amp; doanh thu
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                  Khách hàng
                </span>
                <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  Doanh thu (Tỷ VNĐ)
                </span>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              >
                {data.growthChart.timeRangeLabel}
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
            </div>
          </div>

          {/* SVG Combined Bar & Line Chart */}
          {isLoading ? (
            <div className="mt-4 h-48 w-full bg-slate-100/60 dark:bg-slate-800/50 rounded-xl animate-pulse flex items-center justify-center">
              <span className="text-xs text-slate-400 font-medium">Đang tổng hợp biểu đồ tăng trưởng thực tế...</span>
            </div>
          ) : (
            <div className="mt-4 relative h-48 w-full">
              <svg viewBox="0 0 520 180" className="w-full h-full" preserveAspectRatio="none">
                {/* Grid Lines */}
                <line x1="40" y1="20" x2="490" y2="20" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="40" y1="60" x2="490" y2="60" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="40" y1="100" x2="490" y2="100" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="40" y1="140" x2="490" y2="140" stroke="#e2e8f0" strokeWidth="1" />

                {/* Dynamic Axis Scaling */}
                {(() => {
                  const points = data.growthChart.dataPoints;
                  const maxCust = Math.max(...points.map((p) => p.customerCount), 20);
                  const maxRev = Math.max(...points.map((p) => p.revenueBillion), 1);
                  const custStep = Math.ceil(maxCust / 3);
                  const revStep = Number((maxRev / 3).toFixed(1));

                  return (
                    <>
                      {/* Y Axis Left (Khách hàng) */}
                      <text x="30" y="24" fontSize="9" textAnchor="end" className="interior-chart-label">{custStep * 3}</text>
                      <text x="30" y="64" fontSize="9" textAnchor="end" className="interior-chart-label">{custStep * 2}</text>
                      <text x="30" y="104" fontSize="9" textAnchor="end" className="interior-chart-label">{custStep}</text>
                      <text x="30" y="144" fontSize="9" textAnchor="end" className="interior-chart-label">0</text>

                      {/* Y Axis Right (Doanh thu) */}
                      <text x="500" y="24" fontSize="9" textAnchor="start" className="interior-chart-label">{(revStep * 3).toFixed(1)}</text>
                      <text x="500" y="64" fontSize="9" textAnchor="start" className="interior-chart-label">{(revStep * 2).toFixed(1)}</text>
                      <text x="500" y="104" fontSize="9" textAnchor="start" className="interior-chart-label">{revStep.toFixed(1)}</text>
                      <text x="500" y="144" fontSize="9" textAnchor="start" className="interior-chart-label">0</text>

                      {/* Bars & Line Points */}
                      {points.map((pt, idx) => {
                        const totalPoints = points.length || 1;
                        const slotWidth = (490 - 50) / totalPoints;
                        const x = 50 + idx * slotWidth + slotWidth / 2;
                        const barHeight = Math.min(120, (pt.customerCount / (custStep * 3 || 1)) * 120);
                        const barY = 140 - barHeight;

                        return (
                          <g key={pt.month}>
                            <rect
                              x={x - 9}
                              y={barY}
                              width={18}
                              height={barHeight}
                              rx={3}
                              fill="#60a5fa"
                              className="hover:fill-blue-500 transition-colors cursor-pointer"
                            />
                            <text x={x} y="158" fontSize="9" textAnchor="middle" className="interior-chart-label" fontWeight="600">
                              {pt.month}
                            </text>
                          </g>
                        );
                      })}

                      {/* Revenue Trend Line */}
                      {points.length > 0 && (() => {
                        const totalPoints = points.length;
                        const slotWidth = (490 - 50) / totalPoints;
                        const linePoints = points.map((pt, idx) => {
                          const x = 50 + idx * slotWidth + slotWidth / 2;
                          const y = 140 - Math.min(120, (pt.revenueBillion / (revStep * 3 || 1)) * 120);
                          return { x, y, pt };
                        });

                        const pathString = linePoints.reduce((acc, curr, i) => {
                          return i === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
                        }, '');

                        return (
                          <g>
                            <path
                              d={pathString}
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            {linePoints.map((p, i) => (
                              <circle
                                key={i}
                                cx={p.x}
                                cy={p.y}
                                r={3.5}
                                fill="#ffffff"
                                stroke="#10b981"
                                strokeWidth="2"
                                className="cursor-pointer hover:r-5 transition-all"
                              />
                            ))}
                          </g>
                        );
                      })()}
                    </>
                  );
                })()}
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* ─── Row 3: Toolbar &amp; Filters ─── */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Left: Search &amp; Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm khách hàng, điện thoại, email..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="appearance-none pl-3 pr-7 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors cursor-pointer"
            >
              <option value="all">Loại khách hàng ⌵</option>
              <option value="enterprise">Doanh nghiệp</option>
              <option value="individual">Cá nhân</option>
              <option value="organization">Tổ chức</option>
            </select>
          </div>

          <div className="relative">
            <button
              type="button"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors"
            >
              Nguồn khách hàng ⌵
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors"
            >
              Người phụ trách ⌵
            </button>
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-3 pr-7 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors cursor-pointer"
            >
              <option value="all">Trạng thái ⌵</option>
              <option value="lead">1. Khách hàng tiềm năng</option>
              <option value="survey">2. Khảo sát &amp; tư vấn</option>
              <option value="quotation">3. Báo giá đề xuất</option>
              <option value="negotiating">4. Đang đàm phán</option>
              <option value="transacting">5. Đang theo dự án</option>
              <option value="re_engagement">Chăm sóc lại</option>
              <option value="inactive">Tạm dừng</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setCustomerSuccessNotice('🔍 Bộ lọc nâng cao: Đang hiển thị toàn bộ phân khúc khách hàng')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors cursor-pointer"
          >
            Bộ lọc khác ⌵
          </button>
        </div>

        {/* Right: View Mode Toggle */}
        <div className="flex items-center gap-1 border border-slate-200 dark:border-slate-700 rounded-xl p-0.5 bg-slate-50 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'list'
                ? 'bg-blue-900 text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
            aria-label="Xem dạng danh sách"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'grid'
                ? 'bg-blue-900 text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
            aria-label="Xem dạng lưới"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─── Row 4: Customer Table &amp; Alerts Sidebar ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Customer Table / Grid (Col 9) */}
        <div className="lg:col-span-9 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-2xs">
          {viewMode === 'list' ? (
            <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[1150px]">
              <thead className="bg-slate-50/70 dark:bg-slate-800/60 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/70 dark:border-slate-800 whitespace-nowrap">
                <tr>
                  <th className="py-3 px-3 text-center whitespace-nowrap w-12">STT</th>
                  <th className="py-3 px-4 whitespace-nowrap">KHÁCH HÀNG</th>
                  <th className="py-3 px-3 whitespace-nowrap">PHÂN LOẠI</th>
                  <th className="py-3 px-3 whitespace-nowrap">NGUỒN KHÁCH HÀNG</th>
                  <th className="py-3 px-3 whitespace-nowrap">NGƯỜI PHỤ TRÁCH</th>
                  <th className="py-3 px-2 text-center whitespace-nowrap">CƠ HỘI</th>
                  <th className="py-3 px-2 text-center whitespace-nowrap">SỐ DỰ ÁN</th>
                  <th className="py-3 px-3 whitespace-nowrap">TỔNG GIÁ TRỊ</th>
                  <th className="py-3 px-3 whitespace-nowrap">CÔNG NỢ</th>
                  <th className="py-3 px-3 whitespace-nowrap">LẦN TƯƠNG TÁC</th>
                  <th className="py-3 px-3 whitespace-nowrap">TRẠNG THÁI</th>
                  <th className="py-3 px-2 text-center whitespace-nowrap">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={`skeleton-row-${idx}`} className="animate-pulse">
                      {/* STT */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <div className="w-5 h-3 bg-slate-200 dark:bg-slate-700 rounded mx-auto" />
                      </td>
                      {/* KHÁCH HÀNG */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-700 shrink-0" />
                          <div className="space-y-1.5">
                            <div className="w-36 h-3.5 bg-slate-200 dark:bg-slate-700 rounded" />
                            <div className="w-20 h-2.5 bg-slate-100 dark:bg-slate-800 rounded" />
                          </div>
                        </div>
                      </td>
                      {/* PHÂN LOẠI */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="w-20 h-5 bg-slate-200 dark:bg-slate-700 rounded-full" />
                      </td>
                      {/* NGUỒN KHÁCH HÀNG */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="w-20 h-5 bg-slate-200 dark:bg-slate-700 rounded-md" />
                      </td>
                      {/* NGƯỜI PHỤ TRÁCH */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                          <div className="w-24 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                        </div>
                      </td>
                      {/* CƠ HỘI */}
                      <td className="py-3.5 px-2 text-center">
                        <div className="w-6 h-4 bg-slate-200 dark:bg-slate-700 rounded mx-auto" />
                      </td>
                      {/* SỐ DỰ ÁN */}
                      <td className="py-3.5 px-2 text-center">
                        <div className="w-6 h-4 bg-slate-200 dark:bg-slate-700 rounded mx-auto" />
                      </td>
                      {/* TỔNG GIÁ TRỊ */}
                      <td className="py-3.5 px-3">
                        <div className="w-16 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                      </td>
                      {/* CÔNG NỢ */}
                      <td className="py-3.5 px-3">
                        <div className="w-14 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                      </td>
                      {/* LẦN TƯƠNG TÁC */}
                      <td className="py-3.5 px-3">
                        <div className="w-20 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                      </td>
                      {/* TRẠNG THÁI */}
                      <td className="py-3.5 px-3">
                        <div className="w-24 h-5 bg-slate-200 dark:bg-slate-700 rounded-full" />
                      </td>
                      {/* THAO TÁC */}
                      <td className="py-3.5 px-2 text-center">
                        <div className="w-6 h-6 bg-slate-200 dark:bg-slate-700 rounded-lg mx-auto" />
                      </td>
                    </tr>
                  ))
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-500 dark:text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Users className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                        <span className="text-sm font-semibold">Không tìm thấy khách hàng nào</span>
                        <span className="text-xs text-slate-400">Thử thay đổi bộ lọc hoặc thêm khách hàng mới</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedCustomers.map((cust, idx) => (
                  <tr
                    key={cust.id}
                    onClick={() => handleOpenCustomer360(cust)}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    {/* STT */}
                    <td className="py-3.5 px-3 text-center font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {(safePage - 1) * pageSize + idx + 1}
                    </td>

                    {/* KHÁCH HÀNG */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-100 flex items-center justify-center">
                          {cust.avatar ? (
                            <Image
                              src={cust.avatar}
                              alt={cust.name}
                              fill
                              sizes="36px"
                              className="object-cover"
                            />
                          ) : (
                            <span className="font-bold text-slate-500 text-xs">
                              {cust.name ? cust.name.charAt(0) : 'K'}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white leading-tight whitespace-nowrap">
                            {cust.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 whitespace-nowrap">
                            {cust.code}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* PHÂN LOẠI */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${cust.typeBadgeClass}`}
                        >
                          {cust.typeLabel}
                        </span>
                        {cust.tier === 'vip' && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800">
                            VIP
                          </span>
                        )}
                      </div>
                    </td>

                    {/* NGUỒN KHÁCH HÀNG */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border whitespace-nowrap ${cust.sourceClass}`}
                      >
                        {cust.source === 'referral' && <Users className="w-3 h-3" />}
                        {cust.source === 'marketing' && <PhoneCall className="w-3 h-3" />}
                        {cust.source === 'partner' && <HeartHandshake className="w-3 h-3" />}
                        {cust.source === 'returning' && <Clock className="w-3 h-3" />}
                        {cust.source === 'website' && <UserCheck className="w-3 h-3" />}
                        {cust.sourceLabel}
                      </span>
                    </td>

                    {/* NGƯỜI PHỤ TRÁCH */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="relative w-6 h-6 rounded-full overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-100 flex items-center justify-center">
                          {cust.managerAvatar ? (
                            <Image
                              src={cust.managerAvatar}
                              alt={cust.managerName}
                              fill
                              sizes="24px"
                              className="object-cover"
                            />
                          ) : (
                            <span className="font-bold text-slate-500 text-[9px]">
                              {cust.managerName ? cust.managerName.charAt(0) : 'Q'}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {cust.managerName}
                        </span>
                      </div>
                    </td>

                    {/* CƠ HỘI */}
                    <td className="py-3.5 px-2 text-center font-bold text-slate-800 dark:text-slate-200">
                      {cust.opportunityCount}
                    </td>

                    {/* SỐ DỰ ÁN */}
                    <td className="py-3.5 px-2 text-center font-bold text-slate-800 dark:text-slate-200">
                      {cust.projectCount}
                    </td>

                    {/* TỔNG GIÁ TRỊ */}
                    <td className="py-3.5 px-3 font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                      {cust.totalValueFormatted}
                    </td>

                    {/* CÔNG NỢ */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {cust.hasDebt ? (
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          {cust.debtFormatted}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">0</span>
                      )}
                    </td>

                    {/* LẦN TƯƠNG TÁC */}
                    <td className="py-3.5 px-3 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {cust.lastInteractionDate}
                    </td>

                    {/* TRẠNG THÁI — interactive lead stage selector */}
                    <td className="py-3.5 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="relative group">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer select-none ${cust.statusBadgeClass}`}
                          title="Nhấn để đổi trạng thái lead"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                          {cust.statusLabel}
                          <ChevronDown className="w-2.5 h-2.5 ml-0.5 opacity-60" />
                        </span>
                        <select
                          value={cust.status}
                          onChange={(e) => void handleUpdateCustomerStatus(cust.id, e.target.value as CustomerStatus)}
                          className="absolute inset-0 w-full opacity-0 cursor-pointer"
                          aria-label={`Đổi trạng thái của ${cust.name}`}
                        >
                          <option value="lead">1. Khách hàng tiềm năng</option>
                          <option value="survey">2. Khảo sát &amp; tư vấn</option>
                          <option value="quotation">3. Báo giá đề xuất</option>
                          <option value="negotiating">4. Đang đàm phán</option>
                          <option value="transacting">5. Đang theo dự án</option>
                          <option value="completed">Đã hoàn thành</option>
                          <option value="re_engagement">Chăm sóc lại</option>
                          <option value="inactive">Tạm dừng</option>
                        </select>
                      </div>
                    </td>

                    {/* THAO TÁC */}
                    <td className="py-3.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleOpenCustomer360(cust)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                        aria-label="Xem hồ sơ Khách hàng 360"
                        title="Xem hồ sơ Khách hàng 360"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={`skeleton-grid-${idx}`}
                  className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3 animate-pulse"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-700 shrink-0" />
                      <div className="space-y-1.5">
                        <div className="w-28 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                        <div className="w-16 h-3 bg-slate-100 dark:bg-slate-800 rounded" />
                      </div>
                    </div>
                    <div className="w-16 h-5 bg-slate-200 dark:bg-slate-700 rounded-full" />
                  </div>
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded" />
                    <div className="w-3/4 h-3 bg-slate-100 dark:bg-slate-800 rounded" />
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="w-16 h-3 bg-slate-100 dark:bg-slate-800 rounded" />
                    <div className="w-20 h-6 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                  </div>
                </div>
              ))
            ) : filteredCustomers.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500 dark:text-slate-400">
                <div className="flex flex-col items-center justify-center gap-2">
                  <Users className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                  <span className="text-sm font-semibold">Không tìm thấy khách hàng nào</span>
                  <span className="text-xs text-slate-400">Thử thay đổi bộ lọc hoặc thêm khách hàng mới</span>
                </div>
              </div>
            ) : (
              paginatedCustomers.map((cust) => (
              <div
                key={cust.id}
                className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-100 flex items-center justify-center">
                      {cust.avatar ? (
                        <Image src={cust.avatar} alt={cust.name} fill sizes="36px" className="object-cover" />
                      ) : (
                        <span className="font-bold text-slate-500 text-xs">
                          {cust.name ? cust.name.charAt(0) : 'K'}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">{cust.name}</div>
                      <div className="text-[10px] font-mono text-slate-400">{cust.code}</div>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${cust.statusBadgeClass}`}>
                    {cust.statusLabel}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs space-y-1 text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between items-center">
                    <span>Phân loại:</span>
                    <div className="flex items-center gap-1">
                      <strong className="text-slate-800 dark:text-slate-200">{cust.typeLabel}</strong>
                      {cust.tier === 'vip' && (
                        <span className="inline-flex px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800">
                          VIP
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span>Tổng giá trị:</span> <strong className="text-amber-600 dark:text-amber-400 font-mono">{cust.totalValueFormatted}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Phụ trách:</span> <span className="font-medium text-slate-800 dark:text-slate-200">{cust.managerName}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] text-slate-400 font-medium">{cust.projectCount} dự án</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenCustomer360(cust)}
                      className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-[11px] font-semibold text-blue-700 dark:text-blue-300 transition-colors"
                    >
                      Hồ sơ 360
                    </button>
                    <Link
                      href="/dashboard/interior/projects"
                      className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      Dự án →
                    </Link>
                  </div>
                </div>
              </div>
            ))
            )}
          </div>
        )}

        {/* Pagination Bar */}
        {!isLoading && totalItems > 0 && (
          <div className="px-4 py-3 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
              <span>
                Hiển thị <strong className="text-slate-900 dark:text-white font-semibold">{(safePage - 1) * pageSize + 1}</strong> – <strong className="text-slate-900 dark:text-white font-semibold">{Math.min(safePage * pageSize, totalItems)}</strong> trong <strong className="text-slate-900 dark:text-white font-semibold">{totalItems}</strong> khách hàng
              </span>
              <div className="hidden sm:flex items-center gap-1.5 ml-2">
                <span className="text-[11px] text-slate-400">Số dòng:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center gap-1 font-medium"
                aria-label="Trang trước"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Trước</span>
              </button>

              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => {
                    return page === 1 || page === totalPages || Math.abs(page - safePage) <= 1;
                  })
                  .reduce<(number | string)[]>((acc, page, idx, arr) => {
                    if (idx > 0 && page - (arr[idx - 1] as number) > 1) {
                      acc.push('...');
                    }
                    acc.push(page);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    typeof item === 'string' ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 text-xs select-none">
                        …
                      </span>
                    ) : (
                      <button
                        key={`page-${item}`}
                        type="button"
                        onClick={() => setCurrentPage(item)}
                        className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center ${
                          safePage === item
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center gap-1 font-medium"
                aria-label="Trang sau"
              >
                <span className="hidden sm:inline">Sau</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

        {/* Alerts & Action Items (Col 3) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-rose-500" />
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                Cảnh báo &amp; Công việc cần xử lý
              </h2>
            </div>
            <Link
              href="/dashboard/interior/schedule"
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
            >
              Xem tất cả →
            </Link>
          </div>

          <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={`alert-skel-${idx}`} className="py-2.5 first:pt-1 last:pb-1 flex items-start gap-2.5 animate-pulse">
                  <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="w-24 h-3.5 bg-slate-200 dark:bg-slate-700 rounded" />
                      <div className="w-12 h-2.5 bg-slate-100 dark:bg-slate-800 rounded" />
                    </div>
                    <div className="w-36 h-2.5 bg-slate-100 dark:bg-slate-800 rounded" />
                  </div>
                </div>
              ))
            ) : data.alerts.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                Không có cảnh báo phát sinh
              </div>
            ) : (
              data.alerts.map((alert) => (
                <div key={alert.id} className="py-2.5 first:pt-1 last:pb-1 flex items-start gap-2.5">
                  <div className="mt-0.5 shrink-0">
                    {alert.severity === 'critical' && (
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                    )}
                    {alert.severity === 'warning' && (
                      <Clock className="w-4 h-4 text-amber-500" />
                    )}
                    {alert.severity === 'info' && (
                      <Info className="w-4 h-4 text-blue-500" />
                    )}
                    {alert.severity === 'success' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {alert.title}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {alert.date}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {alert.subtitle}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── Row 5: Financial Summary, Source Distribution & Action Suggestion ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 items-stretch">
        {/* Card 1: Tổng quan tài chính khách hàng (5 Cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              Tổng quan tài chính khách hàng
            </h2>
          </div>

          {isLoading ? (
            <div className="mt-4 flex items-center justify-between gap-4 animate-pulse">
              <div className="space-y-3 flex-1">
                <div className="space-y-1">
                  <div className="w-24 h-5 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="w-28 h-3 bg-slate-100 dark:bg-slate-800 rounded" />
                </div>
                <div className="space-y-1">
                  <div className="w-20 h-5 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="w-16 h-3 bg-slate-100 dark:bg-slate-800 rounded" />
                </div>
                <div className="space-y-1">
                  <div className="w-20 h-5 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="w-24 h-3 bg-slate-100 dark:bg-slate-800 rounded" />
                </div>
              </div>
              <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-between gap-4">
              {/* 3 Metric Columns */}
              <div className="space-y-3">
                <div>
                  <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {data.financialSummary.totalContractValueFormatted}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-400">
                    Tổng giá trị hợp đồng
                  </div>
                </div>

                <div>
                  <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {data.financialSummary.collectedFormatted}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-400">
                    Đã thu
                  </div>
                </div>

                <div>
                  <div className="text-lg font-extrabold text-amber-600 dark:text-amber-400">
                    {data.financialSummary.receivableDebtFormatted}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-400">
                    Công nợ phải thu
                  </div>
                </div>
              </div>

              {/* Circular Gauge */}
              <div className="flex flex-col items-center">
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    {/* Background Circle */}
                    <path
                      className="text-slate-100 dark:text-slate-800"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    {/* Progress Circle */}
                    <path
                      className="text-emerald-500"
                      strokeDasharray={`${Math.min(100, Math.max(0, data.financialSummary.collectionRatePercent))}, 100`}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-base font-extrabold text-slate-900 dark:text-white">
                      {data.financialSummary.collectionRatePercent}%
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1">
                  Tỷ lệ thu tiền
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Khách hàng tiềm năng theo nguồn (4 Cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <PieChartIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              Khách hàng tiềm năng theo nguồn
            </h2>
          </div>

          {isLoading ? (
            <div className="mt-4 flex items-center justify-around gap-4 animate-pulse">
              <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
              <div className="space-y-2 flex-1 max-w-[140px]">
                <div className="w-full h-3.5 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="w-3/4 h-3.5 bg-slate-100 dark:bg-slate-800 rounded" />
                <div className="w-2/3 h-3.5 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-around gap-4">
              {/* Donut Chart SVG - Truly Canonical Dynamic Slices */}
              <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  {/* Background Track */}
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="currentColor"
                    className="text-slate-100 dark:text-slate-800"
                    strokeWidth="4"
                  />
                  {(() => {
                    const circumference = 87.96459;
                    let accumulated = 0;
                    const items = data.sourceDistribution.filter((s) => s.percentage > 0);
                    if (items.length === 0) {
                      return (
                        <circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="none"
                          stroke="#94a3b8"
                          strokeWidth="4"
                          strokeDasharray={`${circumference} 0`}
                        />
                      );
                    }
                    return items.map((src, i) => {
                      const strokeDash = (src.percentage / 100) * circumference;
                      const strokeSpace = circumference - strokeDash;
                      const strokeOffset = -((accumulated / 100) * circumference);
                      accumulated += src.percentage;
                      return (
                        <circle
                          key={`donut-${src.source}-${i}`}
                          cx="18"
                          cy="18"
                          r="14"
                          fill="none"
                          stroke={src.color}
                          strokeWidth="4"
                          strokeDasharray={`${strokeDash.toFixed(2)} ${strokeSpace.toFixed(2)}`}
                          strokeDashoffset={strokeOffset.toFixed(2)}
                          strokeLinecap="butt"
                        />
                      );
                    });
                  })()}
                </svg>
              </div>

              {/* Legend */}
              <div className="space-y-2">
                {data.sourceDistribution.length === 0 ? (
                  <span className="text-xs text-slate-400">Chưa có dữ liệu nguồn</span>
                ) : (
                  data.sourceDistribution.map((src) => (
                    <div key={src.source} className="flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full inline-block"
                          style={{ backgroundColor: src.color }}
                        />
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {src.label}
                        </span>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {src.percentage}%
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Card 3: Gợi ý hành động (3 Cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
          {isLoading ? (
            <div className="space-y-4 animate-pulse">
              <div className="space-y-2">
                <div className="w-28 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded" />
                <div className="w-3/4 h-3 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
              <div className="w-32 h-7 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            </div>
          ) : (
            <>
              <div>
                <div className="flex items-center gap-2 pb-2">
                  <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    {data.actionSuggestion.title || 'Gợi ý hành động'}
                  </h2>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  {data.actionSuggestion.description || 'Theo dõi và cập nhật tiến độ tương tác với khách hàng thường xuyên.'}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between">
                {data.actionSuggestion.ctaLink ? (
                  <Link
                    href={data.actionSuggestion.ctaLink}
                    className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-2xs transition-colors"
                  >
                    {data.actionSuggestion.ctaLabel || 'Xem chi tiết →'}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddCustomerOpen(true)}
                    className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-2xs transition-colors"
                  >
                    Thêm khách hàng mới
                  </button>
                )}
                {/* Decorative Mini Trend Vector */}
                <div className="w-12 h-8">
                  <svg viewBox="0 0 50 30" className="w-full h-full text-blue-500/40">
                    <path
                      d="M5 25 L15 18 L25 22 L45 5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Modal Thêm Khách Hàng (Interior CRM Full Dossier) ─── */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Thêm Khách Hàng Mới (Interior CRM)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Nhập đầy đủ thông tin định danh, liên hệ, công trình và nhu cầu thiết kế để lưu trực tiếp vào cơ sở dữ liệu.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isSubmittingCustomer) {
                    setIsAddCustomerOpen(false);
                    resetCustomerForm();
                  }
                }}
                disabled={isSubmittingCustomer}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-semibold p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleAddCustomer} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              {/* Alert Error */}
              {customerError && (
                <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Không thể lưu khách hàng</div>
                    <div className="text-[11px] mt-0.5">{customerError}</div>
                  </div>
                </div>
              )}

              {/* Alert Success */}
              {customerSuccessNotice && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span className="font-semibold">{customerSuccessNotice}</span>
                </div>
              )}

              {/* 1. Phân loại & Phân hạng */}
              <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 text-xs">
                  <Building2 className="w-3.5 h-3.5 text-orange-600" />
                  <span>1. Phân loại chủ thể &amp; Phân hạng</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Loại khách hàng <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newCustomerType}
                      onChange={(e) => setNewCustomerType(e.target.value as 'individual' | 'enterprise')}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                    >
                      <option value="individual">Cá nhân (Chủ nhà / Biệt thự / Căn hộ)</option>
                      <option value="enterprise">Doanh nghiệp / Tổ chức / Chủ đầu tư</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Phân hạng khách hàng
                    </label>
                    <select
                      value={newCustomerTier}
                      onChange={(e) => setNewCustomerTier(e.target.value as 'standard' | 'silver' | 'gold' | 'vip')}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                    >
                      <option value="standard">Tiêu chuẩn (Standard)</option>
                      <option value="silver">Bạc (Silver)</option>
                      <option value="gold">Vàng (Gold)</option>
                      <option value="vip">VIP / Thượng lưu</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Nguồn tiếp cận
                    </label>
                    <select
                      value={newCustomerSource}
                      onChange={(e) => setNewCustomerSource(e.target.value as CustomerSource)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                    >
                      <option value="website">Website / KTS giới thiệu</option>
                      <option value="referral">Khách hàng cũ giới thiệu</option>
                      <option value="partner">Showroom / Đối tác</option>
                      <option value="marketing">Marketing / Mạng xã hội</option>
                      <option value="returning">Khách hàng quay lại</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Thông tin định danh & Liên hệ */}
              <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 text-xs">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  <span>2. Thông tin liên hệ &amp; Định danh</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Họ và tên khách hàng / Đại diện <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                        placeholder="Ví dụ: Bà Lê Hoàng Phương"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        required
                      />
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Số điện thoại chính <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                        placeholder="Ví dụ: 0908 123 456"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                        required
                      />
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Email liên hệ
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={newCustomerEmail}
                        onChange={(e) => setNewCustomerEmail(e.target.value)}
                        placeholder="hoang.phuong@example.com"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Chuyên viên Sale / CSKH <span className="text-slate-400 font-normal text-xs">(Tùy chọn)</span>
                    </label>
                    <select
                      value={newCustomerSale}
                      onChange={(e) => setNewCustomerSale(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                    >
                      <option value="">— Chưa phân công Sale —</option>
                      <option value="Nguyễn Văn Nam (Sale)">Nguyễn Văn Nam (Sales tư vấn)</option>
                      <option value="Trần Thị Mai (CSKH)">Trần Thị Mai (Chăm sóc khách hàng)</option>
                      <option value="Đỗ Quốc Huy (Sales Lead)">Đỗ Quốc Huy (Trưởng nhóm Kinh doanh)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Kiến trúc sư phụ trách (KTS) <span className="text-slate-400 font-normal text-xs">(Tùy chọn)</span>
                    </label>
                    <select
                      value={newCustomerArchitect}
                      onChange={(e) => setNewCustomerArchitect(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                    >
                      <option value="">— Chưa phân công KTS —</option>
                      <option value="KTS. Lê Hoàng Quân">KTS. Lê Hoàng Quân (Chủ trì thiết kế)</option>
                      <option value="KTS. Nguyễn Minh Khoa">KTS. Nguyễn Minh Khoa (Nội thất hiện đại)</option>
                      <option value="KTS. Phạm Thu Hà">KTS. Phạm Thu Hà (Cổ điển &amp; Indochine)</option>
                      <option value="Trần Văn Quản Lý">Trần Văn Quản Lý (Giám sát &amp; Quản trị)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Trạng thái lead
                    </label>
                    <select
                      value={newCustomerStatus}
                      onChange={(e) => setNewCustomerStatus(e.target.value as CustomerStatus)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                    >
                      <option value="lead">🔵 1. Khách hàng tiềm năng (Mới tiếp nhận)</option>
                      <option value="survey">🟢 2. Khảo sát &amp; Tư vấn thiết kế</option>
                      <option value="quotation">🟡 3. Báo giá &amp; Dự toán đề xuất</option>
                      <option value="negotiating">🟣 4. Đàm phán &amp; Chốt hợp đồng</option>
                      <option value="transacting">🟢 5. Đã ký hợp đồng &amp; Đang thi công</option>
                      <option value="re_engagement">🟠 Chăm sóc lại</option>
                      <option value="inactive">⚪ Tạm dừng / Chưa có nhu cầu</option>
                    </select>
                  </div>
                </div>

                {/* Doanh nghiệp extra fields */}
                {newCustomerType === 'enterprise' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-200/60 dark:border-slate-750">
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                        Tên công ty / Doanh nghiệp pháp nhân
                      </label>
                      <input
                        type="text"
                        value={newCustomerLegalName}
                        onChange={(e) => setNewCustomerLegalName(e.target.value)}
                        placeholder="Công ty TNHH Phát triển Đô thị..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                        Mã số thuế (MST)
                      </label>
                      <input
                        type="text"
                        value={newCustomerTaxCode}
                        onChange={(e) => setNewCustomerTaxCode(e.target.value)}
                        placeholder="0312345678"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Địa chỉ công trình / Dự án nội thất */}
              <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 text-xs">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>3. Địa chỉ công trình &amp; Dự án nội thất</span>
                </div>

                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Địa chỉ chi tiết (Căn hộ / Tòa nhà / Số nhà &amp; Đường)
                    </label>
                    <input
                      type="text"
                      value={newCustomerAddress}
                      onChange={(e) => setNewCustomerAddress(e.target.value)}
                      placeholder="Ví dụ: Căn 18.04, Tháp Aqua 1, Vinhomes Golden River, Số 2 Tôn Đức Thắng"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                        Tỉnh / Thành phố
                      </label>
                      <select
                        value={newCustomerCity}
                        onChange={(e) => setNewCustomerCity(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                      >
                        <option value="TP. Hồ Chí Minh">TP. Hồ Chí Minh</option>
                        <option value="Hà Nội">Hà Nội</option>
                        <option value="Đà Nẵng">Đà Nẵng</option>
                        <option value="Bình Dương">Bình Dương</option>
                        <option value="Đồng Nai">Đồng Nai</option>
                        <option value="Bà Rịa - Vũng Tàu">Bà Rịa - Vũng Tàu</option>
                        <option value="Khác">Tỉnh thành khác</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                        Quận / Huyện
                      </label>
                      <input
                        type="text"
                        value={newCustomerDistrict}
                        onChange={(e) => setNewCustomerDistrict(e.target.value)}
                        placeholder="Ví dụ: Quận 1, TP. Thủ Đức, Bình Thạnh..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Nhu cầu & Ghi chú thiết kế */}
              <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 text-xs">
                  <FileText className="w-3.5 h-3.5 text-purple-600" />
                  <span>4. Nhu cầu thiết kế &amp; Ghi chú ban đầu</span>
                </div>

                <div>
                  <textarea
                    rows={3}
                    value={newCustomerNotes}
                    onChange={(e) => setNewCustomerNotes(e.target.value)}
                    placeholder="Ghi chú phong cách thiết kế mong muốn (Hiện đại, Tân cổ điển, Indochine...), diện tích dự kiến, ngân sách dự kiến, thời hạn cần hoàn thiện..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[11px] text-slate-400">
                  <span className="text-red-500">*</span> Các trường bắt buộc nhập
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isSubmittingCustomer) {
                        setIsAddCustomerOpen(false);
                        resetCustomerForm();
                      }
                    }}
                    disabled={isSubmittingCustomer}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingCustomer}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-semibold shadow-sm hover:shadow transition-all"
                  >
                    {isSubmittingCustomer ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang lưu vào hệ thống...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Lưu Khách Hàng</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer 360 Detail Modal */}
      <Customer360Modal
        isOpen={is360ModalOpen}
        onClose={() => setIs360ModalOpen(false)}
        customerId={selectedCustomerId}
        initialCustomerName={selectedCustomerName}
        authToken={sharedAuthToken}
      />
    </div>
  );
}
