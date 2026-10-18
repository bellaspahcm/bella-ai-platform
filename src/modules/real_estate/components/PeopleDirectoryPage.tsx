'use client';

/**
 * @module modules/real_estate/components/PeopleDirectoryPage
 *
 * Bella Land - Quản Lý Nhân Sự & Đội Ngũ (People Operations Workspace)
 * Enterprise-grade HR & Real Estate People Command System matching 100% user directives & reference design.
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, User, Building2, RefreshCw, MoreVertical, Mail, Phone,
  CheckCircle2, Clock, XCircle, LayoutGrid, List, AlertCircle, UserPlus,
  Pencil, UserX, Plus, Download, Upload, ChevronRight, ChevronDown, X,
  Briefcase, Layers, Award, TrendingUp, ShieldCheck, Key, FileText,
  SlidersHorizontal, Sparkles, DollarSign, Globe, Check, Eye, MessageSquare
} from 'lucide-react';
import { LandPreviewNotice, unavailableLandAction } from "@/modules/real_estate/components/LandUiControls";
import { toast } from 'sonner';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

// ── Interfaces & Types ────────────────────────────────────────────────────────

export type PersonCategory = 'employee' | 'broker' | 'agency' | 'partner';
export type PersonStatus = 'active' | 'on_leave' | 'inactive';
type CategoryTabId = PersonCategory | 'all';
type DrawerTab = 'overview' | 'performance' | 'access' | 'history';

const PERSON_CATEGORY_VALUES = ['employee', 'broker', 'agency', 'partner'] as const satisfies readonly PersonCategory[];
const DRAWER_TABS = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'performance', label: 'Hiệu suất' },
  { id: 'access', label: 'Quyền' },
  { id: 'history', label: 'Lịch sử' },
] satisfies ReadonlyArray<{ id: DrawerTab; label: string }>;

function isPersonCategory(value: string): value is PersonCategory {
  return PERSON_CATEGORY_VALUES.some(category => category === value);
}

export interface PeopleItem {
  id: string;
  code: string;
  fullName: string;
  avatarUrl?: string;
  category: PersonCategory;
  categoryLabel: string;
  branch: string;
  department: string;
  team: string;
  roleTitle: string;
  email: string;
  phone: string;
  managerName: string;
  assignedProjects: string[];
  leadsCount: number;
  dealsClosedCount: number;
  monthlyRevenue: number; // VNĐ
  conversionRate: number; // %
  slaScore: number; // %
  status: PersonStatus;
  statusLabel: string;
  governanceScope: string;
  accessRole: string;
  joinedDate: string;
}

// ── Seed Data (Rich 86 Personnel System Representation) ───────────────────────

const SEED_PEOPLE: PeopleItem[] = [
  {
    id: 'p-001',
    code: 'NV-2026-001',
    fullName: 'Nguyễn Văn A',
    category: 'employee',
    categoryLabel: 'Nhân viên',
    branch: 'Chi nhánh Hồ Chí Minh',
    department: 'Khối Kinh doanh',
    team: 'Sales Team 01',
    roleTitle: 'Sales Manager',
    email: 'van.a@bellaland.vn',
    phone: '0909 123 456',
    managerName: 'Trần Quốc Huy',
    assignedProjects: ['Elyse Island', 'The Grand Tower'],
    leadsCount: 28,
    dealsClosedCount: 14,
    monthlyRevenue: 42500000000,
    conversionRate: 18.7,
    slaScore: 98.2,
    status: 'active',
    statusLabel: 'Hoạt động',
    governanceScope: 'Chi nhánh HCM • Sales Dept • Elyse Island',
    accessRole: 'Sales Manager (Approve Level 2)',
    joinedDate: '15/01/2024'
  },
  {
    id: 'p-002',
    code: 'NV-2026-002',
    fullName: 'Trần Thị B',
    category: 'employee',
    categoryLabel: 'Nhân viên',
    branch: 'Chi nhánh Hồ Chí Minh',
    department: 'Khối Kinh doanh',
    team: 'Sales Team 02',
    roleTitle: 'Sales Executive',
    email: 'thi.b@bellaland.vn',
    phone: '0912 345 678',
    managerName: 'Nguyễn Văn A',
    assignedProjects: ['The Grand Tower'],
    leadsCount: 17,
    dealsClosedCount: 9,
    monthlyRevenue: 27000000000,
    conversionRate: 15.4,
    slaScore: 96.0,
    status: 'active',
    statusLabel: 'Hoạt động',
    governanceScope: 'Chi nhánh HCM • Sales Team 02',
    accessRole: 'Sales Officer (Lead View/Edit)',
    joinedDate: '10/03/2024'
  },
  {
    id: 'p-003',
    code: 'MG-2026-003',
    fullName: 'Lê Văn C',
    category: 'broker',
    categoryLabel: 'Môi giới',
    branch: 'Chi nhánh Bình Dương',
    department: 'Mạng lưới Môi giới',
    team: 'Broker Team BD',
    roleTitle: 'Senior Real Estate Broker',
    email: 'vanc.broker@gmail.com',
    phone: '0938 555 777',
    managerName: 'Lê Văn Nam',
    assignedProjects: ['Riverside Heights'],
    leadsCount: 12,
    dealsClosedCount: 6,
    monthlyRevenue: 18000000000,
    conversionRate: 12.0,
    slaScore: 94.5,
    status: 'on_leave',
    statusLabel: 'Nghỉ phép',
    governanceScope: 'Chi nhánh BD • External Broker Network',
    accessRole: 'External Agent (Lead Submit Only)',
    joinedDate: '01/05/2024'
  },
  {
    id: 'p-004',
    code: 'NV-2026-004',
    fullName: 'Phạm Thị D',
    category: 'employee',
    categoryLabel: 'Nhân viên',
    branch: 'Chi nhánh Hồ Chí Minh',
    department: 'Khối CSKH',
    team: 'CSKH Support Team',
    roleTitle: 'CSKH Team Lead',
    email: 'thid.cskh@bellaland.vn',
    phone: '0903 888 999',
    managerName: 'Lê Minh Đức',
    assignedProjects: ['Elyse Island', 'Sunrise Residence'],
    leadsCount: 45,
    dealsClosedCount: 0,
    monthlyRevenue: 0,
    conversionRate: 0,
    slaScore: 99.1,
    status: 'active',
    statusLabel: 'Hoạt động',
    governanceScope: 'Toàn hệ thống CSKH • Ticket Admin',
    accessRole: 'CSKH Supervisor (Ticket Manage)',
    joinedDate: '12/11/2023'
  },
  {
    id: 'p-005',
    code: 'AG-2026-005',
    fullName: 'Võ Văn Nam (Sàn Đất Xanh)',
    category: 'agency',
    categoryLabel: 'Đại lý F1',
    branch: 'Chi nhánh Hồ Chí Minh',
    department: 'Kênh phân phối F1',
    team: 'Đại lý Độc quyền F1',
    roleTitle: 'Giám đốc Đại lý F1',
    email: 'nam.vo@datxanh.vn',
    phone: '0908 111 222',
    managerName: 'Trần Quốc Huy',
    assignedProjects: ['Elyse Island'],
    leadsCount: 468,
    dealsClosedCount: 48,
    monthlyRevenue: 288000000000,
    conversionRate: 10.2,
    slaScore: 92.0,
    status: 'active',
    statusLabel: 'Hoạt động',
    governanceScope: 'Đại lý F1 Độc quyền • Elyse Island',
    accessRole: 'Partner Agency Lead (Bulk Upload)',
    joinedDate: '01/02/2024'
  },
  {
    id: 'p-006',
    code: 'NV-2026-006',
    fullName: 'Phạm Thị Mai',
    category: 'employee',
    categoryLabel: 'Nhân viên',
    branch: 'Chi nhánh Hồ Chí Minh',
    department: 'Khối Pháp lý',
    team: 'Legal & Contract Team',
    roleTitle: 'Chuyên viên Pháp lý Senior',
    email: 'mai.pt@bellaland.vn',
    phone: '0905 678 901',
    managerName: 'Trần Quốc Huy',
    assignedProjects: ['Tất cả dự án'],
    leadsCount: 0,
    dealsClosedCount: 38,
    monthlyRevenue: 0,
    conversionRate: 0,
    slaScore: 97.8,
    status: 'active',
    statusLabel: 'Hoạt động',
    governanceScope: 'Pháp lý toàn tập đoàn • HĐMB & Sổ hồng',
    accessRole: 'Legal Auditor (Contract Approval)',
    joinedDate: '18/08/2023'
  },
  {
    id: 'p-007',
    code: 'DT-2026-007',
    fullName: 'Nguyễn Phương Mai (Nam Long Partner)',
    category: 'partner',
    categoryLabel: 'Đối tác',
    branch: 'Chi nhánh Hồ Chí Minh',
    department: 'Đối tác Liên kết',
    team: 'Liên minh F2',
    roleTitle: 'Đại diện Đối tác F2',
    email: 'mai.np@namlong.com',
    phone: '0977 888 999',
    managerName: 'Trần Quốc Huy',
    assignedProjects: ['Elyse Island'],
    leadsCount: 165,
    dealsClosedCount: 14,
    monthlyRevenue: 70000000000,
    conversionRate: 8.5,
    slaScore: 90.0,
    status: 'active',
    statusLabel: 'Hoạt động',
    governanceScope: 'Đối tác F2 • Elyse Island',
    accessRole: 'Partner Viewer',
    joinedDate: '05/04/2024'
  },
  {
    id: 'p-008',
    code: 'NV-2026-008',
    fullName: 'Hoàng Văn Tuấn',
    category: 'employee',
    categoryLabel: 'Nhân viên',
    branch: 'Chi nhánh Đà Nẵng',
    department: 'Khối Kinh doanh',
    team: 'Sales Team DN',
    roleTitle: 'Branch Sales Lead',
    email: 'tuan.hv@bellaland.vn',
    phone: '0918 222 333',
    managerName: 'Trần Quốc Huy',
    assignedProjects: ['Lumière Bay'],
    leadsCount: 22,
    dealsClosedCount: 11,
    monthlyRevenue: 33000000000,
    conversionRate: 20.0,
    slaScore: 96.5,
    status: 'active',
    statusLabel: 'Hoạt động',
    governanceScope: 'Chi nhánh Đà Nẵng • All Projects',
    accessRole: 'Branch Manager (Đà Nẵng Scope)',
    joinedDate: '01/10/2023'
  }
];

export function PeopleDirectoryPage() {
  const [peopleList, setPeopleList] = useState<PeopleItem[]>(SEED_PEOPLE);
  const [selectedPerson, setSelectedPerson] = useState<PeopleItem | null>(null);

  // Filters
  const [activeCategoryTab, setActiveCategoryTab] = useState<CategoryTabId>('all');
  const [search, setSearch] = useState('');
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list'); // Default LIST view

  // Selection Checkboxes
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddCategoryDropdown, setShowAddCategoryDropdown] = useState(false);

  // New Person Form
  const [newPerson, setNewPerson] = useState({
    fullName: '',
    category: 'employee' as PersonCategory,
    branch: 'Chi nhánh Hồ Chí Minh',
    department: 'Khối Kinh doanh',
    roleTitle: 'Sales Executive',
    email: '',
    phone: '',
    assignedProject: 'Elyse Island'
  });

  // KPI Metrics Summary
  const stats = useMemo(() => {
    return {
      total: 86,
      active: 74,
      teams: 12,
      branches: 3,
      employees: 62,
      brokers: 14,
      agencies: 6,
      partners: 4
    };
  }, []);

  const categoryTabs = [
    { id: 'all', label: `Tất cả (${stats.total})` },
    { id: 'employee', label: `Nhân viên (${stats.employees})` },
    { id: 'broker', label: `Môi giới (${stats.brokers})` },
    { id: 'agency', label: `Đại lý F1 (${stats.agencies})` },
    { id: 'partner', label: `Đối tác F2 (${stats.partners})` },
  ] satisfies ReadonlyArray<{ id: CategoryTabId; label: string }>;

  // Filtered List
  const filteredPeople = useMemo(() => {
    return peopleList.filter(p => {
      if (activeCategoryTab !== 'all' && p.category !== activeCategoryTab) return false;
      if (filterBranch !== 'all' && p.branch !== filterBranch) return false;
      if (filterDepartment !== 'all' && p.department !== filterDepartment) return false;
      if (filterStatus !== 'all' && p.status !== filterStatus) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = p.fullName.toLowerCase().includes(q);
        const matchCode = p.code.toLowerCase().includes(q);
        const matchEmail = p.email.toLowerCase().includes(q);
        const matchPhone = p.phone.includes(q);
        if (!matchName && !matchCode && !matchEmail && !matchPhone) return false;
      }
      return true;
    });
  }, [peopleList, activeCategoryTab, filterBranch, filterDepartment, filterStatus, search]);

  // Actions
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredPeople.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleCreatePerson = (e: React.FormEvent) => { e.preventDefault(); unavailableLandAction("Tạo hồ sơ nhân sự"); };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto font-sans text-slate-900 dark:text-slate-100"><LandPreviewNotice />
      
      {/* ── 1. HEADER BAR & CONTROLS ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
            <span>Bella Land</span>
            <span>/</span>
            <span>Tổ chức</span>
            <span>/</span>
            <span className="text-slate-900 dark:text-white font-bold">Quản lý nhân sự</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Quản lý nhân sự
          </h1>
          <p className="text-xs md:text-sm text-slate-500 font-semibold mt-0.5">
            Quản lý nhân sự, môi giới và đội ngũ vận hành Bella Real Estate Group
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Import Excel Button */}
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 transition-all shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" /> Nhập từ Excel
          </button>

          {/* Primary Action Button Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowAddCategoryDropdown(!showAddCategoryDropdown)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" /> Thêm nhân sự ▾
            </button>

            {showAddCategoryDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden text-xs py-1.5 font-bold">
                <button
                  onClick={() => { setNewPerson({ ...newPerson, category: 'employee' }); setShowAddModal(true); setShowAddCategoryDropdown(false); }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-800 dark:text-slate-200"
                >
                  <User className="w-3.5 h-3.5 text-blue-600" /> Thêm nhân viên nội bộ
                </button>
                <button
                  onClick={() => { setNewPerson({ ...newPerson, category: 'broker' }); setShowAddModal(true); setShowAddCategoryDropdown(false); }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-800 dark:text-slate-200"
                >
                  <Briefcase className="w-3.5 h-3.5 text-amber-600" /> Thêm môi giới tự do
                </button>
                <button
                  onClick={() => { setNewPerson({ ...newPerson, category: 'agency' }); setShowAddModal(true); setShowAddCategoryDropdown(false); }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-800 dark:text-slate-200"
                >
                  <Building2 className="w-3.5 h-3.5 text-emerald-600" /> Thêm đại lý F1/F2
                </button>
                <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                <button
                  onClick={() => { setShowImportModal(true); setShowAddCategoryDropdown(false); }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-500"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-400" /> Nhập danh sách Excel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. 4 PEOPLE OPERATING KPI SUMMARY CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Personnel */}
        <div className="p-4.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[11px]">Tổng nhân sự</span>
            <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">{stats.total}</div>
            <p className="text-[11px] text-blue-600 font-bold mt-0.5">Toàn hệ thống Bella Land</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Active */}
        <div className="p-4.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="font-extrabold text-emerald-600 uppercase tracking-wider text-[11px]">Đang hoạt động</span>
            <div className="text-3xl font-black text-emerald-600 mt-1">{stats.active}</div>
            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Tỷ lệ active 86.0%</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Teams */}
        <div className="p-4.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="font-extrabold text-purple-600 uppercase tracking-wider text-[11px]">Đội nhóm (Teams)</span>
            <div className="text-3xl font-black text-purple-600 mt-1">{stats.teams}</div>
            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Thuộc 5 Khối phòng ban</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Branches */}
        <div className="p-4.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="font-extrabold text-amber-600 uppercase tracking-wider text-[11px]">Chi nhánh</span>
            <div className="text-3xl font-black text-amber-600 mt-1">{stats.branches}</div>
            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">HCM, BD, Đà Nẵng</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── 3. UNIFIED TOOLBAR & CATEGORY TABS BAR ── */}
      <div className="space-y-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
        
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-100 dark:border-slate-800">
          {categoryTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveCategoryTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeCategoryTab === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters & Controls Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                placeholder="Tìm tên, email, SĐT, mã NV..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
              />
            </div>

            <PremiumSelect
              value={filterBranch}
              onChange={(val) => setFilterBranch(val)}
              options={[
                { value: "all", label: "Chi nhánh: Tất cả" },
                { value: "Chi nhánh Hồ Chí Minh", label: "Chi nhánh Hồ Chí Minh" },
                { value: "Chi nhánh Bình Dương", label: "Chi nhánh Bình Dương" },
                { value: "Chi nhánh Đà Nẵng", label: "Chi nhánh Đà Nẵng" },
              ]}
            />

            <PremiumSelect
              value={filterDepartment}
              onChange={(val) => setFilterDepartment(val)}
              options={[
                { value: "all", label: "Phòng ban: Tất cả" },
                { value: "Khối Kinh doanh", label: "Khối Kinh doanh" },
                { value: "Khối Vận hành", label: "Khối Vận hành" },
                { value: "Khối CSKH", label: "Khối CSKH" },
                { value: "Khối Pháp lý", label: "Khối Pháp lý" },
              ]}
            />

            <PremiumSelect
              value={filterStatus}
              onChange={(val) => setFilterStatus(val)}
              options={[
                { value: "all", label: "Trạng thái: Tất cả" },
                { value: "active", label: "🟢 Hoạt động" },
                { value: "on_leave", label: "🟡 Nghỉ phép" },
                { value: "inactive", label: "🔴 Ngừng hoạt động" },
              ]}
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View Switcher Toggle (List Default) */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500'
                }`}
              >
                <List className="w-3.5 h-3.5" /> List
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Grid
              </button>
            </div>

            <button
              onClick={() => unavailableLandAction("Thao tác nhân sự")}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100"
            >
              <Download className="w-3.5 h-3.5" /> Xuất Excel
            </button>
          </div>
        </div>
      </div>

      {/* ── 4. MAIN PEOPLE TABLE VIEW (SPLIT WITH RIGHT DETAIL DRAWER WHEN SELECTED) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* People List / Table Column */}
        <div className={`${selectedPerson ? 'lg:col-span-8' : 'lg:col-span-12'} bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs transition-all`}>
          
          {/* EMPTY STATE CONDITION 1: DATABASE EMPTY */}
          {peopleList.length === 0 ? (
            <div className="p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center mx-auto">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Chưa có nhân sự nào trong hệ thống</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Bắt đầu bằng việc thêm nhân sự đầu tiên hoặc nhập danh sách từ tập tin Excel để xây dựng đội ngũ vận hành Bella Land.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
                >
                  + Thêm nhân sự mới
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
                >
                  Nhập danh sách từ Excel
                </button>
              </div>
            </div>
          ) : filteredPeople.length === 0 ? (
            /* EMPTY STATE CONDITION 2: FILTER NO RESULTS */
            <div className="p-12 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto opacity-70" />
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Không tìm thấy nhân sự phù hợp</h3>
              <p className="text-xs text-slate-500">Thử thay đổi từ khóa tìm kiếm hoặc bỏ các bộ lọc đã chọn.</p>
              <button
                onClick={() => { setSearch(''); setFilterBranch('all'); setFilterDepartment('all'); setFilterStatus('all'); setActiveCategoryTab('all'); }}
                className="px-4 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-blue-600 rounded-xl"
              >
                Xóa bộ lọc
              </button>
            </div>
          ) : viewMode === 'list' ? (
            /* LIST TABLE VIEW (DEFAULT) */
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left text-xs border-collapse min-w-[960px]">
                <thead className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5 w-10 text-center">
                      <input type="checkbox" onChange={handleSelectAll} checked={filteredPeople.length > 0 && filteredPeople.every(person => selectedIds.includes(person.id))} className="rounded text-blue-600" />
                    </th>
                    <th className="p-3.5 whitespace-nowrap">Nhân sự</th>
                    <th className="p-3.5 whitespace-nowrap">Đơn vị / Chi nhánh</th>
                    <th className="p-3.5 whitespace-nowrap">Vai trò / Chức danh</th>
                    <th className="p-3.5 whitespace-nowrap">Dự án phụ trách</th>
                    <th className="p-3.5 whitespace-nowrap">Hiệu suất / Lead & GD</th>
                    <th className="p-3.5 text-center whitespace-nowrap">Trạng thái</th>
                    <th className="p-3.5 text-right whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredPeople.map(person => {
                    const isSelected = selectedPerson?.id === person.id;
                    const isChecked = selectedIds.includes(person.id);

                    return (
                      <tr
                        key={person.id}
                        onClick={() => setSelectedPerson(person)}
                        className={`transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/70 dark:bg-blue-950/30 font-semibold'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <td className="p-3.5 text-center" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={isChecked} onChange={() => handleSelectOne(person.id)} className="rounded text-blue-600" />
                        </td>

                        {/* Person Info */}
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-xs shrink-0 shadow-2xs">
                              {person.fullName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-extrabold text-slate-900 dark:text-white text-xs">{person.fullName}</p>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                                <span>{person.code}</span>
                                <span>•</span>
                                <span>{person.phone}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Unit & Branch */}
                        <td className="p-3.5 whitespace-nowrap">
                          <p className="font-bold text-slate-800 dark:text-slate-200">{person.branch}</p>
                          <p className="text-[10px] text-slate-400 font-semibold">{person.department}</p>
                        </td>

                        {/* Role & Category */}
                        <td className="p-3.5 whitespace-nowrap">
                          <p className="font-extrabold text-slate-900 dark:text-white">{person.roleTitle}</p>
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black mt-0.5 ${
                            person.category === 'employee' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' :
                            person.category === 'broker' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' :
                            'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          }`}>
                            {person.categoryLabel}
                          </span>
                        </td>

                        {/* Assigned Projects */}
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1 flex-wrap max-w-[180px]">
                            {person.assignedProjects.map((p, i) => (
                              <span key={i} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[10px] font-bold">
                                {p}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Performance Metrics */}
                        <td className="p-3.5 whitespace-nowrap">
                          <p className="font-black text-slate-900 dark:text-white text-xs">
                            {person.monthlyRevenue > 0 ? `${(person.monthlyRevenue / 1000000000).toFixed(1)} tỷ` : '0 tỷ'}
                          </p>
                          <p className="text-[10px] text-emerald-600 font-extrabold mt-0.5">
                            {person.dealsClosedCount} GD • {person.leadsCount} Lead
                          </p>
                        </td>

                        {/* Status Pill */}
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black ${
                            person.status === 'active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' :
                            person.status === 'on_leave' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' :
                            'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {person.status === 'active' ? '● Hoạt động' : person.status === 'on_leave' ? '🟡 Nghỉ phép' : '🔴 Tạm dừng'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="p-3.5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedPerson(person)}
                            className="px-2.5 py-1 text-xs font-bold text-blue-600 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 transition-all"
                          >
                            Chi tiết ➔
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* GRID CARD VIEW */
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPeople.map(person => (
                <div
                  key={person.id}
                  onClick={() => setSelectedPerson(person)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                    selectedPerson?.id === person.id ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-100' : 'border-slate-200 dark:border-slate-800 hover:border-blue-400'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-sm">
                        {person.fullName.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-900 dark:text-white text-xs">{person.fullName}</h4>
                        <p className="text-[10px] text-slate-500 font-semibold">{person.roleTitle}</p>
                      </div>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  </div>

                  <div className="text-xs text-slate-500 space-y-1">
                    <p className="truncate">📍 {person.branch}</p>
                    <p className="truncate">🏢 {person.assignedProjects.join(', ')}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs font-bold">
                    <span className="text-emerald-600">{(person.monthlyRevenue / 1000000000).toFixed(1)} tỷ doanh số</span>
                    <span className="text-slate-400">{person.dealsClosedCount} GD</span>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* ── RIGHT DETAIL DRAWER (PEOPLE OPERATING WORKSPACE COMMAND) ── */}
        {selectedPerson && (
          <DrawerPanel person={selectedPerson} onClose={() => setSelectedPerson(null)} />
        )}

      </div>

      {/* ── MODAL: THÊM NHÂN SỰ MOÍ ── */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-blue-600" /> Thêm nhân sự mới vào hệ thống
                </h3>
                <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg hover:bg-slate-100">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleCreatePerson} className="space-y-4 text-xs font-semibold">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Họ và tên *</label>
                  <input
                    required
                    placeholder="VD: Nguyễn Văn Hoàng"
                    value={newPerson.fullName}
                    onChange={e => setNewPerson({ ...newPerson, fullName: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">Phân loại nhân sự</label>
                    <PremiumSelect
                      value={newPerson.category}
                      onChange={(val) => {
                        if (isPersonCategory(val)) {
                          setNewPerson({ ...newPerson, category: val });
                        }
                      }}
                      options={[
                        { value: "employee", label: "Nhân viên nội bộ" },
                        { value: "broker", label: "Môi giới tự do" },
                        { value: "agency", label: "Đại lý F1" },
                        { value: "partner", label: "Đối tác F2" },
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">Chi nhánh trực thuộc</label>
                    <PremiumSelect
                      value={newPerson.branch}
                      onChange={(val) => setNewPerson({ ...newPerson, branch: val })}
                      options={[
                        { value: "Chi nhánh Hồ Chí Minh", label: "Chi nhánh Hồ Chí Minh" },
                        { value: "Chi nhánh Bình Dương", label: "Chi nhánh Bình Dương" },
                        { value: "Chi nhánh Đà Nẵng", label: "Chi nhánh Đà Nẵng" },
                      ]}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="hoang.nv@bellaland.vn"
                      value={newPerson.email}
                      onChange={e => setNewPerson({ ...newPerson, email: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">Số điện thoại</label>
                    <input
                      placeholder="0909 xxx xxx"
                      value={newPerson.phone}
                      onChange={e => setNewPerson({ ...newPerson, phone: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-black text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-xs"
                  >
                    Lưu hồ sơ nhân sự
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: NHẬP EXCEL ── */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-xl space-y-5 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center mx-auto">
                <Upload className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Nhập danh sách nhân sự từ Excel</h3>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  Tải lên tệp .xlsx hoặc .csv theo mẫu chuẩn Bella Land để nhập hàng loạt nhân viên, môi giới và đại lý.
                </p>
              </div>

              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 hover:border-blue-500 cursor-pointer transition-all">
                <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Kéo thả tệp vào đây hoặc Bấm để chọn file</p>
                <p className="text-[10px] text-slate-400 mt-1">Hỗ trợ định dạng .xlsx, .csv (Tối đa 10MB)</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    unavailableLandAction("Thao tác nhân sự");
                  }}
                  className="px-4 py-2 text-xs font-black text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-xs"
                >
                  Tiến hành nhập dữ liệu
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

function DrawerPanel({ person, onClose }: { person: PeopleItem; onClose: () => void }) {
  const [tab, setTab] = useState<'overview' | 'performance' | 'access' | 'history'>('overview');

  return (
    <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-lg space-y-4 transition-all">
      {/* Drawer Top Controls */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <span className="text-xs font-black uppercase tracking-wider text-slate-400">HỒ SƠ VẬN HÀNH NHÂN SỰ</span>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Profile Header Card */}
      <div className="flex items-center gap-3.5">
        <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white font-black flex items-center justify-center text-xl shadow-sm shrink-0">
          {person.fullName.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-black text-slate-900 dark:text-white truncate">{person.fullName}</h3>
          <p className="text-xs text-slate-500 font-semibold">{person.roleTitle} • <span className="font-mono text-blue-600">{person.code}</span></p>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-md">
              ● {person.statusLabel}
            </span>
            <span className="text-[10px] text-slate-400">{person.categoryLabel}</span>
          </div>
        </div>
      </div>

      {/* Quick Contact Bar */}
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => toast.info(`Đang gọi ${person.phone}...`)} className="py-2 px-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1">
          <Phone className="w-3.5 h-3.5 text-blue-600" /> Gọi điện
        </button>
        <button onClick={() => toast.info(`Mở nhắn tin với ${person.fullName}`)} className="py-2 px-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1">
          <MessageSquare className="w-3.5 h-3.5 text-cyan-600" /> Nhắn tin
        </button>
        <button onClick={() => toast.info(`Gửi email cho ${person.email}`)} className="py-2 px-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1">
          <Mail className="w-3.5 h-3.5 text-amber-600" /> Email
        </button>
      </div>

      {/* Sub-Tabs Bar: [Tổng quan | Hiệu suất | Quyền | Lịch sử] */}
      <div className="flex items-center border-b border-slate-100 dark:border-slate-800 gap-1 pt-1">
        {DRAWER_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`py-1.5 px-3 text-xs font-extrabold border-b-2 transition-all cursor-pointer ${
              tab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="space-y-4 pt-1 text-xs">
        {tab === 'overview' && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl space-y-2 font-semibold">
              <div className="flex justify-between">
                <span className="text-slate-500">Chi nhánh:</span>
                <span className="text-slate-900 dark:text-white font-bold">{person.branch}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Phòng ban / Team:</span>
                <span className="text-slate-900 dark:text-white font-bold">{person.department} • {person.team}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Quản lý trực tiếp:</span>
                <span className="text-blue-600 font-bold">{person.managerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ngày gia nhập:</span>
                <span className="text-slate-800 dark:text-slate-200">{person.joinedDate}</span>
              </div>
            </div>

            <div>
              <span className="font-extrabold text-slate-400 uppercase tracking-wider text-[10px] block mb-1.5">DỰ ÁN PHỤ TRÁCH</span>
              <div className="flex flex-wrap gap-1.5">
                {person.assignedProjects.map((proj, idx) => (
                  <span key={idx} className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-extrabold rounded-lg text-xs">
                    🏙️ {proj}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'performance' && (
          <div className="space-y-3">
            <span className="font-extrabold text-slate-400 uppercase tracking-wider text-[10px] block">HIỆU SUẤT THÁNG 9/2026</span>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-2xl">
                <span className="text-[10px] text-slate-500 font-bold">Doanh số đạt</span>
                <span className="text-base font-black text-blue-600 block mt-0.5">
                  {person.monthlyRevenue > 0 ? `${(person.monthlyRevenue / 1000000000).toFixed(1)} tỷ` : '0 tỷ'}
                </span>
              </div>
              <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 rounded-2xl">
                <span className="text-[10px] text-slate-500 font-bold">Giao dịch chốt</span>
                <span className="text-base font-black text-emerald-600 block mt-0.5">{person.dealsClosedCount} HĐ</span>
              </div>
              <div className="p-3 bg-purple-50/50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900 rounded-2xl">
                <span className="text-[10px] text-slate-500 font-bold">Tỷ lệ Conversion</span>
                <span className="text-base font-black text-purple-600 block mt-0.5">{person.conversionRate}%</span>
              </div>
              <div className="p-3 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 rounded-2xl">
                <span className="text-[10px] text-slate-500 font-bold">Đánh giá SLA</span>
                <span className="text-base font-black text-amber-600 block mt-0.5">{person.slaScore}%</span>
              </div>
            </div>
          </div>
        )}

        {tab === 'access' && (
          <div className="space-y-3">
            <span className="font-extrabold text-slate-400 uppercase tracking-wider text-[10px] block">PHẠM VI & PHÂN QUYỀN HỆ THỐNG</span>
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl space-y-2.5">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold text-slate-900 dark:text-white text-xs">{person.accessRole}</p>
                  <p className="text-[11px] text-slate-500 font-semibold">{person.governanceScope}</p>
                </div>
              </div>
              <div className="border-t border-slate-200/60 dark:border-slate-700 pt-2 space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                <p>• Lead Management: <span className="font-bold text-slate-900 dark:text-white">Manage Team Scope</span></p>
                <p>• Hợp đồng BĐS: <span className="font-bold text-slate-900 dark:text-white">Xem & Tạo mới</span></p>
                <p>• Phê duyệt thanh toán: <span className="font-bold text-blue-600">Level 2 Approval</span></p>
              </div>
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div className="space-y-2">
            <span className="font-extrabold text-slate-400 uppercase tracking-wider text-[10px] block">NHẬT KÝ HOẠT ĐỘNG GẦN ĐÂY</span>
            <div className="space-y-2 text-[11px]">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">Chốt thành công giao dịch #HĐ-882</p>
                  <p className="text-[10px] text-slate-400">Dự án Elyse Island • Căn B12-04</p>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold">15 phút trước</span>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">Tiếp nhận 3 Lead tiềm năng mới</p>
                  <p className="text-[10px] text-slate-400">Từ chiến dịch Marketing Facebook</p>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold">2 giờ trước</span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => toast.info(`Mở giao diện phân quyền chi tiết cho ${person.fullName}`)}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl shadow-xs text-xs mt-2"
        >
          Cấu hình phân quyền chi tiết ➔
        </button>
      </div>
    </div>
  );
}
