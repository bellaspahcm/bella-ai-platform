"use client";
import { downloadLandCsv, LandPreviewNotice, unavailableLandAction, LandPagination, useLandPagination, inDateRange } from "@/modules/real_estate/components/LandUiControls";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, CheckCircle2, Clock, XCircle, AlertTriangle,
  ChevronRight, Plus, Download, Search, Filter,
  CheckCheck, BadgeCheck, TrendingUp, Building2, User,
  Calendar, Wallet, ShieldAlert, MoreVertical, X,
  FileCheck, ExternalLink, RefreshCw, Send, DollarSign
} from "lucide-react";
import { toast } from "sonner";
import { downloadPdfReport } from "@/modules/real_estate/utils/exportUtils";
import Link from "next/link";
import { PremiumSelect } from "@/components/ui/PremiumSelect";

export interface ContractItem {
  id: string;
  contractNo: string;
  contractType: 'HĐMB' | 'HĐĐC' | 'HĐCG';
  contractTypeLabel: string;
  signedDate: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAvatar: string;
  projectName: string;
  projectImg: string;
  unitCode: string;
  unitSpec: string; // e.g. '2PN · 76.2m²'
  totalValueVnd: number;
  totalValueText: string;
  paidValueVnd: number;
  remainingValueVnd: number;
  paidText: string;
  remainingText: string;
  paidPct: number;
  nextMilestoneAmount: string;
  nextMilestoneDate: string;
  nextMilestoneDueText: string;
  nextMilestoneStatus: 'breached' | 'warning' | 'normal' | 'none';
  status: 'active' | 'deposited' | 'completed' | 'warning' | 'overdue' | 'waiting_signature' | 'terminated';
  statusLabel: string;
  statusColor: string;
  // Detail Drawer Attributes
  effectiveDate: string;
  estimatedHandover: string;
  paymentMilestones: {
    name: string;
    amount: string;
    dueDate: string;
    status: 'paid' | 'due_soon' | 'pending' | 'overdue';
    statusLabel: string;
  }[];
}

type ContractDomainTab = 'overview' | 'deposit' | 'contract' | 'payment' | 'debt';

const CONTRACT_DATA: ContractItem[] = [
  {
    id: 'ct-001',
    contractNo: 'HĐMB-2026-0184',
    contractType: 'HĐMB',
    contractTypeLabel: 'Hợp đồng mua bán căn hộ',
    signedDate: '01/09/2026',
    customerName: 'Lê Văn Chánh',
    customerPhone: '0901 234 567',
    customerEmail: 'le.chanh@gmail.com',
    customerAvatar: 'L',
    projectName: 'Elyse Island',
    projectImg: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=120&q=80',
    unitCode: 'A1-1804',
    unitSpec: '2PN · 76.2m²',
    totalValueVnd: 4280000000,
    totalValueText: '4.28 tỷ',
    paidValueVnd: 1284000000,
    remainingValueVnd: 2996000000,
    paidText: '1.28 tỷ',
    remainingText: '3.00 tỷ',
    paidPct: 30,
    nextMilestoneAmount: '428 triệu',
    nextMilestoneDate: '18/09/2026',
    nextMilestoneDueText: 'Còn 8 ngày',
    nextMilestoneStatus: 'warning',
    status: 'active',
    statusLabel: 'Đang hiệu lực',
    statusColor: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    effectiveDate: '01/09/2026',
    estimatedHandover: 'Q4/2027',
    paymentMilestones: [
      { name: 'Đặt cọc', amount: '200.000.000 ₫', dueDate: '01/09/2026', status: 'paid', statusLabel: 'Đã thu' },
      { name: 'Đợt 1', amount: '1.084.000.000 ₫', dueDate: '05/09/2026', status: 'paid', statusLabel: 'Đã thu' },
      { name: 'Đợt 2', amount: '428.000.000 ₫', dueDate: '18/09/2026', status: 'due_soon', statusLabel: 'Còn 8 ngày' },
      { name: 'Đợt 3', amount: '856.000.000 ₫', dueDate: '18/11/2026', status: 'pending', statusLabel: 'Chưa đến hạn' },
      { name: 'Đợt 4', amount: '1.712.000.000 ₫', dueDate: '18/02/2027', status: 'pending', statusLabel: 'Chưa đến hạn' },
    ]
  },
  {
    id: 'ct-002',
    contractNo: 'HĐMB-2026-0183',
    contractType: 'HĐMB',
    contractTypeLabel: 'Hợp đồng mua bán căn hộ',
    signedDate: '28/08/2026',
    customerName: 'Phạm Thị Diễm',
    customerPhone: '0912 345 678',
    customerEmail: 'phamthidiem@hotmail.com',
    customerAvatar: 'P',
    projectName: 'Elyse Island',
    projectImg: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=120&q=80',
    unitCode: 'A1-2108',
    unitSpec: '3PN · 98.5m²',
    totalValueVnd: 5650000000,
    totalValueText: '5.65 tỷ',
    paidValueVnd: 2000000000,
    remainingValueVnd: 3650000000,
    paidText: '2.00 tỷ',
    remainingText: '3.65 tỷ',
    paidPct: 35,
    nextMilestoneAmount: '1.20 tỷ',
    nextMilestoneDate: '28/10/2026',
    nextMilestoneDueText: 'Còn 50 ngày',
    nextMilestoneStatus: 'normal',
    status: 'active',
    statusLabel: 'Đang hiệu lực',
    statusColor: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    effectiveDate: '28/08/2026',
    estimatedHandover: 'Q4/2027',
    paymentMilestones: [
      { name: 'Đặt cọc', amount: '300.000.000 ₫', dueDate: '28/08/2026', status: 'paid', statusLabel: 'Đã thu' },
      { name: 'Đợt 1', amount: '1.700.000.000 ₫', dueDate: '15/09/2026', status: 'paid', statusLabel: 'Đã thu' },
      { name: 'Đợt 2', amount: '1.200.000.000 ₫', dueDate: '28/10/2026', status: 'pending', statusLabel: 'Còn 50 ngày' }
    ]
  },
  {
    id: 'ct-003',
    contractNo: 'HĐĐC-2026-0112',
    contractType: 'HĐĐC',
    contractTypeLabel: 'Hợp đồng đặt cọc giữ chỗ',
    signedDate: '15/08/2026',
    customerName: 'Hoàng Minh Đức',
    customerPhone: '0933 111 222',
    customerEmail: 'hmduc@company.vn',
    customerAvatar: 'H',
    projectName: 'Sunrise Residence',
    projectImg: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=120&q=80',
    unitCode: 'S2-1205',
    unitSpec: '2PN · 75.4m²',
    totalValueVnd: 200000000,
    totalValueText: '200 triệu',
    paidValueVnd: 200000000,
    remainingValueVnd: 0,
    paidText: '200 triệu',
    remainingText: '0',
    paidPct: 100,
    nextMilestoneAmount: 'Ký HĐMB',
    nextMilestoneDate: '30/09/2026',
    nextMilestoneDueText: 'Còn 20 ngày',
    nextMilestoneStatus: 'normal',
    status: 'deposited',
    statusLabel: 'Đã đặt cọc',
    statusColor: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    effectiveDate: '15/08/2026',
    estimatedHandover: 'Q2/2028',
    paymentMilestones: [
      { name: 'Giữ chỗ', amount: '50.000.000 ₫', dueDate: '15/08/2026', status: 'paid', statusLabel: 'Đã thu' },
      { name: 'Bổ sung cọc', amount: '150.000.000 ₫', dueDate: '20/08/2026', status: 'paid', statusLabel: 'Đã thu' }
    ]
  },
  {
    id: 'ct-004',
    contractNo: 'HĐMB-2026-0178',
    contractType: 'HĐMB',
    contractTypeLabel: 'Hợp đồng mua bán căn hộ',
    signedDate: '10/07/2026',
    customerName: 'Ngô Thị Hạnh',
    customerPhone: '0967 123 456',
    customerEmail: 'hanh.nt@gmail.com',
    customerAvatar: 'N',
    projectName: 'Lumière Bay',
    projectImg: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=120&q=80',
    unitCode: 'L1-2402',
    unitSpec: '1PN · 52.1m²',
    totalValueVnd: 3120000000,
    totalValueText: '3.12 tỷ',
    paidValueVnd: 3120000000,
    remainingValueVnd: 0,
    paidText: '3.12 tỷ',
    remainingText: '0',
    paidPct: 100,
    nextMilestoneAmount: '-',
    nextMilestoneDate: '-',
    nextMilestoneDueText: 'Hoàn tất thanh toán',
    nextMilestoneStatus: 'none',
    status: 'completed',
    statusLabel: 'Hoàn tất',
    statusColor: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    effectiveDate: '10/07/2026',
    estimatedHandover: 'Đã bàn giao Q3/2026',
    paymentMilestones: [
      { name: 'Tất toán 100%', amount: '3.120.000.000 ₫', dueDate: '10/07/2026', status: 'paid', statusLabel: 'Đã thu' }
    ]
  },
  {
    id: 'ct-005',
    contractNo: 'HĐMB-2026-0175',
    contractType: 'HĐMB',
    contractTypeLabel: 'Hợp đồng mua bán căn hộ',
    signedDate: '05/07/2026',
    customerName: 'Đỗ Minh Tuấn',
    customerPhone: '0909 988 776',
    customerEmail: 'tuan.dm@gmail.com',
    customerAvatar: 'Đ',
    projectName: 'Bella Premium',
    projectImg: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=120&q=80',
    unitCode: 'B1-1606',
    unitSpec: '2PN · 68.5m²',
    totalValueVnd: 4900000000,
    totalValueText: '4.90 tỷ',
    paidValueVnd: 1500000000,
    remainingValueVnd: 3400000000,
    paidText: '1.50 tỷ',
    remainingText: '3.40 tỷ',
    paidPct: 31,
    nextMilestoneAmount: '850 triệu',
    nextMilestoneDate: '05/10/2026',
    nextMilestoneDueText: 'Còn 17 ngày',
    nextMilestoneStatus: 'warning',
    status: 'warning',
    statusLabel: 'Sắp đến hạn',
    statusColor: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    effectiveDate: '05/07/2026',
    estimatedHandover: 'Q1/2027',
    paymentMilestones: [
      { name: 'Đặt cọc', amount: '200.000.000 ₫', dueDate: '05/07/2026', status: 'paid', statusLabel: 'Đã thu' },
      { name: 'Đợt 1', amount: '1.300.000.000 ₫', dueDate: '15/07/2026', status: 'paid', statusLabel: 'Đã thu' },
      { name: 'Đợt 2', amount: '850.000.000 ₫', dueDate: '05/10/2026', status: 'due_soon', statusLabel: 'Còn 17 ngày' }
    ]
  },
  {
    id: 'ct-006',
    contractNo: 'HĐMB-2026-0168',
    contractType: 'HĐMB',
    contractTypeLabel: 'Hợp đồng mua bán căn hộ',
    signedDate: '20/06/2026',
    customerName: 'Bùi Thị Mai',
    customerPhone: '0933 666 888',
    customerEmail: 'mai.bt@gmail.com',
    customerAvatar: 'B',
    projectName: 'Elyse Island',
    projectImg: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=120&q=80',
    unitCode: 'A2-0901',
    unitSpec: '2PN · 76.0m²',
    totalValueVnd: 4350000000,
    totalValueText: '4.35 tỷ',
    paidValueVnd: 0,
    remainingValueVnd: 4350000000,
    paidText: '0',
    remainingText: '4.35 tỷ',
    paidPct: 0,
    nextMilestoneAmount: '435 triệu',
    nextMilestoneDate: '20/09/2026',
    nextMilestoneDueText: '🔴 Còn 10 ngày',
    nextMilestoneStatus: 'breached',
    status: 'overdue',
    statusLabel: 'Quá hạn',
    statusColor: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
    effectiveDate: '20/06/2026',
    estimatedHandover: 'Q4/2027',
    paymentMilestones: [
      { name: 'Đợt 1 quá hạn', amount: '435.000.000 ₫', dueDate: '20/09/2026', status: 'overdue', statusLabel: '🔴 Quá hạn' }
    ]
  },
  {
    id: 'ct-007',
    contractNo: 'HĐMB-2026-0159',
    contractType: 'HĐMB',
    contractTypeLabel: 'Hợp đồng mua bán căn hộ',
    signedDate: '12/06/2026',
    customerName: 'Trần Nam',
    customerPhone: '0987 654 321',
    customerEmail: 'nam.tran@gmail.com',
    customerAvatar: 'T',
    projectName: 'Sunrise Residence',
    projectImg: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=120&q=80',
    unitCode: 'S1-2003',
    unitSpec: '3PN · 102.3m²',
    totalValueVnd: 6800000000,
    totalValueText: '6.80 tỷ',
    paidValueVnd: 4080000000,
    remainingValueVnd: 2720000000,
    paidText: '4.08 tỷ',
    remainingText: '2.72 tỷ',
    paidPct: 60,
    nextMilestoneAmount: '680 triệu',
    nextMilestoneDate: '12/11/2026',
    nextMilestoneDueText: 'Còn 58 ngày',
    nextMilestoneStatus: 'normal',
    status: 'active',
    statusLabel: 'Đang hiệu lực',
    statusColor: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    effectiveDate: '12/06/2026',
    estimatedHandover: 'Q2/2028',
    paymentMilestones: [
      { name: 'Đặt cọc & Đợt 1', amount: '4.080.000.000 ₫', dueDate: '12/06/2026', status: 'paid', statusLabel: 'Đã thu' },
      { name: 'Đợt 2', amount: '680.000.000 ₫', dueDate: '12/11/2026', status: 'pending', statusLabel: 'Còn 58 ngày' }
    ]
  },
  {
    id: 'ct-008',
    contractNo: 'HĐĐC-2026-0098',
    contractType: 'HĐĐC',
    contractTypeLabel: 'Hợp đồng đặt cọc giữ chỗ',
    signedDate: '01/06/2026',
    customerName: 'Phan Thuận',
    customerPhone: '0918 222 333',
    customerEmail: 'thuan.pt@gmail.com',
    customerAvatar: 'P',
    projectName: 'Elyse Island',
    projectImg: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=120&q=80',
    unitCode: 'A1-1705',
    unitSpec: '2PN · 76.2m²',
    totalValueVnd: 300000000,
    totalValueText: '300 triệu',
    paidValueVnd: 300000000,
    remainingValueVnd: 0,
    paidText: '300 triệu',
    remainingText: '0',
    paidPct: 100,
    nextMilestoneAmount: 'Ký HĐMB',
    nextMilestoneDate: '30/09/2026',
    nextMilestoneDueText: 'Còn 20 ngày',
    nextMilestoneStatus: 'normal',
    status: 'waiting_signature',
    statusLabel: 'Chờ ký',
    statusColor: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    effectiveDate: '01/06/2026',
    estimatedHandover: 'Q4/2027',
    paymentMilestones: [
      { name: 'Đặt cọc 100%', amount: '300.000.000 ₫', dueDate: '01/06/2026', status: 'paid', statusLabel: 'Đã thu' }
    ]
  }
];

export default function RealEstateContractsPage() {
  const [contracts, setContracts] = useState<ContractItem[]>(CONTRACT_DATA);
  const [selectedContractId, setSelectedContractId] = useState<string | null>('ct-001');
  const [domainTab, setDomainTab] = useState<ContractDomainTab>('overview');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  // Dropdown filters
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [headerProject, setHeaderProject] = useState<string>('elyse');
  const [filterDate, setFilterDate] = useState<string>('all');
  const [pageSize, setPageSize] = useState<string>('8');
  const [modalContractType, setModalContractType] = useState<string>('HĐMB');
  const [modalProject, setModalProject] = useState<string>('Elyse Island');
  const [paymentMethod, setPaymentMethod] = useState<string>('transfer');



  // Financial Operational KPIs (Exact matching Reference Image 1)
  const stats = useMemo(() => {
    return {
      activeCount: 128,
      totalCount: 186,
      totalValueText: '486.2 tỷ',
      avgValueText: 'TB: 3.8 tỷ/HĐ',
      paidTotalText: '312.8 tỷ',
      paidPctText: '64.4%',
      remainingTotalText: '173.4 tỷ',
      remainingPctText: '35.6%',
      overdueCount: 12,
      overdueAmountText: '18.6 tỷ',
      dueSoonCount: 26,
      dueSoonAmountText: '42.2 tỷ',
      needActionCount: 18,
      waitingSignatureCount: 8,
      missingDocCount: 4
    };
  }, []);

  // Filtered Contracts
  const filteredContracts = useMemo(() => {
    return contracts.filter(c => {
      // Domain Tab
      if (domainTab === 'deposit' && c.contractType !== 'HĐĐC') return false;
      if (domainTab === 'contract' && c.contractType !== 'HĐMB') return false;

      // Urgency Filter
      if (urgencyFilter === 'overdue' && c.status !== 'overdue') return false;
      if (urgencyFilter === 'due_soon' && c.status !== 'warning') return false;
      if (urgencyFilter === 'waiting_signature' && c.status !== 'waiting_signature') return false;

      // Dropdowns
      if (filterType !== 'all' && c.contractType !== filterType) return false;
      if (!inDateRange(c.signedDate, filterDate)) return false;
      if (domainTab === 'debt' && c.remainingValueVnd <= 0) return false;
      if (domainTab === 'payment' && c.paidValueVnd <= 0) return false;
      if (urgencyFilter === 'need_action' && !['overdue', 'warning', 'waiting_signature'].includes(c.status)) return false;
      if (filterProject !== 'all' && c.projectName !== filterProject) return false;
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;

      // Search
      if (search) {
        const q = search.toLowerCase();
        const mNo = c.contractNo.toLowerCase().includes(q);
        const mCust = c.customerName.toLowerCase().includes(q);
        const mUnit = c.unitCode.toLowerCase().includes(q);
        if (!mNo && !mCust && !mUnit) return false;
      }
      return true;
    });
  }, [contracts, domainTab, urgencyFilter, filterProject, filterStatus, filterType, filterDate, search]);
  const pagination = useLandPagination(filteredContracts, Number(pageSize));
  const selectedContract = pagination.rows.find(c => c.id === selectedContractId) || null;

  const handleRecordPayment = () => { unavailableLandAction("Ghi nhận thanh toán"); };

  const domainTabs: Array<{ id: ContractDomainTab; label: string }> = [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'deposit', label: 'Đặt cọc' },
    { id: 'contract', label: 'Hợp đồng' },
    { id: 'payment', label: 'Thanh toán' },
    { id: 'debt', label: 'Công nợ' },
  ];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto font-sans text-slate-900 dark:text-slate-100 pb-12">
      <LandPreviewNotice />
      {/* ── 1. Header Bar & Controls (Matching Image 1) ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-1">
            <span>Bella Land</span>
            <span>/</span>
            <span>Kinh doanh</span>
            <span>/</span>
            <span className="text-slate-700 dark:text-slate-200 font-bold">Hợp đồng & Thanh toán</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            Hợp đồng & Thanh toán
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Quản lý đặt cọc, HĐMB, tiến độ thanh toán và công nợ khách hàng
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <PremiumSelect
            value={filterProject}
            onChange={setFilterProject}
            className="w-44"
            options={[{ value: "all", label: "Tất cả dự án" },
              { value: "Elyse Island", label: "🏢 Elyse Island" },
              { value: "Sunrise Residence", label: "Sunrise Residence" },
              { value: "Lumière Bay", label: "Lumière Bay" },
            ]}
          />

          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              placeholder="Tìm số HĐ, khách hàng, mã căn..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-12 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none shadow-xs"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">Ctrl K</span>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-black shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" /> Lập hợp đồng mới ▾
          </button>
        </div>
      </div>

      {/* ── 2. Top 6 Financial Operational KPI Cards (Matching Image 1) ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Card 1: Hợp đồng active */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-emerald-600 uppercase tracking-wider text-[10px]">↑ 12%</span>
            <FileText className="w-4 h-4 text-emerald-500 opacity-60" />
          </div>
          <div className="mt-2">
            <span className="text-2xl lg:text-3xl font-black text-emerald-600">{stats.activeCount}</span>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">Hợp đồng active</p>
            <p className="text-[10px] text-slate-400 font-medium">Tổng: {stats.totalCount}</p>
          </div>
        </div>

        {/* Card 2: Tổng giá trị HĐ */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-amber-600 uppercase tracking-wider text-[10px]">↑ 8%</span>
            <FileCheck className="w-4 h-4 text-amber-500 opacity-60" />
          </div>
          <div className="mt-2">
            <span className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white">{stats.totalValueText}</span>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">Tổng giá trị HĐ</p>
            <p className="text-[10px] text-slate-400 font-medium">{stats.avgValueText}</p>
          </div>
        </div>

        {/* Card 3: Đã thu */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-emerald-600 uppercase tracking-wider text-[10px]">↑ 15%</span>
            <Wallet className="w-4 h-4 text-emerald-500 opacity-60" />
          </div>
          <div className="mt-2">
            <span className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white">{stats.paidTotalText}</span>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">Đã thu</p>
            <p className="text-[10px] text-emerald-600 font-extrabold">{stats.paidPctText}</p>
          </div>
        </div>

        {/* Card 4: Còn phải thu */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-rose-500 uppercase tracking-wider text-[10px]">↓ 5%</span>
            <Clock className="w-4 h-4 text-blue-500 opacity-60" />
          </div>
          <div className="mt-2">
            <span className="text-2xl lg:text-3xl font-black text-blue-600">{stats.remainingTotalText}</span>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">Còn phải thu</p>
            <p className="text-[10px] text-slate-400 font-medium">{stats.remainingPctText}</p>
          </div>
        </div>

        {/* Card 5: Kỳ thanh toán quá hạn */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-rose-600 uppercase tracking-wider text-[10px]">↑ 33%</span>
            <AlertTriangle className="w-4 h-4 text-rose-500 opacity-60" />
          </div>
          <div className="mt-2">
            <span className="text-2xl lg:text-3xl font-black text-rose-600">{stats.overdueCount}</span>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">Kỳ thanh toán quá hạn</p>
            <p className="text-[10px] text-rose-600 font-extrabold">{stats.overdueAmountText}</p>
          </div>
        </div>

        {/* Card 6: Sắp đến hạn */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-emerald-600 uppercase tracking-wider text-[10px]">↑ 8%</span>
            <Calendar className="w-4 h-4 text-blue-500 opacity-60" />
          </div>
          <div className="mt-2">
            <span className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white">{stats.dueSoonCount}</span>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">Sắp đến hạn (7 ngày)</p>
            <p className="text-[10px] text-slate-400 font-medium">{stats.dueSoonAmountText}</p>
          </div>
        </div>
      </div>

      {/* ── 3. Domain Views & Action Queue Filter Toolbar (Matching Image 1) ── */}
      <div className="space-y-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
        {/* Domain View Tabs */}
        <div className="flex items-center gap-6 border-b border-slate-100 dark:border-slate-800 pb-2 text-xs font-bold">
          {domainTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setDomainTab(tab.id)}
              className={`pb-1 transition-all cursor-pointer ${
                domainTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 font-black'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Action Queue Urgency Filters (Row 2 Pills) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: `Tất cả (${stats.totalCount})` },
            { id: 'need_action', label: `🔴 Cần xử lý (${stats.needActionCount})` },
            { id: 'overdue', label: `🔴 Quá hạn (${stats.overdueCount})` },
            { id: 'due_soon', label: `⚠️ Sắp đến hạn (${stats.dueSoonCount})` },
            { id: 'waiting_signature', label: `👤 Chờ ký (${stats.waitingSignatureCount})` },
            { id: 'missing_docs', label: `📁 Thiếu hồ sơ (${stats.missingDocCount})` },
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => filter.id === "missing_docs" ? unavailableLandAction("Lọc hồ sơ hợp đồng chưa được đối chiếu") : setUrgencyFilter(filter.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                urgencyFilter === filter.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Secondary Dropdown Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
            <PremiumSelect
              value={filterProject}
              onChange={setFilterProject}
              placeholder="Dự án: Tất cả"
              className="w-44"
              options={[
                { value: "all", label: "Dự án: Tất cả" },
                { value: "Elyse Island", label: "Elyse Island" },
                { value: "Sunrise Residence", label: "Sunrise Residence" },
                { value: "Lumière Bay", label: "Lumière Bay" },
                { value: "Bella Premium", label: "Bella Premium" },
              ]}
            />

            <PremiumSelect
              value={filterStatus}
              onChange={setFilterStatus}
              placeholder="Trạng thái: Tất cả"
              className="w-44"
              options={[
                { value: "all", label: "Trạng thái: Tất cả" },
                { value: "active", label: "Đang hiệu lực" },
                { value: "deposited", label: "Đã đặt cọc" },
                { value: "completed", label: "Hoàn tất" },
                { value: "warning", label: "Sắp đến hạn" },
                { value: "overdue", label: "Quá hạn" },
              ]}
            />

            <PremiumSelect
              value={filterType}
              onChange={setFilterType}
              placeholder="Loại: Tất cả"
              className="w-36"
              options={[
                { value: "all", label: "Loại: Tất cả" },
                { value: "HĐMB", label: "HĐMB" },
                { value: "HĐĐC", label: "HĐĐC" },
              ]}
            />

            <PremiumSelect
              value={filterDate}
              onChange={setFilterDate}
              placeholder="Ngày ký: Tất cả"
              className="w-40"
              options={[
                { value: "all", label: "Ngày ký: Tất cả" },
                { value: "today", label: "Hôm nay" },
                { value: "this_month", label: "Tháng này" },
              ]}
            />

            <button aria-label="Xóa bộ lọc" onClick={() => (setSearch(""), setFilterProject("all"), setFilterStatus("all"), setFilterType("all"), setFilterDate("all"), setDomainTab("overview"), setUrgencyFilter("all"))} className="p-1.5 rounded-xl text-slate-500 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100">
              <Filter className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => downloadLandCsv("bella-land-hop-dong-minh-hoa.csv", filteredContracts.map(row => ({ "Mã": row.contractNo, "Dự án": row.projectName, "Trạng thái": row.status })))} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100">
              <Download className="w-3.5 h-3.5" /> Xuất
            </button>
          </div>
        </div>
      </div>

      {/* ── 4. Main Body: Contract Table & Contract 360 Workspace Drawer (Matching Image 1) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left Column (Contract Work Queue Table) */}
        <div className={`${selectedContract ? 'lg:col-span-8' : 'lg:col-span-12'} bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs transition-all`}>
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
            <table className="w-full text-left text-xs border-collapse min-w-[1050px]">
              <thead className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="p-3.5 w-10 text-center whitespace-nowrap">
                    <span>Chọn</span>
                  </th>
                  <th className="p-3.5 whitespace-nowrap">SỐ HỢP ĐỒNG</th>
                  <th className="p-3.5 whitespace-nowrap">KHÁCH HÀNG</th>
                  <th className="p-3.5 whitespace-nowrap">DỰ ÁN / CĂN</th>
                  <th className="p-3.5 whitespace-nowrap">GIÁ TRỊ HĐ</th>
                  <th className="p-3.5 whitespace-nowrap">ĐÃ THU / CÒN LẠI</th>
                  <th className="p-3.5 whitespace-nowrap">KỲ TIẾP THEO</th>
                  <th className="p-3.5 whitespace-nowrap">TRẠNG THÁI</th>
                  <th className="p-3.5 text-right whitespace-nowrap">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredContracts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400 font-semibold whitespace-nowrap">
                      Không tìm thấy hợp đồng nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  pagination.rows.map(contract => {
                    const isSelected = selectedContractId === contract.id;

                    return (
                      <tr
                        key={contract.id}
                        onClick={() => setSelectedContractId(contract.id)}
                        className={`transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/70 dark:bg-blue-950/40 font-semibold'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <td className="p-3.5 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <input
                            type="radio" name="contracts-selection" aria-label="Chọn hàng"
                            checked={isSelected}
                            onChange={() => setSelectedContractId(contract.id)}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                        </td>

                        {/* Contract No & Date */}
                        <td className="p-3.5 whitespace-nowrap">
                          <p className="font-extrabold text-blue-900 dark:text-blue-300 text-xs whitespace-nowrap">{contract.contractNo}</p>
                          <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap mt-0.5">{contract.signedDate}</p>
                        </td>

                        {/* Customer Info */}
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 font-black flex items-center justify-center text-xs shrink-0">
                              {contract.customerAvatar}
                            </div>
                            <div className="whitespace-nowrap">
                              <p className="font-extrabold text-slate-900 dark:text-white text-xs whitespace-nowrap">{contract.customerName}</p>
                              <p className="text-[10px] text-slate-500 font-medium whitespace-nowrap">{contract.customerPhone}</p>
                            </div>
                          </div>
                        </td>

                        {/* Project & Unit Spec */}
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <img src={contract.projectImg} alt={contract.projectName} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                            <div className="whitespace-nowrap">
                              <p className="font-extrabold text-slate-900 dark:text-white text-xs whitespace-nowrap">{contract.projectName}</p>
                              <p className="text-[10px] text-slate-500 font-semibold whitespace-nowrap">{contract.unitCode} · {contract.unitSpec}</p>
                            </div>
                          </div>
                        </td>

                        {/* Contract Total Value */}
                        <td className="p-3.5 whitespace-nowrap">
                          <span className="font-extrabold text-slate-900 dark:text-white text-xs whitespace-nowrap">
                            {contract.totalValueText}
                          </span>
                        </td>

                        {/* Paid vs Remaining with Progress Bar */}
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="space-y-1 w-32 whitespace-nowrap">
                            <div className="flex justify-between text-[11px] font-bold">
                              <span className="text-slate-900 dark:text-white">{contract.paidText}</span>
                              <span className="text-slate-400 font-medium">/ {contract.remainingText}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${contract.paidPct}%` }} />
                              </div>
                              <span className="text-[10px] font-bold text-slate-500">{contract.paidPct}%</span>
                            </div>
                          </div>
                        </td>

                        {/* Next Milestone Schedule */}
                        <td className="p-3.5 whitespace-nowrap">
                          <p className="font-bold text-slate-900 dark:text-white text-xs whitespace-nowrap">{contract.nextMilestoneAmount}</p>
                          <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 whitespace-nowrap mt-0.5">
                            <span>{contract.nextMilestoneDate}</span>
                            {contract.nextMilestoneStatus === 'breached' && (
                              <span className="text-rose-600 font-extrabold">🔴 {contract.nextMilestoneDueText}</span>
                            )}
                            {contract.nextMilestoneStatus === 'warning' && (
                              <span className="text-amber-600 font-extrabold">Còn 17 ngày</span>
                            )}
                            {contract.nextMilestoneStatus === 'normal' && (
                              <span className="text-slate-500 font-semibold">{contract.nextMilestoneDueText}</span>
                            )}
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="p-3.5 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border inline-block whitespace-nowrap ${contract.statusColor}`}>
                            ● {contract.statusLabel}
                          </span>
                        </td>

                        {/* Action Dots */}
                        <td className="p-3.5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedContractId(contract.id)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            ⋮
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="border-t border-slate-200 dark:border-slate-800"><LandPagination {...pagination} /><PremiumSelect value={pageSize} onChange={setPageSize} className="m-3 w-32" options={[{value:'5',label:'5 / trang'},{value:'8',label:'8 / trang'},{value:'10',label:'10 / trang'},{value:'20',label:'20 / trang'},{value:'50',label:'50 / trang'}]} /></div>
        </div>

        {/* Right Column: Contract & Collection Detail Drawer (Matching Image 1 Right Panel) */}
        {selectedContract && (
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-md space-y-5 sticky top-6">
            {/* Drawer Header */}
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    {selectedContract.contractNo}
                  </h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${selectedContract.statusColor}`}>
                    ● {selectedContract.statusLabel}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-bold tracking-wider uppercase mt-0.5">
                  {selectedContract.contractTypeLabel}
                </p>
              </div>

              <button
                onClick={() => setSelectedContractId(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Contract Document Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => unavailableLandAction("Thao tác lưu hoặc gửi dữ liệu")}
                className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-blue-700 dark:text-blue-300 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
              >
                <FileText className="w-3.5 h-3.5" /> Xem hợp đồng
              </button>
              <button
                onClick={() => {
                  unavailableLandAction("Xuất tài liệu nghiệp vụ");
                  unavailableLandAction("Thao tác lưu hoặc gửi dữ liệu");
                }}
                className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
              >
                <Download className="w-3.5 h-3.5" /> Tải hồ sơ
              </button>
              <button onClick={() => unavailableLandAction("Thao tác này")} className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl text-slate-500">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>

            {/* Thông tin chung */}
            <div className="space-y-2 text-xs">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">THÔNG TIN CHUNG</h4>
              <div className="flex gap-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="space-y-1.5 flex-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Dự án</span>
                    <span className="font-extrabold text-slate-900 dark:text-white">{selectedContract.projectName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mã căn</span>
                    <span className="font-extrabold text-blue-600 dark:text-blue-400">{selectedContract.unitCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Loại căn</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedContract.unitSpec.split('·')[0]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Diện tích</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedContract.unitSpec.split('·')[1] || '76.2 m²'}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200/50">
                    <span className="text-slate-500 font-medium">Giá trị hợp đồng</span>
                    <span className="font-black text-slate-900 dark:text-white">{selectedContract.totalValueVnd.toLocaleString('vi-VN')} ₫</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ngày ký</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedContract.signedDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ngày hiệu lực</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedContract.effectiveDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ngày bàn giao (dự kiến)</span>
                    <span className="font-bold text-emerald-600">{selectedContract.estimatedHandover}</span>
                  </div>
                </div>

                <img src={selectedContract.projectImg} alt={selectedContract.projectName} className="w-20 h-28 rounded-xl object-cover shrink-0 shadow-2xs" />
              </div>
            </div>

            {/* Khách hàng */}
            <div className="space-y-2 text-xs">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">KHÁCH HÀNG</h4>
              <Link
                href="/dashboard/real-estate/customers"
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 hover:bg-slate-100 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-black flex items-center justify-center text-xs">
                    {selectedContract.customerAvatar}
                  </div>
                  <div>
                    <p className="font-extrabold text-slate-900 dark:text-white text-xs">{selectedCustomerName(selectedContract)}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{selectedContract.customerPhone} · {selectedContract.customerEmail}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            {/* Tiến độ thanh toán */}
            <div className="space-y-2 text-xs">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">TIẾN ĐỘ THANH TOÁN</h4>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Đã thu</span>
                  <span className="font-black text-slate-900 dark:text-white">{selectedContract.paidValueVnd.toLocaleString('vi-VN')} ₫ <span className="text-emerald-600 font-extrabold text-[11px]">({selectedContract.paidPct}%)</span></span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Còn phải thu</span>
                  <span className="font-black text-blue-600 dark:text-blue-400">{selectedContract.remainingValueVnd.toLocaleString('vi-VN')} ₫ <span className="text-slate-400 font-bold text-[11px]">({100 - selectedContract.paidPct}%)</span></span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${selectedContract.paidPct}%` }} />
                </div>
              </div>
            </div>

            {/* Lịch thanh toán */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">LỊCH THANH TOÁN</h4>
                <button onClick={() => unavailableLandAction("Thao tác này")} className="text-[10px] font-bold text-blue-600 hover:underline">Xem tất cả</button>
              </div>

              <div className="space-y-2">
                {selectedContract.paymentMilestones.map((m, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px]">
                    <div className="flex items-center gap-2">
                      {m.status === 'paid' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                      {m.status === 'due_soon' && <Clock className="w-4 h-4 text-amber-500 animate-pulse" />}
                      {m.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600" />}
                      {m.status === 'overdue' && <AlertTriangle className="w-4 h-4 text-rose-500" />}
                      <div>
                        <span className="font-extrabold text-slate-900 dark:text-white block">{m.name}</span>
                        <span className="font-bold text-slate-500">{m.amount}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-slate-400 font-medium block">{m.dueDate}</span>
                      {m.status === 'paid' && <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-black">Đã thu</span>}
                      {m.status === 'due_soon' && <span className="text-rose-600 font-black text-[10px]">Còn 8 ngày</span>}
                      {m.status === 'pending' && <span className="text-slate-400 text-[9px]">Chưa đến hạn</span>}
                      {m.status === 'overdue' && <span className="text-rose-600 font-black text-[10px]">Quá hạn</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Action Controls */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowPaymentModal(true)}
                className="w-full py-2.5 bg-blue-900 hover:bg-blue-950 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <DollarSign className="w-4 h-4 text-emerald-400" /> Ghi nhận thanh toán
              </button>

              <button
                onClick={() => unavailableLandAction("Thao tác lưu hoặc gửi dữ liệu")}
                className="w-full py-2 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
              >
                Tạo phiếu thu
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => unavailableLandAction("Thao tác lưu hoặc gửi dữ liệu")}
                  className="py-1.5 text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Chuyển nhượng
                </button>
                <button
                  onClick={() => unavailableLandAction("Thanh lý / hủy hợp đồng")}
                  className="py-1.5 text-rose-600 font-bold text-xs hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl"
                >
                  Hủy hợp đồng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 5. Modal: Lập Hợp Đồng Mới ── */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="max-h-[90vh] overflow-y-auto relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-500" /> Lập Hợp Đồng Mới
                </h3>
                <button onClick={() => setShowAddModal(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>

              <form onSubmit={e => { e.preventDefault(); unavailableLandAction("Thao tác lưu hoặc gửi dữ liệu"); setShowAddModal(false); }} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Loại hợp đồng</label>
                    <PremiumSelect
                      value={modalContractType}
                      onChange={setModalContractType}
                      options={[
                        { value: "HĐMB", label: "HĐMB - Hợp đồng mua bán" },
                        { value: "HĐĐC", label: "HĐĐC - Hợp đồng đặt cọc" },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Dự án</label>
                    <PremiumSelect
                      value={modalProject}
                      onChange={setModalProject}
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
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Khách hàng đứng tên *</label>
                    <input required placeholder="Lê Văn Chánh" className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none" />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Mã căn hộ *</label>
                    <input required placeholder="A1-1804" className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none font-bold" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Giá trị hợp đồng (VNĐ)</label>
                    <input required placeholder="4.280.000.000" className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none font-bold" />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Ngày ký hợp đồng</label>
                    <input type="date" defaultValue="2026-09-10" className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none font-bold" />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 font-bold bg-slate-100 text-slate-600 rounded-xl">Hủy</button>
                  <button type="submit" className="px-5 py-2 font-bold bg-amber-500 hover:bg-amber-600 text-black rounded-xl">Khởi tạo bản thảo</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 6. Modal: Ghi Nhận Thanh Toán ── */}
      <AnimatePresence>
        {showPaymentModal && selectedContract && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPaymentModal(false)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="max-h-[90vh] overflow-y-auto relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-500" /> Ghi Nhận Thanh Toán Tiến Độ
                </h3>
                <button onClick={() => setShowPaymentModal(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <p className="font-extrabold text-slate-900 dark:text-white">{selectedContract.contractNo} - {selectedContract.customerName}</p>
                  <p className="text-slate-500 mt-0.5">Mã căn: <strong className="text-blue-600">{selectedContract.unitCode}</strong></p>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Đợt thanh toán</label>
                  <input disabled value="Đợt 2 - 428.000.000 ₫ (Hạn 18/09/2026)" className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold" />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Hình thức thanh toán</label>
                  <PremiumSelect
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    options={[
                      { value: "transfer", label: "Chuyển khoản ngân hàng (Vietcombank)" },
                      { value: "card", label: "Thẻ ngân hàng / POS" },
                      { value: "cash", label: "Tiền mặt" },
                    ]}
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Mã giao dịch / Ghi chú</label>
                  <input placeholder="VD: VCB-20260910-889912" className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none" />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button type="button" onClick={() => setShowPaymentModal(false)} className="px-4 py-2 font-bold bg-slate-100 text-slate-600 rounded-xl">Hủy</button>
                  <button onClick={handleRecordPayment} className="px-5 py-2 font-bold bg-blue-900 text-white rounded-xl">Xác nhận thu tiền</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function selectedCustomerName(contract: ContractItem) {
  return contract.customerName;
}
