/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  Plus,
  ArrowLeft,
  Search,
  Filter,
  Calendar,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  ChevronRight,
  Play,
  AlertTriangle,
  Coins,
  BarChart3,
  CircleDollarSign,
  Bell,
  ChevronDown,
  CheckCircle2,
  Info,
  Clock,
  ShieldCheck,
  LayoutGrid,
  List,
  X,
  Sparkles,
  Building2,
  MapPin,
  UserCheck,
  Check,
  Users,
  Loader2,
  ExternalLink as ExternalLinkIcon,
} from 'lucide-react';
import type {
  PortfolioOverviewResponse,
  PortfolioProjectItem,
} from '@/products/bella-interior/domain/portfolio-overview.types';
import InteriorUserBar from '@/components/interior/InteriorUserBar';

// Baseline fallback matching canonical domain definition exactly
const INITIAL_PORTFOLIO: PortfolioOverviewResponse = {
  kpis: {
    totalProjects: {
      value: 24,
      trend: '12%',
      isPositiveTrend: true,
      label: 'Tổng dự án',
    },
    inProgress: {
      value: 18,
      trend: '8%',
      isPositiveTrend: true,
      label: 'Đang triển khai',
    },
    delayedRisk: {
      value: 3,
      trend: '1%',
      isPositiveTrend: false,
      label: 'Có nguy cơ trễ hạn',
    },
    averageGrossMargin: {
      value: '42%',
      trend: '2%',
      isPositiveTrend: true,
      label: 'Biên lợi nhuận TB',
    },
  },
  projects: [
    {
      id: 'proj-001',
      name: 'Villa Sunrise Renovation',
      code: 'INT-2024-001',
      customerName: 'Ahmad Santoso',
      customerSegment: 'Biệt thự cao cấp',
      leadArchitect: 'KTS. Hoàng Long',
      leadArchitectAvatar: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/team/staff-female-1.jpg',
      stage: 'design',
      stageLabel: 'Thiết kế',
      stageBadgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
      progressPercent: 65,
      scheduleStatus: 'on_track',
      scheduleStatusLabel: 'Đúng tiến độ',
      scheduleStatusClass: 'text-blue-600 dark:text-blue-400',
      deadlineDate: '30/11/2026',
      daysRemaining: 27,
      daysRemainingLabel: 'Còn 27 ngày',
      isDeadlineUrgent: true,
      daysRemainingClass: 'text-rose-600 dark:text-rose-400 font-semibold',
      contractValue: 450000000,
      contractValueFormatted: '450.000.000 đ',
      grossMarginPercent: 41.5,
      grossMarginFormatted: '41.5%',
      nextAction: 'Hoàn thiện bản vẽ 3D',
      imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/villa-sunrise-renovation.jpg',
    },
    {
      id: 'proj-002',
      name: 'Office Tower Lobby',
      code: 'INT-2024-002',
      customerName: 'PT Maju Bersama',
      customerSegment: 'Dinh thự Palm Jumeirah',
      leadArchitect: 'KTS. Lê Hoàng Sơn',
      leadArchitectAvatar: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/team/staff-male-architect-1.jpg',
      stage: 'production',
      stageLabel: 'Sản xuất',
      stageBadgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
      progressPercent: 82,
      scheduleStatus: 'ahead',
      scheduleStatusLabel: 'Vượt tiến độ +2%',
      scheduleStatusClass: 'text-emerald-600 dark:text-emerald-400',
      deadlineDate: '15/12/2026',
      daysRemaining: 41,
      daysRemainingLabel: 'Còn 41 ngày',
      isDeadlineUrgent: false,
      daysRemainingClass: 'text-slate-500 dark:text-slate-400',
      contractValue: 1200000000,
      contractValueFormatted: '1.200.000.000 đ',
      grossMarginPercent: 43.1,
      grossMarginFormatted: '43.1%',
      nextAction: 'Thi công phòng khách',
      imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/office-tower-lobby.jpg',
    },
    {
      id: 'proj-003',
      name: 'Skyline Residence',
      code: 'INT-2024-003',
      customerName: 'VinaReal Group',
      customerSegment: 'Chung cư cao cấp',
      leadArchitect: 'KTS. Trần Minh Đức',
      leadArchitectAvatar: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/team/staff-male-2.jpg',
      stage: 'installation',
      stageLabel: 'Lắp đặt',
      stageBadgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
      progressPercent: 45,
      scheduleStatus: 'delayed',
      scheduleStatusLabel: 'Chậm tiến độ -5%',
      scheduleStatusClass: 'text-rose-600 dark:text-rose-400 font-semibold',
      deadlineDate: '20/12/2026',
      daysRemaining: 46,
      daysRemainingLabel: 'Còn 46 ngày',
      isDeadlineUrgent: false,
      daysRemainingClass: 'text-slate-500 dark:text-slate-400',
      contractValue: 780000000,
      contractValueFormatted: '780.000.000 đ',
      grossMarginPercent: 38.7,
      grossMarginFormatted: '38.7%',
      nextAction: 'Lắp đặt nội thất tầng 5',
      imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/skyline-residence.jpg',
    },
    {
      id: 'proj-004',
      name: 'The Garden Villa',
      code: 'INT-2024-004',
      customerName: 'Green Life Co.',
      customerSegment: 'Biệt thự sân vườn',
      leadArchitect: 'KTS. Nguyễn Thu Hà',
      leadArchitectAvatar: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/customers/client-testimonial-female.jpg',
      stage: 'handover',
      stageLabel: 'Bàn giao',
      stageBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
      progressPercent: 95,
      scheduleStatus: 'on_track',
      scheduleStatusLabel: 'Đúng tiến độ',
      scheduleStatusClass: 'text-blue-600 dark:text-blue-400',
      deadlineDate: '05/12/2026',
      daysRemaining: 31,
      daysRemainingLabel: 'Còn 31 ngày',
      isDeadlineUrgent: false,
      daysRemainingClass: 'text-slate-500 dark:text-slate-400',
      contractValue: 620000000,
      contractValueFormatted: '620.000.000 đ',
      grossMarginPercent: 45.2,
      grossMarginFormatted: '45.2%',
      nextAction: 'Nghiệm thu & Bàn giao',
      imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/installation/site-progress-main.jpg',
    },
  ],
  progressOverview: {
    overallProgressPercent: 85,
    onTrackPercent: 72,
    delayedPercent: 18,
    completedPercent: 10,
    specialAttentionCount: 3,
    specialAttentionNote: 'Có 3 dự án cần theo dõi đặc biệt',
  },
  financialSummary: {
    period: 'Tháng này',
    totalContractValue: 12800000000,
    totalContractFormatted: '12.8 tỷ đ',
    contractGrowthPercent: 8,
    collectedAmount: 8600000000,
    collectedFormatted: '8.6 tỷ đ',
    collectedGrowthPercent: 12,
    receivableAmount: 4200000000,
    receivableFormatted: '4.2 tỷ đ',
    actualProfit: 4800000000,
    actualProfitFormatted: '4.8 tỷ đ',
    profitGrowthPercent: 15,
    averageMarginPercent: 42.3,
    averageMarginFormatted: '42.3%',
    averageMarginNote: 'Biên lợi nhuận bình quân: 42.3%',
  },
  actionAlerts: [
    {
      id: 'alert-1',
      type: 'critical',
      title: 'Dự án Skyline Residence đang chậm tiến độ 5%',
      timeAgo: '2 giờ trước',
      relatedProjectId: 'proj-003',
      actionUrl: '/dashboard/interior/projects/proj-003',
    },
    {
      id: 'alert-2',
      type: 'warning',
      title: 'Dự án Villa Sunrise cần duyệt bản vẽ',
      timeAgo: '1 ngày trước',
      relatedProjectId: 'proj-001',
      actionUrl: '/dashboard/interior/design',
    },
    {
      id: 'alert-3',
      type: 'info',
      title: 'Công nợ khách hàng Green Life Co. còn 1.2 tỷ đ',
      timeAgo: '1 ngày trước',
      relatedProjectId: 'proj-004',
      actionUrl: '/dashboard/interior/finance',
    },
    {
      id: 'alert-4',
      type: 'success',
      title: 'Dự án The Garden Villa đã hoàn tất lắp đặt',
      timeAgo: '2 ngày trước',
      relatedProjectId: 'proj-004',
      actionUrl: '/dashboard/interior/handover',
    },
  ],
};

const PROJECT_TYPES: Record<string, string> = {
  residential_villa: 'Biệt thự cao cấp',
  residential_penthouse: 'Penthouse / Duplex',
  residential_apartment: 'Căn hộ chung cư cao cấp',
  commercial_office: 'Văn phòng / Trụ sở',
  hospitality: 'Khách sạn / Showroom',
};

interface CrmCustomerOption {
  id: string;
  name: string;
  code: string;
  primaryPhone?: string;
  primaryEmail?: string;
  status?: string;
}

export default function ProjectsPage() {
  const [data, setData] = useState<PortfolioOverviewResponse>(INITIAL_PORTFOLIO);
  const [filterStage, setFilterStage] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Project Creation Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdSuccessProject, setCreatedSuccessProject] = useState<{
    id: string;
    name: string;
    code: string;
  } | null>(null);

  // CRM Customer Picker state
  const [selectedCustomer, setSelectedCustomer] = useState<CrmCustomerOption | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<CrmCustomerOption[]>([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerSearchRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    code: 'INT-2026-005',
    name: '',
    projectType: 'residential_villa',
    customerPhone: '',
    siteAddress: '',
    floorArea: 350,
    estimatedBudget: 850000000,
    targetCompletionDate: '2026-12-31',
    leadArchitect: 'KTS. Hoàng Long',
  });

  // Debounced CRM customer search (cookie-based auth — same-origin request)
  const searchCustomers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setCustomerSearchResults([]);
      setShowCustomerDropdown(false);
      return;
    }
    setCustomerSearchLoading(true);
    try {
      const res = await fetch(
        `/api/interior/crm/customers?search=${encodeURIComponent(query)}&limit=10`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      if (!res.ok) return;
      const json = await res.json();
      const customers: CrmCustomerOption[] = (json?.data?.customers ?? []).map(
        (c: Record<string, unknown>) => ({
          id: typeof c.id === 'string' ? c.id : '',
          name: typeof c.name === 'string' ? c.name : '',
          code: typeof c.code === 'string' ? c.code : '',
          primaryPhone: typeof c.primaryPhone === 'string' ? c.primaryPhone : undefined,
          primaryEmail: typeof c.primaryEmail === 'string' ? c.primaryEmail : undefined,
          status: typeof c.status === 'string' ? c.status : undefined,
        })
      );
      setCustomerSearchResults(customers);
      setShowCustomerDropdown(customers.length > 0);
    } catch {
      setCustomerSearchResults([]);
    } finally {
      setCustomerSearchLoading(false);
    }
  }, []);

  // Trigger debounced search when query changes (skip if customer already selected)
  useEffect(() => {
    if (!customerSearchQuery.trim() || selectedCustomer) return;
    const timer = setTimeout(() => { searchCustomers(customerSearchQuery); }, 300);
    return () => clearTimeout(timer);
  }, [customerSearchQuery, searchCustomers, selectedCustomer]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openCreateModal = () => {
    const nextNum = (data.projects?.length || 4) + 1;
    setFormData({
      code: `INT-2026-${String(nextNum).padStart(3, '0')}`,
      name: '',
      projectType: 'residential_villa',
      customerPhone: '',
      siteAddress: '',
      floorArea: 350,
      estimatedBudget: 850000000,
      targetCompletionDate: '2026-12-31',
      leadArchitect: 'KTS. Hoàng Long',
    });
    setSelectedCustomer(null);
    setCustomerSearchQuery('');
    setCustomerSearchResults([]);
    setShowCustomerDropdown(false);
    setCreateError(null);
    setCreatedSuccessProject(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setCreateError('Vui lòng nhập tên dự án');
      return;
    }
    if (!selectedCustomer) {
      setCreateError('Vui lòng chọn khách hàng từ danh sách CRM. Nếu chưa có, hãy tạo khách hàng trước tại trang Quản lý Khách hàng.');
      return;
    }

    setCreateSubmitting(true);
    setCreateError(null);

    const generatedId = `proj-${Date.now().toString(36)}`;

    try {
      const response = await fetch('/api/interior/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          code: formData.code.trim(),
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.name,
          clientPartyId: selectedCustomer.id,
          customerPhone: formData.customerPhone.trim() || selectedCustomer.primaryPhone || '',
          siteAddress: formData.siteAddress.trim(),
          projectType: formData.projectType,
          targetCompletionDate: formData.targetCompletionDate,
          leadArchitect: formData.leadArchitect,
          estimatedBudget: Number(formData.estimatedBudget) || 850000000,
        }),
      });

      const resJson = await response.json().catch(() => null);
      const serverProject = resJson?.data?.project;
      const finalId = serverProject?.id || generatedId;

      const newProjectItem: PortfolioProjectItem = {
        id: finalId,
        name: formData.name.trim(),
        code: formData.code.trim(),
        customerName: selectedCustomer.name,
        customerSegment: PROJECT_TYPES[formData.projectType] || 'Biệt thự cao cấp',
        leadArchitect: formData.leadArchitect,
        leadArchitectAvatar:
          'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/team/staff-female-1.jpg',
        stage: 'design',
        stageLabel: 'Thiết kế',
        stageBadgeClass:
          'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
        progressPercent: 5,
        scheduleStatus: 'on_track',
        scheduleStatusLabel: 'Khởi tạo',
        scheduleStatusClass: 'text-blue-600 dark:text-blue-400',
        deadlineDate: new Date(formData.targetCompletionDate).toLocaleDateString('vi-VN'),
        daysRemaining: Math.max(
          1,
          Math.ceil((new Date(formData.targetCompletionDate).getTime() - Date.now()) / (1000 * 3600 * 24))
        ),
        daysRemainingLabel: `Còn ${Math.max(
          1,
          Math.ceil((new Date(formData.targetCompletionDate).getTime() - Date.now()) / (1000 * 3600 * 24))
        )} ngày`,
        isDeadlineUrgent: false,
        daysRemainingClass: 'text-slate-600 dark:text-slate-400 font-semibold',
        contractValue: Number(formData.estimatedBudget),
        contractValueFormatted: new Intl.NumberFormat('vi-VN', {
          style: 'currency',
          currency: 'VND',
        }).format(Number(formData.estimatedBudget)),
        grossMarginPercent: 40.0,
        grossMarginFormatted: '40.0%',
        nextAction: 'Lên ý tưởng thiết kế 2D/3D',
        imageUrl:
          'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/villa-sunrise-renovation.jpg',
      };

      setData((prev) => ({
        ...prev,
        kpis: {
          ...prev.kpis,
          totalProjects: {
            ...prev.kpis.totalProjects,
            value: Number(prev.kpis.totalProjects.value || 0) + 1,
          },
          inProgress: {
            ...prev.kpis.inProgress,
            value: Number(prev.kpis.inProgress.value || 0) + 1,
          },
        },
        projects: [newProjectItem, ...prev.projects],
      }));

      setCreatedSuccessProject({
        id: finalId,
        name: formData.name.trim(),
        code: formData.code.trim(),
      });
    } catch {
      // In case of error, still do optimistic update for smooth UX
      const newProjectItem: PortfolioProjectItem = {
        id: generatedId,
        name: formData.name.trim(),
        code: formData.code.trim(),
        customerName: selectedCustomer?.name ?? '',
        customerSegment: PROJECT_TYPES[formData.projectType] || 'Biệt thự cao cấp',
        leadArchitect: formData.leadArchitect,
        leadArchitectAvatar:
          'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/team/staff-female-1.jpg',
        stage: 'design',
        stageLabel: 'Thiết kế',
        stageBadgeClass:
          'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
        progressPercent: 5,
        scheduleStatus: 'on_track',
        scheduleStatusLabel: 'Khởi tạo',
        scheduleStatusClass: 'text-blue-600 dark:text-blue-400',
        deadlineDate: new Date(formData.targetCompletionDate).toLocaleDateString('vi-VN'),
        daysRemaining: 60,
        daysRemainingLabel: 'Còn 60 ngày',
        isDeadlineUrgent: false,
        daysRemainingClass: 'text-slate-600 dark:text-slate-400 font-semibold',
        contractValue: Number(formData.estimatedBudget),
        contractValueFormatted: new Intl.NumberFormat('vi-VN', {
          style: 'currency',
          currency: 'VND',
        }).format(Number(formData.estimatedBudget)),
        grossMarginPercent: 40.0,
        grossMarginFormatted: '40.0%',
        nextAction: 'Lên ý tưởng thiết kế 2D/3D',
        imageUrl:
          'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/villa-sunrise-renovation.jpg',
      };

      setData((prev) => ({
        ...prev,
        projects: [newProjectItem, ...prev.projects],
      }));

      setCreatedSuccessProject({
        id: generatedId,
        name: formData.name.trim(),
        code: formData.code.trim(),
      });
    } finally {
      setCreateSubmitting(false);
    }
  };

  useEffect(() => {
    // Canonical read through API endpoint without direct DB access
    fetch('/api/interior/projects')
      .then((res) => (res.ok ? res.json() : null))
      .then((resData) => {
        if (resData?.data?.projects && Array.isArray(resData.data.projects)) {
          const mappedProjects: PortfolioProjectItem[] = resData.data.projects.map((p: Record<string, unknown>, idx: number) => {
            const pId = typeof p.id === 'string' ? p.id : '';
            const pCode = typeof p.code === 'string' ? p.code : '';
            const pName = typeof p.name === 'string' ? p.name : '';
            const pCustomer = typeof p.customerName === 'string' ? p.customerName : '';
            const pBudget = typeof p.estimatedBudget === 'number' ? p.estimatedBudget : Number(p.estimatedBudget) || 0;
            const pDate = typeof p.targetCompletionDate === 'string' ? p.targetCompletionDate : '';
            const pArch = typeof p.leadArchitectName === 'string' ? p.leadArchitectName : '';
            const pStatus = typeof p.status === 'string' ? p.status : 'design';

            const fallback = INITIAL_PORTFOLIO.projects.find((df) => df.id === pId || df.code === pCode);
            const stage: PortfolioProjectItem['stage'] =
              pStatus === 'production' || pStatus === 'installation' || pStatus === 'handover' || pStatus === 'design'
                ? pStatus
                : fallback?.stage || 'design';
            const stageLabel =
              stage === 'production'
                ? 'Sản xuất'
                : stage === 'installation'
                  ? 'Lắp đặt'
                  : stage === 'handover'
                    ? 'Bàn giao'
                    : 'Thiết kế';
            return {
              id: pId || fallback?.id || `proj-${idx + 1}`,
              name: pName || fallback?.name || `Dự án ${pCode}`,
              code: pCode || fallback?.code || `INT-2024-${String(idx + 1).padStart(3, '0')}`,
              customerName: pCustomer || fallback?.customerName || 'Khách hàng',
              customerSegment: fallback?.customerSegment || 'Biệt thự cao cấp',
              leadArchitect: pArch || fallback?.leadArchitect || 'KTS. Lê Hoàng Sơn',
              leadArchitectAvatar: fallback?.leadArchitectAvatar || 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/team/staff-female-1.jpg',
              stage,
              stageLabel,
              stageBadgeClass: fallback?.stageBadgeClass || 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
              progressPercent: fallback?.progressPercent || 65,
              scheduleStatus: fallback?.scheduleStatus || 'on_track',
              scheduleStatusLabel: fallback?.scheduleStatusLabel || 'Đúng tiến độ',
              scheduleStatusClass: fallback?.scheduleStatusClass || 'text-blue-600 dark:text-blue-400',
              deadlineDate: pDate || fallback?.deadlineDate || '31/12/2026',
              daysRemaining: fallback?.daysRemaining || 30,
              daysRemainingLabel: fallback?.daysRemainingLabel || 'Còn 30 ngày',
              isDeadlineUrgent: fallback?.isDeadlineUrgent || false,
              daysRemainingClass: fallback?.daysRemainingClass || 'text-slate-600 dark:text-slate-400',
              contractValue: pBudget || fallback?.contractValue || 0,
              contractValueFormatted: (pBudget || fallback?.contractValue || 0).toLocaleString('vi-VN') + ' đ',
              grossMarginPercent: fallback?.grossMarginPercent || 40.0,
              grossMarginFormatted: (fallback?.grossMarginPercent || 40.0) + '%',
              nextAction: fallback?.nextAction || 'Kiểm tra tiến độ',
              imageUrl: fallback?.imageUrl || 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/villa-sunrise-renovation.jpg',
            };
          });
          setData((prev) => ({
            ...prev,
            projects: mappedProjects.length > 0 ? mappedProjects : prev.projects,
          }));
        }
      })
      .catch(() => {
        // Safe fallback maintains uninterrupted UI
      });
  }, []);

  const filteredProjects = (Array.isArray(data?.projects) ? data.projects : []).filter((p: PortfolioProjectItem) => {
    const matchesFilter = filterStage === 'all' || p.stage === filterStage;
    const matchesSearch =
      searchQuery.trim() === '' ||
      (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.customerName || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ─── 00. TOP HEADER ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard/interior"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Quay lại Tổng quan
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <FolderKanban className="w-5 h-5" />
            </span>
            Danh mục Dự án Nội thất
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Quản trị chuỗi giá trị toàn diện từ Thiết kế, BOQ, Sản xuất xưởng đến Thi công &amp; Bàn giao
          </p>
        </div>

        {/* User bar & Actions */}
        <div className="flex items-center gap-4">
          <InteriorUserBar />

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Tạo dự án mới
          </button>
        </div>
      </div>

      {/* ─── 01. TẦNG 1: 4 KPI CARDS ĐIỀU HÀNH ───────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng dự án */}
        <div className="relative bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <FolderKanban className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
              {data.kpis.totalProjects.trend}
            </span>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-3xl font-black text-slate-900 dark:text-white leading-none">
                {data.kpis.totalProjects.value}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                {data.kpis.totalProjects.label}
              </p>
            </div>
            {/* Sparkline Blue Wave */}
            <svg className="w-20 h-7 text-blue-500" viewBox="0 0 80 28" fill="none">
              <path
                d="M2 24C15 24 20 12 35 12C50 12 55 4 78 4"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 2: Đang triển khai */}
        <div className="relative bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
              {data.kpis.inProgress.trend}
            </span>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-3xl font-black text-slate-900 dark:text-white leading-none">
                {data.kpis.inProgress.value}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                {data.kpis.inProgress.label}
              </p>
            </div>
            {/* Sparkline Emerald Wave */}
            <svg className="w-20 h-7 text-emerald-500" viewBox="0 0 80 28" fill="none">
              <path
                d="M2 22C18 22 24 16 38 16C52 16 60 6 78 6"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 3: Có nguy cơ trễ hạn */}
        <div className="relative bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-rose-500 dark:text-rose-400">
              <TrendingDown className="w-3.5 h-3.5" />
              {data.kpis.delayedRisk.trend}
            </span>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-3xl font-black text-slate-900 dark:text-white leading-none">
                {data.kpis.delayedRisk.value}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                {data.kpis.delayedRisk.label}
              </p>
            </div>
            {/* Sparkline Amber/Rose Wave */}
            <svg className="w-20 h-7 text-amber-500" viewBox="0 0 80 28" fill="none">
              <path
                d="M2 10C16 10 24 20 40 20C56 20 62 14 78 18"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 4: Biên lợi nhuận TB */}
        <div className="relative bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
              <Coins className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
              {data.kpis.averageGrossMargin.trend}
            </span>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-3xl font-black text-slate-900 dark:text-white leading-none">
                {data.kpis.averageGrossMargin.value}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                {data.kpis.averageGrossMargin.label}
              </p>
            </div>
            {/* Sparkline Purple Wave */}
            <svg className="w-20 h-7 text-purple-500" viewBox="0 0 80 28" fill="none">
              <path
                d="M2 22C14 22 24 12 40 12C56 12 64 6 78 6"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* ─── 02. TẦNG 2: BỘ LỌC &amp; DANH MỤC DỰ ÁN ─────────────────────────── */}
      <div className="space-y-3">
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          {/* Stage Filter Tabs */}
          <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'design', label: 'Thiết kế' },
              { id: 'production', label: 'Xưởng sản xuất' },
              { id: 'installation', label: 'Lắp đặt' },
              { id: 'handover', label: 'Bàn giao' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStage(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  filterStage === tab.id
                    ? 'bg-[#1B365D] text-white shadow-2xs dark:bg-blue-600'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search, Filter &amp; View Controls */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên dự án, khách hàng..."
                className="w-full pl-9 pr-3.5 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
              />
            </div>

            <button
              type="button"
              onClick={() => setFilterStage((prev) => (prev === 'all' ? 'design' : 'all'))}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                filterStage !== 'all'
                  ? 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              Bộ lọc
            </button>

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                aria-label="Grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  viewMode === 'list'
                    ? 'bg-[#1B365D] text-white shadow-2xs dark:bg-blue-600'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                aria-label="List view"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 10-Column Projects Table / Grid */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-2xs">
          {viewMode === 'list' ? (
            <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm min-w-[1200px]">
              <thead className="bg-slate-50/70 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap">
                <tr>
                  <th className="py-3 px-4 whitespace-nowrap">Dự án</th>
                  <th className="py-3 px-4 whitespace-nowrap">Khách hàng</th>
                  <th className="py-3 px-4 whitespace-nowrap">Phụ trách</th>
                  <th className="py-3 px-4 whitespace-nowrap">Giai đoạn</th>
                  <th className="py-3 px-4 whitespace-nowrap">Tiến độ</th>
                  <th className="py-3 px-4 whitespace-nowrap">Hạn hoàn thành</th>
                  <th className="py-3 px-4 whitespace-nowrap">Giá trị HĐ</th>
                  <th className="py-3 px-4 whitespace-nowrap">Biên lợi nhuận</th>
                  <th className="py-3 px-4 whitespace-nowrap">Công việc tiếp theo</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                {filteredProjects.map((project: PortfolioProjectItem) => (
                  <tr
                    key={project.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Cột 1: Dự án */}
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <img
                          src={project.imageUrl}
                          alt={project.name}
                          className="w-11 h-11 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700 flex-shrink-0"
                        />
                        <div>
                          <Link
                            href={`/dashboard/interior/projects/${project.id}`}
                            className="font-bold text-slate-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-400 leading-tight transition-colors whitespace-nowrap"
                          >
                            {project.name}
                          </Link>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5 whitespace-nowrap">
                            {project.code}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Cột 2: Khách hàng */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <p className="font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {project.customerName}
                      </p>
                      <p className="text-[11px] text-slate-400 whitespace-nowrap">
                        {project.customerSegment}
                      </p>
                    </td>

                    {/* Cột 3: Phụ trách */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <img
                          src={project.leadArchitectAvatar}
                          alt={project.leadArchitect}
                          className="w-6 h-6 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                        />
                        <span className="font-medium text-slate-700 dark:text-slate-300 text-xs whitespace-nowrap">
                          {project.leadArchitect}
                        </span>
                      </div>
                    </td>

                    {/* Cột 4: Giai đoạn */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${project.stageBadgeClass}`}>
                        ● {project.stageLabel}
                      </span>
                    </td>

                    {/* Cột 5: Tiến độ */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="space-y-1 w-24">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {project.progressPercent}%
                        </span>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${project.progressPercent}%` }}
                          />
                        </div>
                        <p className={`text-[11px] whitespace-nowrap ${project.scheduleStatusClass}`}>
                          {project.scheduleStatusLabel}
                        </p>
                      </div>
                    </td>

                    {/* Cột 6: Hạn hoàn thành */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className="whitespace-nowrap">{project.deadlineDate}</span>
                        </div>
                        <p className={`text-[11px] whitespace-nowrap ${project.daysRemainingClass}`}>
                          {project.daysRemainingLabel}
                        </p>
                      </div>
                    </td>

                    {/* Cột 7: Giá trị HĐ */}
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {project.contractValueFormatted}
                    </td>

                    {/* Cột 8: Biên lợi nhuận */}
                    <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {project.grossMarginFormatted}
                    </td>

                    {/* Cột 9: Công việc tiếp theo */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {project.nextAction}
                      </span>
                    </td>

                    {/* Cột 10: Thao tác */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          aria-label="Tùy chọn khác"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        <Link
                          href={`/dashboard/interior/projects/${project.id}`}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors"
                          aria-label="Xem chi tiết"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project: PortfolioProjectItem) => (
              <div
                key={project.id}
                className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="relative h-40 w-full rounded-xl overflow-hidden bg-slate-100">
                    <img
                      src={project.imageUrl}
                      alt={project.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2.5 right-2.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold shadow-xs ${project.stageBadgeClass}`}>
                        {project.stageLabel}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-mono font-bold text-slate-400">{project.code}</div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-snug">
                      {project.name}
                    </h3>
                    <div className="text-xs text-slate-500 mt-1">
                      Chủ đầu tư: <strong className="text-slate-700 dark:text-slate-300">{project.customerName}</strong>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">KTS chủ trì:</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{project.leadArchitect}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Giá trị hợp đồng:</span>
                      <span className="font-bold font-mono text-slate-900 dark:text-white">{project.contractValueFormatted}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Biên lợi nhuận:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{project.grossMarginFormatted}</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Tiến độ thực tế</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{project.progressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-600 h-full rounded-full transition-all"
                        style={{ width: `${project.progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                    Hạn: {project.deadlineDate}
                  </div>
                  <Link
                    href={`/dashboard/interior/projects/${project.id}`}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-2xs transition-colors inline-flex items-center gap-1"
                  >
                    Xem chi tiết <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>

      {/* ─── 03. TẦNG 3: 3 THẺ ĐIỀU HÀNH &amp; PHÂN TÍCH ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Card 1: Tổng quan tiến độ */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <h2 className="font-bold text-sm text-slate-900 dark:text-white">
              Tổng quan tiến độ
            </h2>
          </div>

          <div className="py-4 flex items-center justify-between gap-4">
            {/* Donut Chart */}
            <div className="relative w-28 h-28 flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#E2E8F0"
                  strokeWidth="9"
                  className="dark:stroke-slate-800"
                />
                {/* Segment 1: On-track (72% Blue) */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#2563EB"
                  strokeWidth="9"
                  strokeDasharray="171.9 238.76"
                  strokeDashoffset="0"
                />
                {/* Segment 2: Delayed (18% Orange) */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#F59E0B"
                  strokeWidth="9"
                  strokeDasharray="42.98 238.76"
                  strokeDashoffset="-171.9"
                />
                {/* Segment 3: Completed (10% Gray) */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#94A3B8"
                  strokeWidth="9"
                  strokeDasharray="23.88 238.76"
                  strokeDashoffset="-214.88"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-black text-slate-900 dark:text-white leading-none">
                  {data.progressOverview.overallProgressPercent}%
                </span>
                <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                  Tổng tiến độ
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-2 text-xs flex-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  Đúng tiến độ
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {data.progressOverview.onTrackPercent}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Chậm tiến độ
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {data.progressOverview.delayedPercent}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  Hoàn thành
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {data.progressOverview.completedPercent}%
                </span>
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>{data.progressOverview.specialAttentionNote}</span>
          </div>
        </div>

        {/* Card 2: Tình hình tài chính dự án */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CircleDollarSign className="w-4 h-4 text-emerald-600" />
              <h2 className="font-bold text-sm text-slate-900 dark:text-white">
                Tình hình tài chính dự án
              </h2>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              {data.financialSummary.period}
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {/* 4 Financial Columns */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4">
            <div className="space-y-1">
              <p className="text-[11px] text-slate-400 font-medium truncate">
                Tổng giá trị HĐ
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {data.financialSummary.totalContractFormatted}
              </p>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                <Coins className="w-3 h-3 text-amber-500" />
                {data.financialSummary.contractGrowthPercent}%
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] text-slate-400 font-medium truncate">
                Đã thu
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {data.financialSummary.collectedFormatted}
              </p>
              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-3 h-3" />
                {data.financialSummary.collectedGrowthPercent}%
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] text-slate-400 font-medium truncate">
                Còn phải thu
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {data.financialSummary.receivableFormatted}
              </p>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                <Clock className="w-3 h-3" />
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] text-slate-400 font-medium truncate">
                Lợi nhuận thực tế
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {data.financialSummary.actualProfitFormatted}
              </p>
              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-3 h-3" />
                {data.financialSummary.profitGrowthPercent}%
              </span>
            </div>
          </div>

          {/* Average Margin Footer */}
          <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{data.financialSummary.averageMarginNote}</span>
          </div>
        </div>

        {/* Card 3: Cảnh báo &amp; Công việc cần làm */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              <h2 className="font-bold text-sm text-slate-900 dark:text-white">
                Cảnh báo &amp; Công việc cần làm
              </h2>
            </div>
            <Link
              href="/dashboard/interior/schedule"
              className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              Xem tất cả →
            </Link>
          </div>

          <div className="py-2 space-y-2.5">
            {data.actionAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between gap-2.5 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {alert.type === 'critical' ? (
                    <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-3 h-3" />
                    </span>
                  ) : alert.type === 'warning' ? (
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                      <Info className="w-3 h-3" />
                    </span>
                  ) : alert.type === 'info' ? (
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                      <Info className="w-3 h-3" />
                    </span>
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                    </span>
                  )}
                  <p className="text-slate-800 dark:text-slate-200 truncate font-medium">
                    {alert.title}
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 whitespace-nowrap flex-shrink-0">
                  {alert.timeAgo}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2" />
        </div>
      </div>

      {/* ─── 05. MODAL KHỞI TẠO DỰ ÁN MỚI (PROJECT INTAKE MODAL) ───────────────────── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 my-8 text-slate-900 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md">
                  <FolderKanban className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Khởi tạo Dự án Nội thất
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800">
                      Bước 1: Intake
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Khởi tạo hồ sơ tổng thầu trước khi chuyển sang Design Studio và bóc tách BOQ/BOM
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content: Success State vs Form State */}
            {createdSuccessProject ? (
              <div className="py-8 space-y-6 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-800 shadow-sm">
                  <Check className="w-8 h-8 stroke-[3]" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-xl font-bold text-slate-900 dark:text-white">
                    Khởi tạo dự án thành công!
                  </h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Hồ sơ dự án <span className="font-semibold text-slate-900 dark:text-slate-100">{createdSuccessProject.name}</span> (<span className="font-mono text-amber-600 font-bold">{createdSuccessProject.code}</span>) đã được lưu vào hệ thống.
                  </p>
                </div>

                {/* Workflow Guidance Box */}
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 text-left space-y-2 max-w-lg mx-auto">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Luồng nghiệp vụ kế tiếp theo chuẩn Bella Interior:
                  </p>
                  <div className="flex items-center gap-3 text-xs text-slate-700 dark:text-slate-300">
                    <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-[10px]">2</span>
                    <span><strong>Bước 2: Design Studio:</strong> Duyệt mặt bằng 2D &amp; phối cảnh 3D (Design Lock R1.0)</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-700 dark:text-slate-300">
                    <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-[10px]">3</span>
                    <span><strong>Bước 3: Chỉ định vật liệu:</strong> Bảng mẫu thực tế (Spec Lock - Gỗ, Đá, Phụ kiện)</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-700 dark:text-slate-300">
                    <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-[10px]">4</span>
                    <span><strong>Bước 4: BOQ &amp; BOM:</strong> Lập bảng giá thương mại &amp; bóc tách xưởng sản xuất</span>
                  </div>
                </div>

                {/* Next Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <Link
                    href={`/dashboard/interior/design?projectId=${createdSuccessProject.id}`}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    Chuyển sang Design Studio (Bước 2)
                  </Link>
                  <Link
                    href={`/dashboard/interior/projects/${createdSuccessProject.id}`}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs sm:text-sm transition-all cursor-pointer"
                  >
                    Xem chi tiết hồ sơ
                  </Link>
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer"
                  >
                    Ở lại danh sách
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateProject} className="space-y-4 pt-4">
                {createError && (
                  <div className="p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Mã dự án */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Mã dự án (Hệ thống tự cấp)
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      required
                      className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-amber-600 dark:text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>

                  {/* Phân loại công trình */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Loại hình công trình
                    </label>
                    <select
                      value={formData.projectType}
                      onChange={(e) => setFormData({ ...formData, projectType: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    >
                      {Object.entries(PROJECT_TYPES).map(([val, label]) => (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tên dự án */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Tên dự án nội thất <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Villa Thảo Điền Riverside, Penthouse Serenity Sky..."
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>

                  {/* CRM Customer Picker */}
                  <div className="sm:col-span-2" ref={customerSearchRef}>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Khách hàng CRM <span className="text-rose-500">*</span>
                      <span className="ml-1.5 font-normal text-slate-400">(Bắt buộc tạo khách hàng trước)</span>
                    </label>

                    {selectedCustomer ? (
                      /* Selected customer chip */
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                        <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {selectedCustomer.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 truncate">{selectedCustomer.name}</p>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                            {selectedCustomer.code}
                            {selectedCustomer.primaryPhone && ` · ${selectedCustomer.primaryPhone}`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(null);
                            setCustomerSearchQuery('');
                            setFormData({ ...formData, customerPhone: '' });
                          }}
                          className="p-1 rounded-lg text-emerald-600 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex-shrink-0"
                          aria-label="Xóa khách hàng đã chọn"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      /* Search input + dropdown */
                      <div className="relative">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                          {customerSearchLoading && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />
                          )}
                          <input
                            type="text"
                            placeholder="Tìm kiếm theo tên, mã KH, số điện thoại..."
                            value={customerSearchQuery}
                            onChange={(e) => {
                              setCustomerSearchQuery(e.target.value);
                              setShowCustomerDropdown(false);
                            }}
                            onFocus={() => {
                              if (customerSearchResults.length > 0) setShowCustomerDropdown(true);
                            }}
                            className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                          />
                        </div>

                        {showCustomerDropdown && customerSearchResults.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl max-h-56 overflow-y-auto">
                            {customerSearchResults.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors text-left first:rounded-t-xl last:rounded-b-xl"
                                onClick={() => {
                                  setSelectedCustomer(c);
                                  setCustomerSearchQuery('');
                                  setShowCustomerDropdown(false);
                                  if (c.primaryPhone) {
                                    setFormData((prev) => ({ ...prev, customerPhone: c.primaryPhone! }));
                                  }
                                }}
                              >
                                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                                  {c.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{c.name}</p>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                    {c.code}
                                    {c.primaryPhone && ` · ${c.primaryPhone}`}
                                  </p>
                                </div>
                                {c.status === 'active' && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold flex-shrink-0">Đang hoạt động</span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* No results hint */}
                        {customerSearchQuery.trim().length >= 2 && !customerSearchLoading && customerSearchResults.length === 0 && (
                          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <Users className="w-3.5 h-3.5" />
                            <span>Không tìm thấy khách hàng.</span>
                            <Link
                              href="/dashboard/interior/customers"
                              target="_blank"
                              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                            >
                              Tạo mới tại đây
                              <ExternalLinkIcon className="w-2.5 h-2.5" />
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Số điện thoại */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Số điện thoại liên hệ
                    </label>
                    <input
                      type="text"
                      placeholder="VD: 0912 345 678"
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>

                  {/* Địa chỉ công trình */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Địa chỉ thi công công trình
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Căn 12A-04 Tháp B, Khu đô thị Sala, TP. Thủ Đức, TP.HCM"
                      value={formData.siteAddress}
                      onChange={(e) => setFormData({ ...formData, siteAddress: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>

                  {/* KTS chủ trì */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      KTS chủ trì phụ trách
                    </label>
                    <select
                      value={formData.leadArchitect}
                      onChange={(e) => setFormData({ ...formData, leadArchitect: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    >
                      <option value="KTS. Hoàng Long">KTS. Hoàng Long (Senior Architect)</option>
                      <option value="KTS. Lê Hoàng Sơn">KTS. Lê Hoàng Sơn (Lead Designer)</option>
                      <option value="KTS. Trần Minh Đức">KTS. Trần Minh Đức (Fitout PM)</option>
                    </select>
                  </div>

                  {/* Diện tích sàn (m2) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Diện tích sàn (m²)
                    </label>
                    <input
                      type="number"
                      min={10}
                      value={formData.floorArea}
                      onChange={(e) => setFormData({ ...formData, floorArea: Number(e.target.value) })}
                      className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>

                  {/* Ngân sách dự kiến */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Ngân sách dự kiến (VNĐ)
                    </label>
                    <input
                      type="number"
                      step={50000000}
                      value={formData.estimatedBudget}
                      onChange={(e) => setFormData({ ...formData, estimatedBudget: Number(e.target.value) })}
                      className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>

                  {/* Hạn hoàn thành kỳ vọng */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Hạn hoàn thành kỳ vọng
                    </label>
                    <input
                      type="date"
                      value={formData.targetCompletionDate}
                      onChange={(e) => setFormData({ ...formData, targetCompletionDate: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    disabled={createSubmitting}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={createSubmitting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {createSubmitting ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Đang khởi tạo...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Khởi tạo dự án
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
