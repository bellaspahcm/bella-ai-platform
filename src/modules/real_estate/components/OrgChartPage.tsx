'use client';

/**
 * @module modules/real_estate/components/OrgChartPage
 *
 * Bella Land - Organization Command Center & Visual Org Chart
 * Re-designed to 100% match Reference Image (Tree Navigator + Interactive Visual Org Chart + Unit Detail & Analytics).
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, MapPin, Briefcase, Layers, Users, User, Plus, Search,
  Filter, Download, Maximize2, ZoomIn, ZoomOut, Edit3, Mail, Phone,
  ChevronRight, ChevronDown, CheckCircle2, X, Sparkles, BarChart3,
  PieChart, ArrowUpRight, Shield, Network, Award, FileText, Settings,
  MoreVertical, Bell, ExternalLink, RefreshCw, UserPlus, Check, MessageSquare,
  TrendingUp, Calendar
} from 'lucide-react';
import { LandPreviewNotice, unavailableLandAction } from "@/modules/real_estate/components/LandUiControls";
import { toast } from 'sonner';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

// ── Interfaces & Types ────────────────────────────────────────────────────────

export interface OrgTreeNode {
  id: string;
  name: string;
  code: string;
  type: 'company' | 'region' | 'branch' | 'department' | 'team';
  typeLabel: string;
  memberCount: number;
  managerName?: string;
  children?: OrgTreeNode[];
}

type CenterTab = 'chart' | 'people' | 'analytics' | 'scope';

const CENTER_TABS = [
  { id: 'chart', label: 'Sơ đồ tổ chức' },
  { id: 'people', label: 'Danh sách nhân sự' },
  { id: 'analytics', label: 'Thống kê' },
  { id: 'scope', label: 'Phạm vi quản lý' },
] satisfies ReadonlyArray<{ id: CenterTab; label: string }>;

export interface UnitDetail {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'inactive';
  regionName: string;
  memberCount: number;
  departmentCount: number;
  teamCount: number;
  projectCount: number;
  manager: {
    name: string;
    role: string;
    email: string;
    phone: string;
    avatarUrl?: string;
  };
  description: string;
  assignedProjects: {
    id: string;
    name: string;
    location: string;
    imageUrl: string;
  }[];
}

export interface FeaturedPerson {
  id: string;
  name: string;
  role: string;
  badge: 'Quản lý' | 'Nhân sự';
  avatarUrl?: string;
}

// ── Seed Data (Matching Reference Image Exactly) ──────────────────────────────

const DEMO_TREE_DATA: OrgTreeNode = {
  id: 'root',
  name: 'Bella Real Estate Group',
  code: 'BRE',
  type: 'company',
  typeLabel: 'Tập đoàn',
  memberCount: 147,
  children: [
    {
      id: 'reg-mn',
      name: 'Miền Nam',
      code: 'MN',
      type: 'region',
      typeLabel: 'Khu vực',
      memberCount: 131,
      children: [
        {
          id: 'br-hcm',
          name: 'Chi nhánh Hồ Chí Minh',
          code: 'HCM',
          type: 'branch',
          typeLabel: 'Chi nhánh',
          memberCount: 86,
          managerName: 'Trần Quốc Huy',
          children: [
            { id: 'dept-kd', name: 'Khối Kinh doanh', code: 'KD', type: 'department', typeLabel: 'Phòng ban', memberCount: 28 },
            { id: 'dept-vh', name: 'Khối Vận hành', code: 'VH', type: 'department', typeLabel: 'Phòng ban', memberCount: 12 },
            { id: 'dept-tc', name: 'Khối Tài chính', code: 'TC', type: 'department', typeLabel: 'Phòng ban', memberCount: 8 },
            { id: 'dept-pl', name: 'Khối Pháp lý', code: 'PL', type: 'department', typeLabel: 'Phòng ban', memberCount: 6 },
            { id: 'dept-cs', name: 'Khối CSKH', code: 'CS', type: 'department', typeLabel: 'Phòng ban', memberCount: 10 },
          ]
        },
        {
          id: 'br-bd',
          name: 'Chi nhánh Bình Dương',
          code: 'BD',
          type: 'branch',
          typeLabel: 'Chi nhánh',
          memberCount: 45,
          managerName: 'Lê Văn Nam'
        }
      ]
    },
    {
      id: 'reg-mt',
      name: 'Miền Trung',
      code: 'MT',
      type: 'region',
      typeLabel: 'Khu vực',
      memberCount: 1,
      children: [
        { id: 'br-dn', name: 'Chi nhánh Đà Nẵng', code: 'DN', type: 'branch', typeLabel: 'Chi nhánh', memberCount: 1 }
      ]
    },
    {
      id: 'reg-mb',
      name: 'Miền Bắc',
      code: 'MB',
      type: 'region',
      typeLabel: 'Khu vực',
      memberCount: 1,
      children: [
        { id: 'br-hn', name: 'Chi nhánh Hà Nội', code: 'HN', type: 'branch', typeLabel: 'Chi nhánh', memberCount: 1 }
      ]
    }
  ]
};

const HCM_UNIT_DETAIL: UnitDetail = {
  id: 'br-hcm',
  name: 'Chi nhánh Hồ Chí Minh',
  code: 'HCM',
  status: 'active',
  regionName: 'Miền Nam',
  memberCount: 86,
  departmentCount: 5,
  teamCount: 12,
  projectCount: 4,
  manager: {
    name: 'Trần Quốc Huy',
    role: 'Giám đốc Chi nhánh',
    email: 'huy.tran@bellaland.vn',
    phone: '0909 123 456'
  },
  description: 'Chi nhánh Hồ Chí Minh là đơn vị kinh doanh trọng điểm, phụ trách các dự án tại khu vực TP.HCM và lân cận.',
  assignedProjects: [
    {
      id: 'p-1',
      name: 'The Grand Tower',
      location: 'Q.7, TP.HCM',
      imageUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'p-2',
      name: 'Elyse Island',
      location: 'TP. Thủ Đức',
      imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'p-3',
      name: 'Riverside Heights',
      location: 'Bình Dương',
      imageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=400&q=80'
    }
  ]
};

const FEATURED_PEOPLE: FeaturedPerson[] = [
  { id: 'fp-1', name: 'Trần Quốc Huy', role: 'Giám đốc Chi nhánh', badge: 'Quản lý' },
  { id: 'fp-2', name: 'Nguyễn Thu Hà', role: 'Trưởng phòng Kinh doanh', badge: 'Quản lý' },
  { id: 'fp-3', name: 'Lê Minh Đức', role: 'Trưởng phòng CSKH', badge: 'Quản lý' },
  { id: 'fp-4', name: 'Phạm Thị Mai', role: 'Chuyên viên Pháp lý', badge: 'Nhân sự' }
];

export function OrgChartPage() {
  const [selectedUnitId, setSelectedUnitId] = useState<string>('br-hcm');
  const [activeCenterTab, setActiveCenterTab] = useState<CenterTab>('chart');
  const [rightTab, setRightTab] = useState<'overview' | 'people' | 'departments' | 'projects'>('overview');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    root: true,
    'reg-mn': true,
    'br-hcm': true
  });
  const [treeSearch, setTreeSearch] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [selectedStatBranch, setSelectedStatBranch] = useState('Chi nhánh Hồ Chí Minh');

  const allNodes = useMemo(() => { const items: OrgTreeNode[] = []; const visit = (node: OrgTreeNode) => { items.push(node); node.children?.forEach(visit); }; visit(DEMO_TREE_DATA); return items; }, []);
  const filteredNodes = allNodes.filter(node => (node.name + " " + node.code).toLowerCase().includes((treeSearch || globalSearch).trim().toLowerCase()));
  const selectedNode = allNodes.find(node => node.id === selectedUnitId);
  // Modals
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [selectedPersonModal, setSelectedPersonModal] = useState<FeaturedPerson | null>(null);

  // New Unit Form
  const [newUnit, setNewUnit] = useState({
    name: '',
    code: '',
    type: 'department',
    parentUnit: 'Chi nhánh Hồ Chí Minh',
    managerName: ''
  });

  // Toggle tree expand
  const toggleExpand = (nodeId: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const handleCreateUnit = (e: React.FormEvent) => { e.preventDefault(); unavailableLandAction("Tạo đơn vị tổ chức"); };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto font-sans text-slate-900 dark:text-slate-100"><LandPreviewNotice />
      
      {/* ── 1. HEADER BAR & CONTROLS (Matching Reference Image) ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
            <span>Bella Land</span>
            <span>/</span>
            <span className="text-slate-900 dark:text-white font-bold">Sơ đồ tổ chức</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Sơ đồ tổ chức
          </h1>
          <p className="text-xs md:text-sm text-slate-500 font-semibold mt-0.5 flex items-center gap-1">
            <span>Cấu trúc vận hành, đội ngũ và phạm vi quản lý — Bella Real Estate Group</span>
            <Edit3 className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-blue-600" />
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Top Search Input */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              placeholder="Tìm đơn vị, nhân sự..."
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none shadow-2xs"
            />
          </div>

          {/* Bell & User Profile */}
          <div className="flex items-center gap-2">
            <button onClick={() => unavailableLandAction("Thao tác tổ chức")} className="relative w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-2xs">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white font-black text-[9px] rounded-full flex items-center justify-center">3</span>
            </button>
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl shadow-2xs">
              <div className="w-7 h-7 rounded-full bg-amber-400 text-slate-950 font-black flex items-center justify-center text-xs">
                N
              </div>
              <div className="text-xs">
                <p className="font-extrabold text-slate-900 dark:text-white leading-tight">Nguyễn Văn A</p>
                <p className="text-[10px] text-slate-500 font-semibold">Quản trị viên</p>
              </div>
            </div>
          </div>

          {/* Export & Expand Buttons */}
          <button
            onClick={() => unavailableLandAction("Thao tác tổ chức")}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 transition-all shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> Xuất sơ đồ
          </button>

          <button
            onClick={() => setExpandedNodes({ root: true, 'reg-mn': true, 'br-hcm': true, 'reg-mt': true, 'reg-mb': true })}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 transition-all shadow-2xs"
          >
            <Maximize2 className="w-3.5 h-3.5 text-slate-500" /> Mở rộng tất cả
          </button>

          {/* Primary Action Dropdown */}
          <button
            onClick={() => setShowAddUnitModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" /> Thêm đơn vị ▾
          </button>
        </div>
      </div>

      {/* ── 2. TOP METRICS ROW (7 KPI CARDS MATCHING REFERENCE IMAGE) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Card 1: Công ty / Tập đoàn */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 dark:text-white">1</div>
            <p className="text-[10px] font-bold text-slate-500">Công ty / Tập đoàn</p>
          </div>
        </div>

        {/* Card 2: Khu vực */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 dark:text-white">3</div>
            <p className="text-[10px] font-bold text-slate-500">Khu vực</p>
          </div>
        </div>

        {/* Card 3: Chi nhánh */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center shrink-0">
            <Briefcase className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 dark:text-white">3</div>
            <p className="text-[10px] font-bold text-slate-500">Chi nhánh</p>
          </div>
        </div>

        {/* Card 4: Phòng ban */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 dark:text-white">5</div>
            <p className="text-[10px] font-bold text-slate-500">Phòng ban</p>
          </div>
        </div>

        {/* Card 5: Đội nhóm */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 dark:text-white">12</div>
            <p className="text-[10px] font-bold text-slate-500">Đội nhóm (Teams)</p>
          </div>
        </div>

        {/* Card 6: Nhân sự */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 dark:text-white">86</div>
            <p className="text-[10px] font-bold text-slate-500">Nhân sự</p>
          </div>
        </div>

        {/* Card 7: Vị trí đang trống */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center shrink-0">
            <UserPlus className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xl font-black text-rose-600 dark:text-rose-400">8</div>
            <p className="text-[10px] font-bold text-slate-500">Vị trí đang trống</p>
          </div>
        </div>
      </div>

      {/* ── 3. MAIN WORKSPACE GRID (LEFT TREE NAV, CENTER ORG DIAGRAM, RIGHT COMMAND PANEL) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* ── LEFT PANEL (3 COLS): CƠ CẤU TỔ CHỨC TREE NAVIGATOR ── */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Network className="w-4 h-4 text-blue-600" /> Cơ cấu tổ chức
          </h2>

          {/* Tree Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              placeholder="Tìm trong cơ cấu tổ chức..."
              value={treeSearch}
              onChange={e => setTreeSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none"
            />
          </div>

          {/* Tree List Hierarchy */}
          <div className="space-y-1 pt-1 text-xs font-semibold">
            {/* Root: Bella Real Estate Group */}
            <div>
              <div
                onClick={() => setSelectedUnitId('root')}
                className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all ${
                  selectedUnitId === 'root' ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 font-extrabold' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span onClick={e => { e.stopPropagation(); toggleExpand('root'); }} className="p-0.5 text-slate-400 hover:text-slate-600">
                    {expandedNodes['root'] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </span>
                  <Building2 className="w-4 h-4 text-purple-600" />
                  <span>Bella Real Estate Group</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">BRE</span>
              </div>

              {/* Sub level: Miền Nam */}
              {expandedNodes['root'] && (
                <div className="pl-4 space-y-1 mt-1 border-l border-slate-100 dark:border-slate-800 ml-3">
                  <div
                    onClick={() => setSelectedUnitId('reg-mn')}
                    className={`flex items-center justify-between p-1.5 rounded-xl cursor-pointer transition-all ${
                      selectedUnitId === 'reg-mn' ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 font-extrabold' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span onClick={e => { e.stopPropagation(); toggleExpand('reg-mn'); }} className="p-0.5 text-slate-400 hover:text-slate-600">
                        {expandedNodes['reg-mn'] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </span>
                      <MapPin className="w-3.5 h-3.5 text-blue-500" />
                      <span>Miền Nam</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">MN</span>
                  </div>

                  {/* Branches under Miền Nam */}
                  {expandedNodes['reg-mn'] && (
                    <div className="pl-4 space-y-1 border-l border-slate-100 dark:border-slate-800 ml-3">
                      {/* Chi nhánh HCM - Active Selection */}
                      <div>
                        <div
                          onClick={() => setSelectedUnitId('br-hcm')}
                          className={`flex items-center justify-between p-1.5 rounded-xl cursor-pointer transition-all ${
                            selectedUnitId === 'br-hcm' ? 'bg-blue-600 text-white font-extrabold shadow-xs' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span onClick={e => { e.stopPropagation(); toggleExpand('br-hcm'); }} className="p-0.5 opacity-80">
                              {expandedNodes['br-hcm'] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </span>
                            <Briefcase className="w-3.5 h-3.5" />
                            <span>Chi nhánh Hồ Chí Minh</span>
                          </div>
                          <span className="text-[10px] font-mono opacity-80">HCM</span>
                        </div>

                        {/* Departments under HCM */}
                        {expandedNodes['br-hcm'] && (
                          <div className="pl-4 space-y-1 mt-1 border-l border-slate-200 dark:border-slate-700 ml-3 text-[11px]">
                            {[
                              { id: 'dept-kd', name: 'Khối Kinh doanh', count: 28 },
                              { id: 'dept-vh', name: 'Khối Vận hành', count: 12 },
                              { id: 'dept-tc', name: 'Khối Tài chính', count: 8 },
                              { id: 'dept-pl', name: 'Khối Pháp lý', count: 6 },
                              { id: 'dept-cs', name: 'Khối CSKH', count: 10 },
                            ].map(dept => (
                              <div
                                key={dept.id}
                                onClick={() => setSelectedUnitId(dept.id)}
                                className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition-all ${
                                  selectedUnitId === dept.id ? 'bg-blue-100 text-blue-800 font-bold dark:bg-blue-900/50 dark:text-blue-200' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                <div className="flex items-center gap-1.5">
                                  <Layers className="w-3 h-3 text-slate-400" />
                                  <span>{dept.name}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-semibold">👥 {dept.count}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Chi nhánh Bình Dương */}
                      <div
                        onClick={() => setSelectedUnitId('br-bd')}
                        className={`flex items-center justify-between p-1.5 rounded-xl cursor-pointer transition-all ${
                          selectedUnitId === 'br-bd' ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 font-extrabold' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Chi nhánh Bình Dương</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">BD</span>
                      </div>
                    </div>
                  )}

                  {/* Miền Trung */}
                  <div
                    onClick={() => setSelectedUnitId('reg-mt')}
                    className="flex items-center justify-between p-1.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <div className="flex items-center gap-1.5">
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      <MapPin className="w-3.5 h-3.5 text-blue-500" />
                      <span>Miền Trung</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">MT</span>
                  </div>

                  {/* Miền Bắc */}
                  <div
                    onClick={() => setSelectedUnitId('reg-mb')}
                    className="flex items-center justify-between p-1.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <div className="flex items-center gap-1.5">
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      <MapPin className="w-3.5 h-3.5 text-blue-500" />
                      <span>Miền Bắc</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">MB</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── CENTER PANEL (6 COLS): INTERACTIVE VISUAL ORG CHART DIAGRAM ── */}
        <div className="lg:col-span-6 space-y-4">
          
          {/* Sub-tabs Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-2 rounded-2xl shadow-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {CENTER_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCenterTab(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeCenterTab === tab.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Diagram Controls */}
            <div className="flex items-center gap-1 text-xs text-slate-500 font-bold pr-2">
              <button onClick={() => setZoomLevel(prev => Math.max(50, prev - 10))} className="p-1 rounded-lg hover:bg-slate-100">
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="min-w-[40px] text-center">{zoomLevel}%</span>
              <button onClick={() => setZoomLevel(prev => Math.min(150, prev + 10))} className="p-1 rounded-lg hover:bg-slate-100">
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setZoomLevel(100)} className="p-1 rounded-lg hover:bg-slate-100">
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* VISUAL ORG CHART DIAGRAM CONTAINER (MATCHING REFERENCE IMAGE DIAGRAM) */}
          {activeCenterTab === 'chart' ? ((treeSearch || globalSearch).trim() ? <div className="p-4 space-y-2" aria-label="Kết quả đơn vị">{filteredNodes.map(node => <button key={node.id} onClick={() => setSelectedUnitId(node.id)} className="block rounded border p-3">{node.name} · {node.code}</button>)}{filteredNodes.length === 0 && <p>Không có đơn vị phù hợp.</p>}</div> : (<div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs overflow-x-auto min-h-[440px] flex flex-col items-center justify-center">
            
            <div className="space-y-6 text-center transition-transform duration-200" style={{ transform: `scale(${zoomLevel / 100})` }}>
              
              {/* Level 1: Root Node (Bella Real Estate Group) */}
              <div className="flex justify-center">
                <div
                  onClick={() => setSelectedUnitId('root')}
                  className={`px-6 py-3 bg-white dark:bg-slate-800 border-2 rounded-2xl shadow-sm flex items-center gap-3 cursor-pointer transition-all ${
                    selectedUnitId === 'root' ? 'border-blue-600 ring-2 ring-blue-100' : 'border-slate-200 dark:border-slate-700 hover:border-blue-400'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Bella Real Estate Group</h3>
                    <p className="text-[10px] text-slate-400 font-semibold">Hội đồng quản trị</p>
                  </div>
                </div>
              </div>

              {/* Vertical connector line */}
              <div className="w-0.5 h-6 bg-slate-200 dark:bg-slate-700 mx-auto -my-3" />

              {/* Horizontal Connector Line for Regions */}
              <div className="w-[80%] max-w-[500px] h-0.5 bg-slate-200 dark:bg-slate-700 mx-auto" />

              {/* Level 2: Region Nodes */}
              <div className="flex justify-center gap-4 pt-1">
                {/* Region: Miền Bắc */}
                <div
                  onClick={() => setSelectedUnitId('reg-mb')}
                  className={`p-3 bg-white dark:bg-slate-800 border rounded-2xl text-center min-w-[120px] cursor-pointer ${
                    selectedUnitId === 'reg-mb' ? 'border-blue-600 ring-2 ring-blue-100' : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 mx-auto flex items-center justify-center mb-1">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <p className="font-bold text-xs text-slate-900 dark:text-white">Miền Bắc</p>
                  <p className="text-[10px] text-slate-400">1 chi nhánh</p>
                </div>

                {/* Region: Miền Nam (Active/Expanded Branch Layer) */}
                <div
                  onClick={() => setSelectedUnitId('reg-mn')}
                  className={`p-3 bg-white dark:bg-slate-800 border-2 rounded-2xl text-center min-w-[130px] cursor-pointer shadow-xs ${
                    selectedUnitId === 'reg-mn' ? 'border-blue-600 ring-2 ring-blue-100' : 'border-blue-400'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-1">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <p className="font-extrabold text-xs text-slate-900 dark:text-white">Miền Nam</p>
                  <p className="text-[10px] text-blue-600 font-bold">2 chi nhánh</p>
                </div>

                {/* Region: Miền Trung */}
                <div
                  onClick={() => setSelectedUnitId('reg-mt')}
                  className={`p-3 bg-white dark:bg-slate-800 border rounded-2xl text-center min-w-[120px] cursor-pointer ${
                    selectedUnitId === 'reg-mt' ? 'border-blue-600 ring-2 ring-blue-100' : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-1">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <p className="font-bold text-xs text-slate-900 dark:text-white">Miền Trung</p>
                  <p className="text-[10px] text-slate-400">1 chi nhánh</p>
                </div>
              </div>

              {/* Vertical Connector Line from Miền Nam to Branches */}
              <div className="w-0.5 h-6 bg-slate-200 dark:bg-slate-700 mx-auto -my-3" />

              {/* Level 3: Branch Nodes under Miền Nam */}
              <div className="flex justify-center gap-6 pt-1">
                {/* Branch: Chi nhánh HCM - Active Selection */}
                <div
                  onClick={() => setSelectedUnitId('br-hcm')}
                  className={`p-3.5 bg-blue-50/50 dark:bg-blue-950/30 border-2 rounded-2xl text-center min-w-[160px] cursor-pointer shadow-sm ${
                    selectedUnitId === 'br-hcm' ? 'border-blue-600 ring-2 ring-blue-200 dark:ring-blue-900' : 'border-blue-300'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white mx-auto flex items-center justify-center mb-1">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <p className="font-extrabold text-xs text-slate-900 dark:text-white">Chi nhánh Hồ Chí Minh</p>
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">86 nhân sự</p>
                </div>

                {/* Branch: Chi nhánh Bình Dương */}
                <div
                  onClick={() => setSelectedUnitId('br-bd')}
                  className={`p-3.5 bg-white dark:bg-slate-800 border rounded-2xl text-center min-w-[160px] cursor-pointer ${
                    selectedUnitId === 'br-bd' ? 'border-blue-600 ring-2 ring-blue-100' : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 mx-auto flex items-center justify-center mb-1">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <p className="font-bold text-xs text-slate-900 dark:text-white">Chi nhánh Bình Dương</p>
                  <p className="text-[10px] text-slate-400 font-semibold">45 nhân sự</p>
                </div>
              </div>

              {/* Vertical Line down to Departments under Chi nhánh HCM */}
              <div className="w-0.5 h-6 bg-slate-200 dark:bg-slate-700 mx-auto -my-3" />
              <div className="w-[90%] max-w-[560px] h-0.5 bg-slate-200 dark:bg-slate-700 mx-auto" />

              {/* Level 4: 5 Departments under Chi nhánh HCM */}
              <div className="grid grid-cols-5 gap-2 pt-1">
                {/* Kinh doanh */}
                <div
                  onClick={() => setSelectedUnitId('dept-kd')}
                  className={`p-2.5 rounded-2xl text-center cursor-pointer transition-all ${
                    selectedUnitId === 'dept-kd' ? 'ring-2 ring-blue-500 font-bold' : ''
                  } bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800`}
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-500 text-white mx-auto flex items-center justify-center mb-1">
                    <BarChart3 className="w-3.5 h-3.5" />
                  </div>
                  <p className="font-bold text-[11px]">Kinh doanh</p>
                  <p className="text-xs font-black mt-0.5">28</p>
                </div>

                {/* Vận hành */}
                <div
                  onClick={() => setSelectedUnitId('dept-vh')}
                  className={`p-2.5 rounded-2xl text-center cursor-pointer transition-all ${
                    selectedUnitId === 'dept-vh' ? 'ring-2 ring-emerald-500 font-bold' : ''
                  } bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800`}
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white mx-auto flex items-center justify-center mb-1">
                    <Settings className="w-3.5 h-3.5" />
                  </div>
                  <p className="font-bold text-[11px]">Vận hành</p>
                  <p className="text-xs font-black mt-0.5">12</p>
                </div>

                {/* Tài chính */}
                <div
                  onClick={() => setSelectedUnitId('dept-tc')}
                  className={`p-2.5 rounded-2xl text-center cursor-pointer transition-all ${
                    selectedUnitId === 'dept-tc' ? 'ring-2 ring-amber-500 font-bold' : ''
                  } bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800`}
                >
                  <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 mx-auto flex items-center justify-center mb-1">
                    <Award className="w-3.5 h-3.5" />
                  </div>
                  <p className="font-bold text-[11px]">Tài chính</p>
                  <p className="text-xs font-black mt-0.5">8</p>
                </div>

                {/* Pháp lý */}
                <div
                  onClick={() => setSelectedUnitId('dept-pl')}
                  className={`p-2.5 rounded-2xl text-center cursor-pointer transition-all ${
                    selectedUnitId === 'dept-pl' ? 'ring-2 ring-purple-500 font-bold' : ''
                  } bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800`}
                >
                  <div className="w-7 h-7 rounded-lg bg-purple-500 text-white mx-auto flex items-center justify-center mb-1">
                    <Shield className="w-3.5 h-3.5" />
                  </div>
                  <p className="font-bold text-[11px]">Pháp lý</p>
                  <p className="text-xs font-black mt-0.5">6</p>
                </div>

                {/* CSKH */}
                <div
                  onClick={() => setSelectedUnitId('dept-cs')}
                  className={`p-2.5 rounded-2xl text-center cursor-pointer transition-all ${
                    selectedUnitId === 'dept-cs' ? 'ring-2 ring-rose-500 font-bold' : ''
                  } bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800`}
                >
                  <div className="w-7 h-7 rounded-lg bg-rose-500 text-white mx-auto flex items-center justify-center mb-1">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <p className="font-bold text-[11px]">CSKH</p>
                  <p className="text-xs font-black mt-0.5">10</p>
                </div>
              </div>

            </div>
          </div>)) : <div className="rounded-2xl border p-6"><p>Chế độ này chưa có dữ liệu được xác minh.</p><a className="underline" href={activeCenterTab === 'people' ? '/dashboard/real-estate/people' : '/dashboard/real-estate/bi-analytics'}>Mở {activeCenterTab === 'people' ? 'danh bạ nhân sự' : 'phân tích'}</a></div>}
        </div>

        {/* ── RIGHT PANEL (3 COLS): UNIT COMMAND & DETAIL VIEW (CHI NHÁNH HỒ CHÍ MINH) ── */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
          
          {/* Header Unit Info */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">{selectedNode?.name || "Chọn đơn vị"}</h2>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                📍 {selectedNode?.typeLabel || "—"} • Mã đơn vị: <span className="font-mono">{selectedNode?.code || "—"}</span>
              </p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black">
              Đang hoạt động
            </span>
          </div>

          {/* Right Sub-tabs */}
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2 text-xs font-bold">
            <button onClick={() => setRightTab('overview')} className={`pb-1 border-b-2 ${rightTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}>
              Tổng quan
            </button>
            <button onClick={() => setRightTab('people')} className={`pb-1 border-b-2 ${rightTab === 'people' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}>
              Nhân sự
            </button>
            <button onClick={() => setRightTab('departments')} className={`pb-1 border-b-2 ${rightTab === 'departments' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}>
              Phòng ban
            </button>
            <button onClick={() => setRightTab('projects')} className={`pb-1 border-b-2 ${rightTab === 'projects' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}>
              Dự án
            </button>
          </div>

          {selectedUnitId === 'br-hcm' && rightTab === 'overview' ? <>          {/* Manager Profile Box */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-700/80 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-base shrink-0 shadow-xs">
              QH
            </div>
            <div className="min-w-0 flex-1 text-xs">
              <h4 className="font-extrabold text-slate-900 dark:text-white truncate">{HCM_UNIT_DETAIL.manager.name}</h4>
              <p className="text-[10px] text-slate-500 font-semibold">{HCM_UNIT_DETAIL.manager.role}</p>
              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                <span className="truncate">{HCM_UNIT_DETAIL.manager.email}</span>
              </div>
            </div>
          </div>

          {/* 4 Quick Stat Pills */}
          <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
            <div className="p-2.5 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-xl text-center">
              <span className="text-lg font-black text-blue-600 block">86</span>
              <span className="text-[10px] text-slate-500">Nhân sự</span>
            </div>
            <div className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 rounded-xl text-center">
              <span className="text-lg font-black text-emerald-600 block">5</span>
              <span className="text-[10px] text-slate-500">Phòng ban</span>
            </div>
            <div className="p-2.5 bg-cyan-50/50 dark:bg-cyan-950/30 border border-cyan-100 dark:border-cyan-900 rounded-xl text-center">
              <span className="text-lg font-black text-cyan-600 block">12</span>
              <span className="text-[10px] text-slate-500">Đội nhóm</span>
            </div>
            <div className="p-2.5 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 rounded-xl text-center">
              <span className="text-lg font-black text-amber-600 block">4</span>
              <span className="text-[10px] text-slate-500">Dự án phụ trách</span>
            </div>
          </div>

          {/* Description Section */}
          <div className="text-xs space-y-1">
            <div className="flex items-center justify-between text-slate-500 font-bold">
              <span>Mô tả</span>
              <button onClick={() => unavailableLandAction("Thao tác tổ chức")} className="text-blue-600 hover:underline flex items-center gap-0.5 text-[10px]">
                <Edit3 className="w-3 h-3" /> Chỉnh sửa
              </button>
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
              {HCM_UNIT_DETAIL.description}
            </p>
          </div>

          {/* Assigned Projects Section */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs font-extrabold">
              <span className="text-slate-900 dark:text-white">Dự án phụ trách</span>
              <button onClick={() => unavailableLandAction("Thao tác tổ chức")} className="text-blue-600 text-[10px] hover:underline">Xem tất cả</button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {HCM_UNIT_DETAIL.assignedProjects.map(proj => (
                <div key={proj.id} className="group cursor-pointer">
                  <div className="h-14 rounded-xl bg-slate-200 overflow-hidden relative">
                    <img src={proj.imageUrl} alt={proj.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                  <p className="font-extrabold text-slate-900 dark:text-white text-[10px] truncate mt-1">{proj.name}</p>
                  <p className="text-[9px] text-slate-400 truncate">{proj.location}</p>
                </div>
              ))}
            </div>
          </div>
</> : <div className="space-y-3 text-sm">
{rightTab === 'overview' && <><p>Nhân sự minh họa: {selectedNode?.memberCount ?? 'Chưa có'}</p><p>Quản lý: {selectedNode?.managerName || 'Chưa xác minh'}</p></>}
{rightTab === 'people' && <a href="/dashboard/real-estate/people">Mở danh bạ nhân sự — chưa xác minh nhân sự của đơn vị này</a>}
{rightTab === 'departments' && <ul>{selectedNode?.children?.map(node => <li key={node.id}><button onClick={() => setSelectedUnitId(node.id)}>{node.name}</button></li>)}{!selectedNode?.children?.length && <li>Chưa có đơn vị trực thuộc trong dữ liệu minh họa.</li>}</ul>}
{rightTab === 'projects' && <a href="/dashboard/real-estate/projects">Mở danh mục dự án — chưa xác minh liên kết của đơn vị này</a>}
</div>}
        </div>
      </div>

      {/* ── 4. BOTTOM ANALYTICS & SPOTLIGHT CARDS (3 CARDS MATCHING REFERENCE IMAGE) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Bottom Left Card: Thống kê nhân sự theo phòng ban */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" /> Thống kê nhân sự theo phòng ban
            </h3>
            <PremiumSelect disabled
              value={selectedStatBranch}
              onChange={(val) => setSelectedStatBranch(val)}
              options={[
                { value: "Chi nhánh Hồ Chí Minh", label: "Chi nhánh Hồ Chí Minh" },
                { value: "Chi nhánh Bình Dương", label: "Chi nhánh Bình Dương" },
              ]}
            />
          </div>

          {/* Bar Chart Bars */}
          <div className="h-44 flex items-end justify-between gap-4 pt-6 px-2 border-b border-slate-100 dark:border-slate-800">
            {[
              { name: 'Kinh doanh', count: 28, height: '80%', color: 'bg-blue-600' },
              { name: 'Vận hành', count: 12, height: '40%', color: 'bg-emerald-500' },
              { name: 'Tài chính', count: 8, height: '30%', color: 'bg-amber-500' },
              { name: 'Pháp lý', count: 6, height: '22%', color: 'bg-purple-600' },
              { name: 'CSKH', count: 10, height: '35%', color: 'bg-rose-500' },
            ].map((bar, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <span className="text-xs font-black text-slate-900 dark:text-white">{bar.count}</span>
                <div className={`w-full rounded-t-xl transition-all ${bar.color}`} style={{ height: bar.height }} />
                <span className="text-[10px] font-bold text-slate-500 truncate w-full text-center">{bar.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Middle Card: Cơ cấu nhân sự (Donut Chart) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <PieChart className="w-4 h-4 text-emerald-600" /> Cơ cấu nhân sự
          </h3>

          <div className="flex items-center justify-between gap-4 pt-2">
            {/* Donut Graphic */}
            <div className="relative w-32 h-32 rounded-full border-8 border-blue-600 border-t-emerald-500 border-r-amber-500 border-l-purple-500 flex items-center justify-center shrink-0">
              <div className="text-center">
                <span className="text-xl font-black text-slate-900 dark:text-white block leading-none">86</span>
                <span className="text-[9px] font-bold text-slate-400">Nhân sự</span>
              </div>
            </div>

            {/* Legend List */}
            <div className="space-y-1.5 text-xs font-semibold flex-1">
              {[
                { label: 'Kinh doanh', percent: '32.6%', dot: 'bg-blue-600' },
                { label: 'Vận hành', percent: '14.0%', dot: 'bg-emerald-500' },
                { label: 'Tài chính', percent: '9.3%', dot: 'bg-amber-500' },
                { label: 'Pháp lý', percent: '7.0%', dot: 'bg-purple-600' },
                { label: 'CSKH', percent: '11.6%', dot: 'bg-rose-500' },
                { label: 'Khác', percent: '25.6%', dot: 'bg-slate-400' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${item.dot}`} />
                    <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                  </div>
                  <span className="font-extrabold text-slate-900 dark:text-white">{item.percent}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Right Card: Nhân sự nổi bật */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs font-extrabold">
            <span className="text-slate-900 dark:text-white flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500" /> Nhân sự nổi bật
            </span>
            <button onClick={() => unavailableLandAction("Thao tác tổ chức")} className="text-blue-600 text-[10px] hover:underline">Xem tất cả</button>
          </div>

          <div className="space-y-2 pt-1">
            {FEATURED_PEOPLE.map(person => (
              <div
                key={person.id}
                onClick={() => setSelectedPersonModal(person)}
                className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-between hover:bg-slate-100 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-xs shrink-0">
                    {person.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-slate-900 dark:text-white text-xs truncate">{person.name}</p>
                    <p className="text-[10px] text-slate-500 font-semibold truncate">{person.role}</p>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black shrink-0 ${
                  person.badge === 'Quản lý' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                }`}>
                  {person.badge}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── MODAL: THÊM ĐƠN VỊ MOÍ ── */}
      <AnimatePresence>
        {showAddUnitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-500" /> Thêm đơn vị / Phòng ban mới
                </h3>
                <button onClick={() => setShowAddUnitModal(false)} className="p-1 rounded-lg hover:bg-slate-100">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleCreateUnit} className="space-y-4 text-xs font-semibold">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Tên đơn vị *</label>
                  <input
                    required
                    placeholder="VD: Phòng Truyền Thông & Sự Kiện"
                    value={newUnit.name}
                    onChange={e => setNewUnit({ ...newUnit, name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">Cấp đơn vị</label>
                    <PremiumSelect
                      value={newUnit.type}
                      onChange={(val) => setNewUnit({ ...newUnit, type: val })}
                      options={[
                        { value: "region", label: "Khu vực" },
                        { value: "branch", label: "Chi nhánh" },
                        { value: "department", label: "Phòng ban" },
                        { value: "team", label: "Đội nhóm (Team)" },
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">Đơn vị trực thuộc</label>
                    <PremiumSelect
                      value={newUnit.parentUnit}
                      onChange={(val) => setNewUnit({ ...newUnit, parentUnit: val })}
                      options={[
                        { value: "Chi nhánh Hồ Chí Minh", label: "Chi nhánh Hồ Chí Minh" },
                        { value: "Chi nhánh Bình Dương", label: "Chi nhánh Bình Dương" },
                        { value: "Bella Real Estate Group", label: "Bella Real Estate Group" },
                      ]}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Người quản lý / Trưởng đơn vị</label>
                  <input
                    placeholder="VD: Nguyễn Văn A"
                    value={newUnit.managerName}
                    onChange={e => setNewUnit({ ...newUnit, managerName: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddUnitModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-black text-slate-950 bg-amber-500 rounded-xl hover:bg-amber-600 shadow-xs"
                  >
                    Lưu đơn vị
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: CHI TIẾT NHÂN SỰ NỔI BẬT ── */}
      <AnimatePresence>
        {selectedPersonModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-xl space-y-4 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-xl mx-auto shadow-md">
                {selectedPersonModal.name.charAt(0)}
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">{selectedPersonModal.name}</h3>
                <p className="text-xs text-slate-500 font-semibold">{selectedPersonModal.role}</p>
                <span className="inline-block mt-2 px-3 py-1 bg-amber-100 text-amber-800 text-[11px] font-black rounded-full">
                  {selectedPersonModal.badge} • Chi nhánh Hồ Chí Minh
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  onClick={() => setSelectedPersonModal(null)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

