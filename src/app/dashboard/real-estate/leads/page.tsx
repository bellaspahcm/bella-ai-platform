'use client';
import { downloadLandCsv, LandPreviewNotice, unavailableLandAction } from "@/modules/real_estate/components/LandUiControls";

/**
 * @module app/dashboard/real-estate/leads/page
 *
 * Bella Land - Lead & SLA Operations Subsystem
 * Re-designed to 100% match Image 2 (Master-Detail Work Queue & SLA Operations).
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Phone, Mail, Clock, Search, Filter, ShieldAlert,
  ChevronDown, CheckCircle2, PhoneCall, Eye, X, Plus,
  SlidersHorizontal, Download, ArrowUpRight, MessageSquare,
  Globe, Calendar, MapPin, Check, UserPlus, Settings, RotateCcw,
  MoreVertical, FileText, ChevronRight, CheckSquare, Square,
  Building, User, AlertCircle, ArrowRightLeft, Send, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { Database } from '@/types/database.types';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

// ── Types & Interfaces ────────────────────────────────────────────────────────

export interface LeadItem {
  id: string;
  leadCode: string;
  fullName: string;
  phone: string;
  email: string;
  city: string;
  project: string;
  subZone: string;
  productType: string;
  budget: string;
  source: 'facebook' | 'zalo' | 'google' | 'referral' | 'website' | 'tiktok' | 'email' | 'event';
  sourceLabel: string;
  salesOwnerId: string | null;
  salesOwnerName: string | null;
  saleAcknowledged: boolean;
  nextAction: string;
  slaStatus: 'breached' | 'warning' | 'normal' | 'completed';
  slaTimeText: string;
  slaMinutesRemaining?: number;
  status: 'waiting' | 'in_progress' | 'converted' | 'new' | 'unassigned' | 'overdue' | 'potential';
  statusLabel: string;
  statusColor: string;
  notes?: string;
  createdAt: string;
  createdTime: string;
  buyerDemand?: string;
  timeline: {
    time: string;
    title: string;
    description: string;
    type: 'system' | 'sla' | 'call' | 'note' | 'status';
  }[];
}

type LeadSource = LeadItem['source'];

interface NewLeadForm {
  fullName: string;
  phone: string;
  email: string;
  project: string;
  subZone: string;
  productType: string;
  budget: string;
  source: LeadSource;
  buyerDemand: string;
}

const LEAD_SOURCES = ['facebook', 'zalo', 'google', 'referral', 'website', 'tiktok', 'email', 'event'] as const satisfies readonly LeadSource[];

function isLeadSource(value: string): value is LeadSource {
  return (LEAD_SOURCES as readonly string[]).includes(value);
}

// ── Seed Data (Matching Image 2 Exactly) ───────────────────────────────────────

const INITIAL_LEADS: LeadItem[] = [
  {
    id: 'l-001',
    leadCode: 'L-20260910-001',
    fullName: 'Nguyễn Văn Minh',
    phone: '0901234567',
    email: 'minh.nv@gmail.com',
    city: 'Hà Nội',
    project: 'Elyse Island',
    subZone: 'Shophouse Marina',
    productType: 'Shophouse',
    budget: '5 – 8 tỷ',
    source: 'facebook',
    sourceLabel: 'Facebook Ads',
    salesOwnerId: 's-001',
    salesOwnerName: 'Nguyễn Văn A',
    saleAcknowledged: false,
    nextAction: 'Nhận lead',
    slaStatus: 'breached',
    slaTimeText: 'Quá hạn 29 phút',
    slaMinutesRemaining: -29,
    status: 'waiting',
    statusLabel: 'Chờ nhận',
    statusColor: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    notes: 'Khách hàng quan tâm căn Shophouse mặt sông, muốn vị trí gần bến du thuyền.',
    buyerDemand: 'Đầu tư cho thuê, quan tâm vị trí gần biển',
    createdAt: '10/09/2026',
    createdTime: '09:15',
    timeline: [
      { time: '09:15', title: 'Lead tạo từ Facebook Ads', description: 'Chiến dịch Shophouse Marina Q3', type: 'system' },
      { time: '09:15', title: 'Auto assign → Nguyễn Văn A', description: 'Phân bổ tự động theo quy tắc dự án Elyse Island', type: 'system' },
      { time: '09:30', title: 'SLA breached (Quá hạn nhận)', description: 'Chưa xác nhận sau 15 phút quy định', type: 'sla' },
    ]
  },
  {
    id: 'l-002',
    leadCode: 'L-20260910-002',
    fullName: 'Trần Thị Lan',
    phone: '0912345678',
    email: 'lan.tt@outlook.com',
    city: 'TP.HCM',
    project: 'Elyse Island',
    subZone: 'Shophouse Marina',
    productType: 'Căn hộ 2PN',
    budget: '3 – 5 tỷ',
    source: 'zalo',
    sourceLabel: 'Zalo OA',
    salesOwnerId: 's-002',
    salesOwnerName: 'Trần Thị B',
    saleAcknowledged: true,
    nextAction: 'Followup #1',
    slaStatus: 'warning',
    slaTimeText: 'Còn 41 phút',
    slaMinutesRemaining: 41,
    status: 'in_progress',
    statusLabel: 'Đang chăm sóc',
    statusColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    notes: 'Đã gửi brochure dự án qua Zalo. Khách hẹn trao đổi lại vào 14h.',
    buyerDemand: 'Mua để ở, cần ban công hướng Đông Nam',
    createdAt: '10/09/2026',
    createdTime: '08:30',
    timeline: [
      { time: '08:30', title: 'Lead từ Zalo OA', description: 'Khách quan tâm căn 2PN', type: 'system' },
      { time: '08:32', title: 'Trần Thị B đã nhận lead', description: 'Xác nhận chăm sóc thành công', type: 'status' },
      { time: '09:00', title: 'Đã gửi file bảng giá & vị trí', description: 'Gửi qua Zalo OA', type: 'call' }
    ]
  },
  {
    id: 'l-003',
    leadCode: 'L-20260910-003',
    fullName: 'Phạm Hùng Cường',
    phone: '0923456789',
    email: 'cuong.ph@company.vn',
    city: 'Đà Nẵng',
    project: 'Elyse Island',
    subZone: 'Shophouse Marina',
    productType: 'Căn hộ 3PN',
    budget: '8 – 12 tỷ',
    source: 'referral',
    sourceLabel: 'Người giới thiệu',
    salesOwnerId: 's-003',
    salesOwnerName: 'Lê Hoàng C',
    saleAcknowledged: true,
    nextAction: 'Chốt HĐ',
    slaStatus: 'completed',
    slaTimeText: 'Đã hoàn thành',
    status: 'converted',
    statusLabel: 'Đã chốt HĐ',
    statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    notes: 'Đã chuyển cọc 100tr căn A1-1806.',
    buyerDemand: 'Khách VIP mua đầu tư căn 3PN tầng đẹp',
    createdAt: '09/09/2026',
    createdTime: '15:20',
    timeline: [
      { time: '15:20', title: 'Lead giới thiệu từ khách cũ', description: 'Khách Hùng Cường', type: 'system' },
      { time: '16:00', title: 'Ký cọc căn A1-1806', description: 'Đã nộp phiếu cọc 100tr', type: 'status' }
    ]
  },
  {
    id: 'l-004',
    leadCode: 'L-20260910-004',
    fullName: 'Lê Thu Hà',
    phone: '0987654321',
    email: 'ha.lt@gmail.com',
    city: 'Hà Nội',
    project: 'Sunrise Residence',
    subZone: 'Căn hộ cao cấp',
    productType: 'Căn hộ 2PN',
    budget: '3 – 4 tỷ',
    source: 'google',
    sourceLabel: 'Google Ads',
    salesOwnerId: 's-001',
    salesOwnerName: 'Nguyễn Văn A',
    saleAcknowledged: true,
    nextAction: 'Liên hệ đầu tiên',
    slaStatus: 'normal',
    slaTimeText: 'Còn 2 giờ 15 phút',
    slaMinutesRemaining: 135,
    status: 'new',
    statusLabel: 'Mới',
    statusColor: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    notes: 'Khách để lại thông tin từ Form Google Search.',
    buyerDemand: 'Tìm căn hộ 2PN cho gia đình trẻ',
    createdAt: '10/09/2026',
    createdTime: '09:45',
    timeline: [
      { time: '09:45', title: 'Tạo từ Google Search Ads', description: 'Từ khóa căn hộ Sunrise', type: 'system' }
    ]
  },
  {
    id: 'l-005',
    leadCode: 'L-20260910-005',
    fullName: 'Hoàng Văn Nam',
    phone: '0978123456',
    email: 'nam.hoang@yahoo.com',
    city: 'Hải Phòng',
    project: 'Elyse Island',
    subZone: 'Shophouse Marina',
    productType: 'Shophouse',
    budget: '5 – 7 tỷ',
    source: 'website',
    sourceLabel: 'Website',
    salesOwnerId: null,
    salesOwnerName: null,
    saleAcknowledged: false,
    nextAction: 'Tự động phân phối',
    slaStatus: 'warning',
    slaTimeText: 'Còn 3 giờ',
    slaMinutesRemaining: 180,
    status: 'unassigned',
    statusLabel: 'Chưa có sales',
    statusColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    notes: 'Khách đăng ký tư vấn trực tiếp trên Website Bella Land.',
    buyerDemand: 'Cần sales am hiểu Shophouse liên hệ ngay',
    createdAt: '10/09/2026',
    createdTime: '09:00',
    timeline: [
      { time: '09:00', title: 'Tạo từ Website Form', description: 'Đang đợi thuật toán phân bổ', type: 'system' }
    ]
  },
  {
    id: 'l-006',
    leadCode: 'L-20260910-006',
    fullName: 'Ngô Thị Hạnh',
    phone: '0967123456',
    email: 'hanh.ngo@gmail.com',
    city: 'Quảng Ninh',
    project: 'Lumière Bay',
    subZone: 'Căn hộ biển',
    productType: 'Căn hộ 1PN',
    budget: '2 – 3 tỷ',
    source: 'tiktok',
    sourceLabel: 'TikTok Ads',
    salesOwnerId: 's-002',
    salesOwnerName: 'Trần Thị B',
    saleAcknowledged: true,
    nextAction: 'Followup #1',
    slaStatus: 'breached',
    slaTimeText: 'Quá hạn 1 giờ 12 phút',
    slaMinutesRemaining: -72,
    status: 'overdue',
    statusLabel: 'Quá SLA',
    statusColor: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-700',
    notes: 'Quá thời hạn gọi tư vấn lần 1.',
    buyerDemand: 'Mua căn 1PN nghỉ dưỡng',
    createdAt: '09/09/2026',
    createdTime: '17:00',
    timeline: [
      { time: '17:00', title: 'Lead từ TikTok Ads', description: 'Xem video căn mẫu Lumière Bay', type: 'system' },
      { time: '18:12', title: 'SLA Breached', description: 'Quá 24 giờ chưa hoàn thành cuộc gọi #1', type: 'sla' }
    ]
  },
  {
    id: 'l-007',
    leadCode: 'L-20260910-007',
    fullName: 'Đỗ Minh Tuấn',
    phone: '0909988776',
    email: 'tuan.dm@biethu.com',
    city: 'TP.HCM',
    project: 'Sunrise Residence',
    subZone: 'Biệt thự',
    productType: 'Biệt thự',
    budget: '15 – 20 tỷ',
    source: 'event',
    sourceLabel: 'Sự kiện',
    salesOwnerId: 's-003',
    salesOwnerName: 'Lê Hoàng C',
    saleAcknowledged: true,
    nextAction: 'Gọi tư vấn',
    slaStatus: 'normal',
    slaTimeText: 'Còn 5 giờ',
    slaMinutesRemaining: 300,
    status: 'in_progress',
    statusLabel: 'Đang chăm sóc',
    statusColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    notes: 'Gặp khách tại sự kiện mở bán GEM Center.',
    buyerDemand: 'Biệt thự đơn lập hướng sông',
    createdAt: '10/09/2026',
    createdTime: '07:30',
    timeline: [
      { time: '07:30', title: 'Checkin sự kiện Mở Bán', description: 'Lê Hoàng C hỗ trợ trực tiếp', type: 'system' }
    ]
  },
  {
    id: 'l-008',
    leadCode: 'L-20260910-008',
    fullName: 'Bùi Thị Mai',
    phone: '0933666888',
    email: 'mai.bt@gmail.com',
    city: 'Cần Thơ',
    project: 'Elyse Island',
    subZone: 'Shophouse Marina',
    productType: 'Căn hộ 2PN',
    budget: '4 – 6 tỷ',
    source: 'email',
    sourceLabel: 'Email Marketing',
    salesOwnerId: 's-001',
    salesOwnerName: 'Nguyễn Văn A',
    saleAcknowledged: true,
    nextAction: 'Followup #2',
    slaStatus: 'normal',
    slaTimeText: 'Còn 1 ngày',
    slaMinutesRemaining: 1440,
    status: 'potential',
    statusLabel: 'Tiềm năng',
    statusColor: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    notes: 'Khách quan tâm chính sách chiết khấu thanh toán sớm 95%.',
    buyerDemand: 'Hỏi tiến độ và chính sách vay ngân hàng',
    createdAt: '08/09/2026',
    createdTime: '11:00',
    timeline: [
      { time: '11:00', title: 'Tạo từ Newsletter Email', description: 'Click xem Bảng hàng Elyse Island', type: 'system' }
    ]
  }
];

const SALES_AGENTS = [
  { id: 's-001', name: 'Nguyễn Văn A', role: 'Senior Sales Specialist' },
  { id: 's-002', name: 'Trần Thị B', role: 'Real Estate Consultant' },
  { id: 's-003', name: 'Lê Hoàng C', role: 'Sales Executive' },
  { id: 's-004', name: 'Phạm Thanh D', role: 'Junior Agent' },
];

export default function LeadsManagementPage() {
  const [leads, setLeads] = useState<LeadItem[]>(INITIAL_LEADS);
  const [drawerTab, setDrawerTab] = useState("info");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>('l-001');
  const [activeTabFilter, setActiveTabFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSales, setFilterSales] = useState<string>('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showSLAConfigModal, setShowSLAConfigModal] = useState(false);

  // Reassign State
  const [reassignTargetSale, setReassignTargetSale] = useState('s-002');
  const [reassignReason, setReassignReason] = useState('Nghỉ phép');
  const [keepSLA, setKeepSLA] = useState(true);

  // New Lead Form
  const [newLead, setNewLead] = useState<NewLeadForm>({
    fullName: '',
    phone: '',
    email: '',
    project: 'Elyse Island',
    subZone: 'Shophouse Marina',
    productType: 'Shophouse',
    budget: '5 – 8 tỷ',
    source: 'facebook',
    buyerDemand: '',
  });



  // Operational KPI Numbers
  const stats = useMemo(() => {
    return {
      total: leads.length,
      overdueSLA: leads.filter(l => l.slaStatus === 'breached').length,
      warningSLA: leads.filter(l => l.slaStatus === 'warning').length,
      inProgress: leads.filter(l => l.status === 'in_progress').length,
      converted: leads.filter(l => l.status === 'converted').length,
      unassigned: leads.filter(l => !l.salesOwnerId).length,
      needAction: leads.filter(l => l.slaStatus === 'breached' || l.slaStatus === 'warning' || !l.saleAcknowledged).length,
    };
  }, [leads]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      // Tab filter
      if (activeTabFilter === 'need_action' && !(l.slaStatus === 'breached' || l.slaStatus === 'warning' || !l.saleAcknowledged)) return false;
      if (activeTabFilter === 'overdue' && l.slaStatus !== 'breached') return false;
      if (activeTabFilter === 'warning' && l.slaStatus !== 'warning') return false;
      if (activeTabFilter === 'unassigned' && l.salesOwnerId !== null) return false;
      if (activeTabFilter === 'my_leads' && l.salesOwnerId !== 's-001') return false;

      // Dropdown filters
      if (filterProject !== 'all' && l.project !== filterProject) return false;
      if (filterSource !== 'all' && l.source !== filterSource) return false;
      if (filterStatus !== 'all' && l.status !== filterStatus) return false;
      if (filterSales !== 'all' && l.salesOwnerId !== filterSales) return false;

      // Search
      if (search) {
        const q = search.toLowerCase();
        const matchName = l.fullName.toLowerCase().includes(q);
        const matchPhone = l.phone.includes(q);
        const matchCode = l.leadCode.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchCode) return false;
      }

      return true;
    });
  }, [leads, activeTabFilter, filterProject, filterSource, filterStatus, filterSales, search]);
  const selectedLead = filteredLeads.find(l => l.id === selectedLeadId) || null;

  // Actions
  const handleAcceptAndCall = (leadId: string) => { unavailableLandAction("Lưu dữ liệu nghiệp vụ"); };

  const handleConfirmReassign = () => { unavailableLandAction("Lưu dữ liệu nghiệp vụ"); };

  const handleCreateLead = (e: React.FormEvent) => { e.preventDefault(); unavailableLandAction("Lưu dữ liệu nghiệp vụ"); };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto font-sans text-slate-900 dark:text-slate-100">
      <LandPreviewNotice />
      
      {/* ── 1. Header Bar & Controls (Matching Image 2) ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
            <span>Bella Land</span>
            <span>/</span>
            <span>Kinh doanh</span>
            <span>/</span>
            <span className="text-slate-900 dark:text-white font-bold">Lead & SLA</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Lead & SLA
          </h1>
          <p className="text-xs md:text-sm text-slate-500 font-semibold mt-0.5">
            Điều phối lead và kiểm soát thời gian chăm sóc, không bỏ lỡ cơ hội
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Project Selector Dropdown */}
          <PremiumSelect
            value={filterProject}
            onChange={setFilterProject}
            placeholder="Tất cả dự án"
            className="w-44"
            options={[
              { value: "all", label: "Tất cả dự án" },
              { value: "Elyse Island", label: "Elyse Island" },
              { value: "Sunrise Residence", label: "Sunrise Residence" },
              { value: "Lumière Bay", label: "Lumière Bay" },
            ]}
          />

          {/* Quick SLA Config Button */}
          <button
            onClick={() => setShowSLAConfigModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 transition-all shadow-2xs"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" /> Cấu hình SLA ▾
          </button>

          {/* Add Lead Primary Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" /> Thêm lead
          </button>
        </div>
      </div>

      {/* ── 2. 5 Operational KPI Summary Cards (Matching Image 2) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Lead */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">Tổng lead</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold flex items-center gap-0.5">
              ↑ 12%
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{stats.total}</span>
            <div className="flex items-end gap-1 h-6">
              {[40, 60, 45, 80, 65, 90, 100].map((h, i) => (
                <div key={i} className="w-1 bg-emerald-400 rounded-xs" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>

        {/* Quá SLA (Breached) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-rose-600 uppercase tracking-wider text-[11px]">Quá SLA</span>
            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black">
              9.4%
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-3xl font-black text-rose-600">{stats.overdueSLA}</span>
            <ShieldAlert className="w-6 h-6 text-rose-500 opacity-60" />
          </div>
        </div>

        {/* Sắp quá SLA (Warning) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-amber-600 uppercase tracking-wider text-[11px]">Sắp quá SLA</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black">
              14.1%
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-3xl font-black text-amber-600">{stats.warningSLA}</span>
            <Clock className="w-6 h-6 text-amber-500 opacity-60" />
          </div>
        </div>

        {/* Đang chăm sóc */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-blue-600 uppercase tracking-wider text-[11px]">Đang chăm sóc</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black">
              67.2%
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-3xl font-black text-blue-600">{stats.inProgress}</span>
            <PhoneCall className="w-6 h-6 text-blue-500 opacity-60" />
          </div>
        </div>

        {/* Đã chuyển đổi */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-emerald-600 uppercase tracking-wider text-[11px]">Đã chuyển đổi</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black">
              18.8%
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-3xl font-black text-emerald-600">{stats.converted}</span>
            <CheckCircle2 className="w-6 h-6 text-emerald-500 opacity-60" />
          </div>
        </div>
      </div>

      {/* ── 3. Work Queue Tab Pills & Secondary Filter Toolbar (Matching Image 2) ── */}
      <div className="space-y-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
        {/* Work Queue Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: `Tất cả (${stats.total})` },
            { id: 'need_action', label: `Cần xử lý (${stats.needAction})`, badge: 'bg-rose-500 text-white font-black' },
            { id: 'overdue', label: `🔴 Quá SLA (${stats.overdueSLA})` },
            { id: 'warning', label: `⚠️ Sắp quá SLA (${stats.warningSLA})` },
            { id: 'unassigned', label: `👤 Chưa có sales (${stats.unassigned})` },
            { id: 'my_leads', label: `👤 Của tôi (28)` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTabFilter(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeTabFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}

          <button aria-label="Xóa bộ lọc" onClick={() => (setSearch(""), setFilterProject("all"), setFilterSource("all"), setFilterStatus("all"), setFilterSales("all"), setActiveTabFilter("all"))} className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 flex items-center gap-1 shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Xóa bộ lọc
          </button>
        </div>

        {/* Dropdowns & Search Row */}
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
              ]}
            />

            <PremiumSelect
              value={filterSource}
              onChange={setFilterSource}
              placeholder="Nguồn: Tất cả"
              className="w-40"
              options={[
                { value: "all", label: "Nguồn: Tất cả" },
                { value: "facebook", label: "Facebook Ads" },
                { value: "zalo", label: "Zalo OA" },
                { value: "google", label: "Google Ads" },
                { value: "referral", label: "Người giới thiệu" },
              ]}
            />

            <PremiumSelect
              value={filterStatus}
              onChange={setFilterStatus}
              placeholder="Trạng thái: Tất cả"
              className="w-44"
              options={[
                { value: "all", label: "Trạng thái: Tất cả" },
                { value: "waiting", label: "Chờ nhận" },
                { value: "in_progress", label: "Đang chăm sóc" },
                { value: "converted", label: "Đã chốt HĐ" },
                { value: "unassigned", label: "Chưa có sales" },
              ]}
            />

            <PremiumSelect
              value={filterSales}
              onChange={setFilterSales}
              placeholder="Sales: Tất cả"
              className="w-44"
              options={[
                { value: "all", label: "Sales: Tất cả" },
                ...SALES_AGENTS.map(s => ({ value: s.id, label: s.name })),
              ]}
            />

            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                placeholder="Tìm kiếm..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => downloadLandCsv("bella-land-lead-minh-hoa.csv", filteredLeads.map(row => ({ "Tên": row.fullName, "Điện thoại": row.phone, "Trạng thái": row.status })))} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100">
              <Download className="w-3.5 h-3.5" /> Xuất
            </button>
          </div>
        </div>
      </div>

      {/* ── 4. Main Body (Split Panel Work Queue & Lead Detail Drawer - Image 2 Layout) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left Column (Main Work Queue Table) */}
        <div className={`${selectedLead ? 'lg:col-span-8' : 'lg:col-span-12'} bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs transition-all`}>
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
            <table className="w-full text-left text-xs border-collapse min-w-[960px]">
              <thead className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="p-3.5 w-10 text-center whitespace-nowrap">
                    <span>Chọn</span>
                  </th>
                  <th className="p-3.5 whitespace-nowrap">Khách hàng</th>
                  <th className="p-3.5 whitespace-nowrap">Dự án / Nguồn</th>
                  <th className="p-3.5 whitespace-nowrap">Nhu cầu</th>
                  <th className="p-3.5 whitespace-nowrap">Sales phụ trách</th>
                  <th className="p-3.5 whitespace-nowrap">SLA / Việc tiếp theo</th>
                  <th className="p-3.5 whitespace-nowrap">Trạng thái</th>
                  <th className="p-3.5 text-right whitespace-nowrap">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400 font-semibold whitespace-nowrap">
                      Không tìm thấy lead nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map(lead => {
                    const isSelected = selectedLeadId === lead.id;
                    const isBreached = lead.slaStatus === 'breached';
                    const isWarning = lead.slaStatus === 'warning';

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => setSelectedLeadId(lead.id)}
                        className={`transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/60 dark:bg-blue-950/30 font-semibold'
                            : isBreached
                            ? 'bg-rose-50/30 dark:bg-rose-950/20 hover:bg-rose-50/60'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <td className="p-3.5 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <input type="radio" name="lead-selection" aria-label="Chọn lead" checked={selectedLeadId === lead.id} onChange={() => setSelectedLeadId(lead.id)} className="rounded text-blue-600 focus:ring-blue-500" />
                        </td>

                        {/* Customer Info */}
                        <td className="p-3.5 whitespace-nowrap">
                          <p className="font-extrabold text-slate-900 dark:text-white text-xs whitespace-nowrap">{lead.fullName}</p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 whitespace-nowrap">
                            <span>{lead.phone}</span>
                            <button onClick={() => unavailableLandAction("Thao tác này")} className="text-blue-600 hover:text-blue-700 p-0.5">
                              <Phone className="w-3 h-3" />
                            </button>
                            <button onClick={() => unavailableLandAction("Thao tác này")} className="text-cyan-600 hover:text-cyan-700 p-0.5">
                              <MessageSquare className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        {/* Project & Source */}
                        <td className="p-3.5 whitespace-nowrap">
                          <p className="font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">{lead.project}</p>
                          <p className="text-[10px] text-slate-400 font-semibold whitespace-nowrap">{lead.subZone}</p>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md whitespace-nowrap">
                            <Globe className="w-2.5 h-2.5 text-blue-500" /> {lead.sourceLabel}
                          </span>
                        </td>

                        {/* Demand & Budget */}
                        <td className="p-3.5 whitespace-nowrap">
                          <p className="font-extrabold text-slate-900 dark:text-white whitespace-nowrap">{lead.budget}</p>
                          <p className="text-[10px] text-slate-500 font-semibold whitespace-nowrap">{lead.productType}</p>
                        </td>

                        {/* Sales Owner */}
                        <td className="p-3.5 whitespace-nowrap">
                          {lead.salesOwnerName ? (
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-extrabold text-[10px] text-slate-700 dark:text-slate-200 shrink-0">
                                {lead.salesOwnerName.substring(0, 2)}
                              </div>
                              <div className="whitespace-nowrap">
                                <p className="font-bold text-slate-800 dark:text-slate-200 text-xs whitespace-nowrap">{lead.salesOwnerName}</p>
                                {!lead.saleAcknowledged && (
                                  <span className="text-[9px] font-bold text-rose-600 flex items-center gap-0.5 whitespace-nowrap">
                                    ● Chưa xác nhận
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-amber-600 font-bold text-xs whitespace-nowrap">
                              <User className="w-3.5 h-3.5" /> Chưa phân bổ
                            </div>
                          )}
                        </td>

                        {/* SLA / Next Action */}
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            {isBreached ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black flex items-center gap-1 border border-rose-200 whitespace-nowrap">
                                <Clock className="w-3 h-3" /> {lead.slaTimeText}
                              </span>
                            ) : isWarning ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center gap-1 border border-amber-200 whitespace-nowrap">
                                <Clock className="w-3 h-3" /> {lead.slaTimeText}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center gap-1 whitespace-nowrap">
                                <Clock className="w-3 h-3 text-slate-400" /> {lead.slaTimeText}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-semibold text-slate-500 mt-1 whitespace-nowrap">{lead.nextAction}</p>
                        </td>

                        {/* Status Badge */}
                        <td className="p-3.5 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border inline-block whitespace-nowrap ${lead.statusColor}`}>
                            {lead.statusLabel}
                          </span>
                        </td>

                        {/* Action Buttons */}
                        <td className="p-3.5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                            {lead.status === 'waiting' ? (
                              <button
                                onClick={() => handleAcceptAndCall(lead.id)}
                                className="px-3 py-1.5 bg-blue-900 hover:bg-blue-950 text-white font-extrabold text-[11px] rounded-xl transition-all shadow-2xs flex items-center gap-1 whitespace-nowrap"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Nhận lead
                              </button>
                            ) : (
                              <button
                                onClick={() => setSelectedLeadId(lead.id)}
                                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-[11px] rounded-xl transition-all flex items-center gap-1 whitespace-nowrap"
                              >
                                <Eye className="w-3 h-3 text-slate-500" /> Chăm sóc
                              </button>
                            )}
                            <button
                              onClick={() => setSelectedLeadId(lead.id)}
                              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column (Dynamic Slide-out Lead Detail & Timeline Drawer - Matching Image 2 Right Drawer) */}
        {selectedLead && (
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-md space-y-5 sticky top-6">
            {/* Drawer Header */}
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    {selectedLead.fullName}
                  </h2>
                  {selectedLead.slaStatus === 'breached' && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black border border-rose-200">
                      🔴 {selectedLead.slaTimeText}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  Lead #{selectedLead.leadCode} • Tạo lúc {selectedLead.createdTime} {selectedLead.createdAt}
                </p>

                <div className="mt-3 space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <p className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> {selectedLead.phone}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> {selectedLead.email}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> {selectedLead.city}
                  </p>
                </div>

                {/* Contact Action Bar */}
                <div className="flex items-center gap-2 mt-3.5">
                  <button
                    onClick={() => handleAcceptAndCall(selectedLead.id)}
                    className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-extrabold flex items-center gap-1 hover:bg-blue-100"
                  >
                    <PhoneCall className="w-3.5 h-3.5" /> Gọi ngay
                  </button>
                  <button onClick={() => unavailableLandAction("Thao tác này")} className="px-3 py-1.5 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 rounded-xl text-xs font-extrabold flex items-center gap-1 hover:bg-cyan-100">
                    <MessageSquare className="w-3.5 h-3.5" /> Zalo
                  </button>
                  <button onClick={() => unavailableLandAction("Thao tác này")} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200">
                    <Mail className="w-3.5 h-3.5" /> Email
                  </button>
                </div>
              </div>

              <button
                onClick={() => setSelectedLeadId(null)}
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sub-tabs Bar */}
            <div role="tablist" aria-label="Chi tiết lead" className="flex gap-4 border-b text-xs">{[['info','Thông tin'],['history','Lịch sử'],['activity','Hoạt động'],['notes','Ghi chú']].map(([id,label]) => <button key={id} role="tab" aria-selected={drawerTab === id} onClick={() => setDrawerTab(id)} className="pb-2">{label}</button>)}</div>

            {drawerTab === "info" && <>
            {/* Section 1: Nhu cầu & dự án */}
            <div className="space-y-2.5 text-xs">
              <h3 className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-[10px] text-slate-400">
                Nhu cầu & dự án
              </h3>

              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block">Dự án</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">{selectedLead.project}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block">Phân khu</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">{selectedLead.subZone}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block">Ngân sách</span>
                  <span className="font-extrabold text-blue-600">{selectedLead.budget}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block">Loại sản phẩm</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">{selectedLead.productType}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block">Nguồn</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{selectedLead.sourceLabel}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block">Nhu cầu</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300 truncate block">{selectedLead.buyerDemand || 'Mua đầu tư'}</span>
                </div>
              </div>
            </div>

            {/* Section 2: Sales phụ trách */}
            <div className="space-y-2 text-xs">
              <h3 className="font-extrabold uppercase tracking-wider text-[10px] text-slate-400">
                Sales phụ trách
              </h3>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xs">
                    {selectedLead.salesOwnerName ? selectedLead.salesOwnerName.substring(0, 2) : 'SB'}
                  </div>
                  <div>
                    <p className="font-extrabold text-slate-900 dark:text-white">
                      {selectedLead.salesOwnerName || 'Chưa phân bổ'}
                    </p>
                    <p className="text-[10px] font-bold text-rose-600">
                      {!selectedLead.saleAcknowledged ? '● Chưa xác nhận nhận lead' : '● Đã xác nhận'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowReassignModal(true)}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-bold flex items-center gap-1 hover:bg-slate-100"
                >
                  <ArrowRightLeft className="w-3 h-3 text-slate-500" /> Chuyển sales
                </button>
              </div>
            </div>

            {/* Section 3: SLA hiện tại */}
            <div className="space-y-2 text-xs">
              <h3 className="font-extrabold uppercase tracking-wider text-[10px] text-slate-400">
                SLA Hiện Tại
              </h3>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-3">
                <div className="relative pl-5 border-l-2 border-rose-500 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-rose-600">🔴 {selectedLead.slaTimeText}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">Nhận lead</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Phải nhận trước: 09:30 10/09 • Hiện tại: {selectedLead.createdTime} 10/09
                  </p>
                </div>

                <div className="relative pl-5 border-l-2 border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">Followup #1</span>
                    <span className="text-[10px] text-slate-400 font-semibold">Trong 24 giờ</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Hạn: 10:15 11/09
                  </p>
                </div>
              </div>
            </div>

            </>}
            {/* Section 4: Quick Note */}
            <div className="space-y-1.5 text-xs">
              <label className="font-extrabold uppercase tracking-wider text-[10px] text-slate-400 block">
                Ghi chú nhanh
              </label>
              <textarea
                value={selectedLead.notes || ""} readOnly
                rows={2}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none resize-none"
                placeholder="Thêm ghi chú..."
              />
            </div>

            {(drawerTab === 'history' || drawerTab === 'activity') && <section aria-label="Lịch sử lead" className="space-y-3 text-xs">{selectedLead.timeline.filter(event => drawerTab === 'history' || event.type === 'call' || event.type === 'status').map((event,index) => <article key={index}><time>{event.time}</time><h4>{event.title}</h4><p>{event.description}</p></article>)}</section>}
            {/* Section 5: Primary Footer Buttons */}
            <div className="space-y-2 pt-2">
              <button
                onClick={() => handleAcceptAndCall(selectedLead.id)}
                className="w-full py-3 bg-blue-900 hover:bg-blue-950 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <PhoneCall className="w-4 h-4 text-white" /> Nhận lead & gọi ngay
              </button>

              <button onClick={() => unavailableLandAction("Thao tác này")} className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" /> Tạo lịch hẹn
              </button>
            </div>

          </div>
        )}
      </div>

      {/* ── 5. Reassign Sales Modal (Matching User Specification) ── */}
      {showReassignModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setShowReassignModal(false)}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                Chuyển người phụ trách
              </h2>
              <button onClick={() => setShowReassignModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs font-medium">
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Từ sales hiện tại:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedLead?.salesOwnerName || 'Chưa phân bổ'}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 dark:border-slate-700">
                  <span className="text-slate-400 font-semibold">Đến sales mới:</span>
                  <PremiumSelect
                    value={reassignTargetSale}
                    onChange={setReassignTargetSale}
                    className="w-52"
                    options={SALES_AGENTS.map(s => ({ value: s.id, label: `${s.name} (${s.role})` }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">Lý do chuyển:</label>
                <PremiumSelect
                  value={reassignReason}
                  onChange={setReassignReason}
                  options={[
                    { value: "Nghỉ phép", label: "Nghỉ phép" },
                    { value: "Quá tải SLA", label: "Quá tải SLA" },
                    { value: "Yêu cầu từ khách hàng", label: "Yêu cầu từ khách hàng" },
                    { value: "Chuyên môn phân khu", label: "Chuyên môn phân khu" },
                  ]}
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="keepSlaCheck"
                  checked={keepSLA}
                  onChange={e => setKeepSLA(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="keepSlaCheck" className="text-xs text-slate-700 dark:text-slate-300 font-bold cursor-pointer">
                  Giữ nguyên mốc thời gian SLA hiện tại
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowReassignModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirmReassign}
                  className="flex-1 py-2.5 bg-blue-900 hover:bg-blue-950 text-white rounded-xl font-black shadow-xs transition-all"
                >
                  Chuyển lead
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── 6. Create New Lead Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                Thêm Lead Mới
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="p-6 space-y-4 text-xs font-medium">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">Họ tên *</label>
                  <input
                    required
                    value={newLead.fullName}
                    onChange={e => setNewLead({ ...newLead, fullName: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    placeholder="Nguyễn Văn A"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">Số điện thoại *</label>
                  <input
                    required
                    value={newLead.phone}
                    onChange={e => setNewLead({ ...newLead, phone: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    placeholder="0912345678"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">Dự án quan tâm</label>
                  <PremiumSelect
                    value={newLead.project}
                    onChange={(val) => setNewLead({ ...newLead, project: val })}
                    options={[
                      { value: "Elyse Island", label: "Elyse Island" },
                      { value: "Sunrise Residence", label: "Sunrise Residence" },
                      { value: "Lumière Bay", label: "Lumière Bay" },
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">Nguồn lead</label>
                  <PremiumSelect
                    value={newLead.source}
                    onChange={(val) => {
                      if (isLeadSource(val)) {
                        setNewLead({ ...newLead, source: val });
                      }
                    }}
                    options={[
                      { value: "facebook", label: "Facebook Ads" },
                      { value: "zalo", label: "Zalo OA" },
                      { value: "google", label: "Google Ads" },
                      { value: "referral", label: "Người giới thiệu" },
                    ]}
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">Ghi chú nhu cầu</label>
                <textarea
                  value={newLead.buyerDemand}
                  onChange={e => setNewLead({ ...newLead, buyerDemand: e.target.value })}
                  rows={3}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl resize-none"
                  placeholder="Nhu cầu: shophouse, căn góc, ngân sách 5-8 tỷ..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-900 hover:bg-blue-950 text-white rounded-xl font-black shadow-xs transition-all"
                >
                  Tạo Lead
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ── 7. SLA Config Quick Modal ── */}
      {showSLAConfigModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setShowSLAConfigModal(false)}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-blue-600" />
                Cấu hình SLA & Quy tắc phân bổ
              </h2>
              <button onClick={() => setShowSLAConfigModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs font-medium">
              <div className="space-y-2">
                <label className="block text-slate-700 dark:text-slate-300 font-extrabold">Thời gian chấp nhận lead tối đa (SLA 1):</label>
                <div className="flex items-center gap-2">
                  <input type="number" defaultValue={15} className="w-20 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-center" />
                  <span className="text-slate-500 font-semibold">phút</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-slate-700 dark:text-slate-300 font-extrabold">Thời gian hoàn thành cuộc gọi đầu tiên (SLA 2):</label>
                <div className="flex items-center gap-2">
                  <input type="number" defaultValue={24} className="w-20 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-center" />
                  <span className="text-slate-500 font-semibold">giờ</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button onClick={() => setShowSLAConfigModal(false)} className="px-4 py-2 border rounded-xl font-bold text-slate-600">
                  Hủy
                </button>
                <button onClick={() => { setShowSLAConfigModal(false); unavailableLandAction("Thao tác lưu hoặc gửi dữ liệu"); }} className="px-4 py-2 bg-blue-900 text-white rounded-xl font-black">
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
