"use client";
import { LandPreviewNotice, unavailableLandAction, LandPagination, useLandPagination } from "@/modules/real_estate/components/LandUiControls";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LifeBuoy, Search, Plus, User, MessageSquare, AlertTriangle, CheckCircle2,
  XCircle, ArrowRight, ShieldAlert, Sparkles, Send, Play, Check, RotateCcw, Ban, X,
  Clock, History, UserCheck, Heart, Zap, Award, Bell, Filter, Calendar, ExternalLink,
  ChevronRight, MoreVertical, Building2, Key, CheckSquare, FileText, Tag, ArrowUpRight,
  ChevronDown, Phone, Mail, UserPlus, FileCheck, DollarSign, Users, SlidersHorizontal,
  ChevronLeft, Layers
} from "lucide-react";
import { toast } from "sonner";
import { PremiumSelect } from "@/components/ui/PremiumSelect";
import { ComplaintTicketService } from "@/modules/real_estate/contexts/support/application/ComplaintTicketService";
import { ComplaintTicketProps, TicketPriority, TicketCategory, TicketState } from "@/modules/real_estate/contexts/support/domain/ComplaintTicketAggregate";

// Interface for rich display tickets matching Image 2
export interface SupportTicketItem {
  id: string;
  ticketNumber: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  subject: string;
  description: string;
  categoryTags: string[];
  customerName: string;
  customerCode: string;
  customerPhone: string;
  customerEmail: string;
  customerAvatar?: string;
  projectName: string;
  unitCode: string;
  status: 'new' | 'investigating' | 'processing' | 'waiting_customer' | 'resolved' | 'closed';
  statusLabel: string;
  statusColor: string;
  progressStep: number; // 1 to 4
  slaStatus: 'overdue' | 'valid' | 'none';
  slaLabel: string;
  updatedTime: string;
  updatedDate: string;
  ownerName: string;
}

// Interface for Customer 360 Timeline Step
export interface TimelineStepItem {
  id: string;
  timestamp: string;
  category: 'CSKH' | 'SALES' | 'TÀI CHÍNH' | 'BÀN GIAO' | 'CRM' | 'LEAD';
  categoryColor: string;
  ticketTag?: string;
  title: string;
  description?: string;
  dotColor: string;
}

// 5 Key CSKH Tickets matching Image 2
const INITIAL_TICKETS: SupportTicketItem[] = [
  {
    id: "tick-001",
    ticketNumber: "TK-2026-0001",
    priority: "HIGH",
    subject: "Trễ hạn nộp hồ sơ xin cấp sổ hồng căn CH001",
    description: "Khách hàng phản ánh căn hộ CH001 đã bàn giao 6 tháng nhưng chưa nhận được thông báo nộp hồ sơ cấp sổ.",
    categoryTags: ["Pháp lý", "Sổ hồng"],
    customerName: "Lê Văn C",
    customerCode: "KH00123",
    customerPhone: "0903 123 456",
    customerEmail: "levanc@gmail.com",
    projectName: "Grand Tower",
    unitCode: "CH-1204",
    status: "investigating",
    statusLabel: "Đang xác minh",
    statusColor: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    progressStep: 2,
    slaStatus: "overdue",
    slaLabel: "Quá hạn 3h 24m",
    updatedTime: "17:30",
    updatedDate: "28/07/2026",
    ownerName: "Trần Thị Hỗ Trợ"
  },
  {
    id: "tick-002",
    ticketNumber: "TK-2026-0002",
    priority: "MEDIUM",
    subject: "Sai lệch số tiền tính lãi chậm thanh toán đợt 3",
    description: "Khách hàng phản ánh hệ thống tính sai số ngày chậm thanh toán dẫn đến tiền phạt chênh lệch 1,200,000 VNĐ.",
    categoryTags: ["Thanh toán", "Lãi suất"],
    customerName: "Phạm Thị D",
    customerCode: "KH00456",
    customerPhone: "0908 456 789",
    customerEmail: "phamthid@gmail.com",
    projectName: "Central Residence",
    unitCode: "CH-0901",
    status: "new",
    statusLabel: "Mới nhận",
    statusColor: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
    progressStep: 1,
    slaStatus: "valid",
    slaLabel: "Còn hạn 1 ngày 4h",
    updatedTime: "15:15",
    updatedDate: "01/08/2026",
    ownerName: "Chưa phân công"
  },
  {
    id: "tick-003",
    ticketNumber: "TK-2026-0003",
    priority: "HIGH",
    subject: "Thấm nước trần nhà phòng khách",
    description: "Khách hàng phản ánh căn hộ bị thấm nước sau trận mưa lớn ngày 25/07/2025.",
    categoryTags: ["Bảo hành", "Kỹ thuật"],
    customerName: "Nguyễn Văn H",
    customerCode: "KH00789",
    customerPhone: "0911 234 567",
    customerEmail: "nguyenvanh@gmail.com",
    projectName: "Riverside City",
    unitCode: "CH-2103",
    status: "processing",
    statusLabel: "Đang xử lý",
    statusColor: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
    progressStep: 3,
    slaStatus: "valid",
    slaLabel: "Còn hạn 5h 12m",
    updatedTime: "10:20",
    updatedDate: "28/07/2026",
    ownerName: "Lê Minh Kỹ Thuật"
  },
  {
    id: "tick-004",
    ticketNumber: "TK-2026-0004",
    priority: "LOW",
    subject: "Yêu cầu bổ sung thẻ cư dân",
    description: "Khách hàng đề nghị cấp thêm 2 thẻ cư dân cho người thân.",
    categoryTags: ["Dịch vụ", "Thẻ cư dân"],
    customerName: "Trần Thị M",
    customerCode: "KH00678",
    customerPhone: "0905 678 901",
    customerEmail: "tranthim@gmail.com",
    projectName: "Sunrise Residence",
    unitCode: "CH-1805",
    status: "waiting_customer",
    statusLabel: "Chờ khách hàng",
    statusColor: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    progressStep: 3,
    slaStatus: "valid",
    slaLabel: "Còn hạn 2 ngày",
    updatedTime: "14:45",
    updatedDate: "27/07/2026",
    ownerName: "Phạm Thị CSKH"
  },
  {
    id: "tick-005",
    ticketNumber: "TK-2026-0005",
    priority: "MEDIUM",
    subject: "Tiếng ồn từ căn hộ bên cạnh",
    description: "Khách hàng phản ánh tiếng ồn kéo dài vào đêm muộn.",
    categoryTags: ["Vận hành", "Nội quy"],
    customerName: "Hoàng Văn T",
    customerCode: "KH00912",
    customerPhone: "0909 111 222",
    customerEmail: "hoangvant@gmail.com",
    projectName: "Lake View",
    unitCode: "CH-0608",
    status: "resolved",
    statusLabel: "Đã giải quyết",
    statusColor: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    progressStep: 4,
    slaStatus: "none",
    slaLabel: "-",
    updatedTime: "09:30",
    updatedDate: "26/07/2026",
    ownerName: "Nguyễn Thị VP"
  }
];

// 7 Timeline events for Lê Văn C matching Image 2
const TIMELINE_LE_VAN_C: TimelineStepItem[] = [
  {
    id: "t-1",
    timestamp: "08:49 - 26/08/2026",
    category: "CSKH",
    categoryColor: "bg-red-500 text-white",
    ticketTag: "TK-2026-0001",
    title: "Tạo phiếu phản ánh",
    description: "Trễ hạn nộp hồ sơ xin cấp sổ hồng căn CH001",
    dotColor: "bg-red-500 text-white"
  },
  {
    id: "t-2",
    timestamp: "21/08/2026",
    category: "SALES",
    categoryColor: "bg-blue-600 text-white",
    title: "Ký kết HĐMB",
    description: "Grand Tower - CH-1204",
    dotColor: "bg-blue-600 text-white"
  },
  {
    id: "t-3",
    timestamp: "18/08/2026",
    category: "TÀI CHÍNH",
    categoryColor: "bg-emerald-600 text-white",
    title: "Khách hàng đã thanh toán đủ 95%",
    dotColor: "bg-emerald-600 text-white"
  },
  {
    id: "t-4",
    timestamp: "12/08/2026",
    category: "BÀN GIAO",
    categoryColor: "bg-purple-600 text-white",
    title: "Bàn giao căn hộ",
    description: "Grand Tower - CH-1204",
    dotColor: "bg-purple-600 text-white"
  },
  {
    id: "t-5",
    timestamp: "05/08/2026",
    category: "SALES",
    categoryColor: "bg-teal-600 text-white",
    title: "Tham quan nhà mẫu",
    description: "Cùng gia đình (4 người)",
    dotColor: "bg-teal-600 text-white"
  },
  {
    id: "t-6",
    timestamp: "01/08/2026",
    category: "CRM",
    categoryColor: "bg-amber-500 text-black font-bold",
    title: "Tư vấn dự án",
    description: "Nhận thông tin từ Website",
    dotColor: "bg-amber-500 text-black"
  },
  {
    id: "t-7",
    timestamp: "28/07/2026",
    category: "LEAD",
    categoryColor: "bg-slate-700 text-white",
    title: "Khách hàng được tạo từ Lead",
    description: "Nguồn: Website",
    dotColor: "bg-slate-600 text-white"
  }
];

export default function CustomerServiceCenterPage() {
  const [ticketList, setTicketList] = useState<SupportTicketItem[]>(INITIAL_TICKETS);
  const [selectedTicketId, setSelectedTicketId] = useState<string>("tick-001");
  const [activeTab, setActiveTab] = useState<"all" | "mine" | "unassigned" | "overdue" | "high" | "new" | "processing" | "waiting" | "closed">("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const selectedDateRange = dateFrom || dateTo ? `${dateFrom || "Bắt đầu"} → ${dateTo || "Hiện tại"}` : "Tất cả thời gian";
  const [supportPageSize, setSupportPageSize] = useState("10");

  // Selection Checkboxes
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

  // Modals / Drawers State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<"timeline" | "related" | "notes">("timeline");

  // Form state for creating ticket
  const [newSubject, setNewSubject] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<TicketPriority>("HIGH");
  const [newCategory, setNewCategory] = useState<TicketCategory>("SERVICE_QUALITY");
  const [newCustomerName, setNewCustomerName] = useState("Lê Văn C");
  const [newProject, setNewProject] = useState("Grand Tower");
  const [newUnit, setNewUnit] = useState("CH-1204");

  // Current selected ticket object


  // Quick Filter Counts
  const filterCounts = useMemo(() => {
    return {
      all: ticketList.length,
      mine: ticketList.filter(t => t.ownerName === "Trần Thị Hỗ Trợ").length,
      unassigned: ticketList.filter(t => t.ownerName === "Chưa phân công").length,
      overdue: ticketList.filter(t => t.slaStatus === "overdue").length,
      high: ticketList.filter(t => t.priority === "HIGH" || t.priority === "CRITICAL").length,
      new: ticketList.filter(t => t.status === "new").length,
      processing: ticketList.filter(t => t.status === "processing" || t.status === "investigating").length,
      waiting: ticketList.filter(t => t.status === "waiting_customer").length,
      closed: ticketList.filter(t => t.status === "resolved" || t.status === "closed").length
    };
  }, [ticketList]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return ticketList.filter(t => {
      const date = t.updatedDate.split("/").reverse().join("-");
      if (dateFrom && date < dateFrom || dateTo && date > dateTo) return false;
      // Tab filter
      if (activeTab === "mine" && t.ownerName !== "Trần Thị Hỗ Trợ") return false;
      if (activeTab === "unassigned" && t.ownerName !== "Chưa phân công") return false;
      if (activeTab === "overdue" && t.slaStatus !== "overdue") return false;
      if (activeTab === "high" && t.priority !== "HIGH" && t.priority !== "CRITICAL") return false;
      if (activeTab === "new" && t.status !== "new") return false;
      if (activeTab === "processing" && t.status !== "processing" && t.status !== "investigating") return false;
      if (activeTab === "waiting" && t.status !== "waiting_customer") return false;
      if (activeTab === "closed" && t.status !== "resolved" && t.status !== "closed") return false;

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchNo = t.ticketNumber.toLowerCase().includes(q);
        const matchSubj = t.subject.toLowerCase().includes(q);
        const matchCust = t.customerName.toLowerCase().includes(q);
        const matchUnit = t.unitCode.toLowerCase().includes(q);
        const matchProj = t.projectName.toLowerCase().includes(q);
        if (!matchNo && !matchSubj && !matchCust && !matchUnit && !matchProj) return false;
      }
      return true;
    });
  }, [ticketList, activeTab, search, dateFrom, dateTo]);

  const pagination = useLandPagination(filteredTickets, Number(supportPageSize));
  const currentTicket = pagination.rows.find(ticket => ticket.id === selectedTicketId) || null;
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRowIds(pagination.rows.map(t => t.id));
    } else {
      setSelectedRowIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedRowIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleRowClick = (ticket: SupportTicketItem) => {
    setSelectedTicketId(ticket.id);
  };

  const handleCreateSubmit = (e: React.FormEvent) => { e.preventDefault(); unavailableLandAction("Lưu dữ liệu nghiệp vụ"); };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto font-sans text-slate-900 dark:text-slate-100 pb-12">
      <LandPreviewNotice />
      
      {/* ── 1. HEADER BANNER (Light Theme with High Contrast) ── */}
      <div className="relative rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-6 md:p-7 shadow-xs">
        {/* Subtle Decorative Skyline Overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-[0.07] dark:opacity-20 pointer-events-none mix-blend-multiply dark:mix-blend-luminosity"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1600&q=80')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50/60 via-slate-50/40 to-amber-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-600/10 dark:bg-blue-500/20 border border-blue-600/20 dark:border-blue-400/30 flex items-center justify-center text-[10px] font-black text-blue-600 dark:text-blue-400">
                CS
              </div>
              <span className="text-xs uppercase font-extrabold tracking-widest text-slate-500 dark:text-slate-400">CUSTOMER SERVICE CENTER</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Trung tâm Chăm sóc Khách hàng
            </h1>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 max-w-2xl font-semibold leading-relaxed">
              Tiếp nhận, xử lý và đồng hành cùng khách hàng trong suốt hành trình sở hữu bất động sản
            </p>
          </div>

          {/* Right Header Top Tools & Script Text */}
          <div className="flex flex-col items-start md:items-end gap-3 shrink-0">
            <div className="hidden lg:block text-right font-serif italic text-amber-600 dark:text-amber-400 text-lg font-bold tracking-wide">
              Happy Residents, Greater Tomorrow
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => unavailableLandAction("Thao tác lưu hoặc gửi dữ liệu")}
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition shadow-2xs cursor-pointer"
                title="Tìm kiếm nâng cao"
              >
                <Search className="w-4 h-4" />
              </button>
              <button 
                onClick={() => { setActiveTab("overdue"); toast.info("Đã lọc danh sách phiếu quá hạn!"); }}
                className="relative w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition shadow-2xs cursor-pointer"
                title="Thông báo CSKH"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
              </button>

              {/* User Profile Chip */}
              <div className="flex items-center gap-2.5 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-slate-800 dark:text-slate-100 shadow-2xs">
                <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-black flex items-center justify-center text-xs shadow-xs">
                  A
                </div>
                <div className="text-left text-xs leading-tight">
                  <div className="font-extrabold text-slate-900 dark:text-white">Nguyễn Văn A</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Quản trị viên</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. 5 OPERATIONAL CSKH KPI CARDS (Matching Image 2) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        
        {/* KPI 1: Đang mở */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <CheckSquare className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded-full">
              ↑ 12%
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">32</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Đang mở</div>
          </div>
        </div>

        {/* KPI 2: Quá SLA */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 px-2 py-0.5 rounded-full">
              ↑ 150%
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400">5</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Quá SLA</div>
          </div>
        </div>

        {/* KPI 3: Ưu tiên cao */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 px-2 py-0.5 rounded-full">
              ↑ 33%
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">8</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Ưu tiên cao</div>
          </div>
        </div>

        {/* KPI 4: Đã giải quyết */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded-full">
              ↑ 28%
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">18</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Đã giải quyết</div>
          </div>
        </div>

        {/* KPI 5: Thời gian xử lý TB */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded-full">
              ↑ 20%
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">6.4h</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Thời gian xử lý TB</div>
          </div>
        </div>

      </div>

      {/* ── 3. TOOLBAR, FILTERS & ACTION BAR ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 shadow-sm space-y-4">
        
        {/* Search, Filter Dropdowns and Main Button */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Search Box */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm kiếm theo mã phiếu, tiêu đề, khách hàng, căn hộ, dự án..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs font-medium placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Filter Actions & Primary Action Button */}
          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={() => unavailableLandAction("Thao tác lưu hoặc gửi dữ liệu")}
              className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition flex items-center gap-2 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Bộ lọc</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Date Range Selector */}
            <button 
              aria-expanded={showDateFilter} onClick={() => setShowDateFilter(value => !value)}
              className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition flex items-center gap-2 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>{selectedDateRange}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Primary Gold Action Button */}
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-700 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl transition shadow-md flex items-center gap-2"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Tiếp nhận phản ánh</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-80" />
            </button>
          </div>
        </div>

        {/* Quick Filter Pills Row (Matching Image 2) */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 pb-1 border-t border-slate-100 dark:border-slate-800 scrollbar-none text-xs">
          
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-full font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "all"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
            }`}
          >
            <span>Tất cả</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "all" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"}`}>
              {filterCounts.all}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("mine")}
            className={`px-3 py-1.5 rounded-full font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "mine"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
            }`}
          >
            <span>Của tôi</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {filterCounts.mine}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("unassigned")}
            className={`px-3 py-1.5 rounded-full font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "unassigned"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
            }`}
          >
            <span>Chưa phân công</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {filterCounts.unassigned}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("overdue")}
            className={`px-3 py-1.5 rounded-full font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "overdue"
                ? "bg-rose-600 text-white shadow-sm"
                : "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100"
            }`}
          >
            <span>Quá SLA</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 font-bold">
              {filterCounts.overdue}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("high")}
            className={`px-3 py-1.5 rounded-full font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "high"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100"
            }`}
          >
            <span>Ưu tiên cao</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-bold">
              {filterCounts.high}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("new")}
            className={`px-3 py-1.5 rounded-full font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "new"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
            }`}
          >
            <span>Mới nhận</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {filterCounts.new}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("processing")}
            className={`px-3 py-1.5 rounded-full font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "processing"
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
            }`}
          >
            <span>Đang xử lý</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {filterCounts.processing}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("waiting")}
            className={`px-3 py-1.5 rounded-full font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "waiting"
                ? "bg-slate-700 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
            }`}
          >
            <span>Chờ khách hàng</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {filterCounts.waiting}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("closed")}
            className={`px-3 py-1.5 rounded-full font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "closed"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
            }`}
          >
            <span>Đã đóng</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {filterCounts.closed}
            </span>
          </button>

        </div>

      </div>

{showDateFilter && <fieldset className="flex gap-3 flex-wrap rounded-xl border p-3"><legend>Thời gian cập nhật</legend><label>Từ ngày<input aria-label="Từ ngày" type="date" max={dateTo || undefined} value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></label><label>Đến ngày<input aria-label="Đến ngày" type="date" min={dateFrom || undefined} value={dateTo} onChange={e => setDateTo(e.target.value)} /></label><button onClick={() => { setDateFrom(""); setDateTo(""); }}>Xóa thời gian</button></fieldset>}
      {/* ── 4. MAIN WORKSPACE SPLIT (70% Table Queue / 30% Customer 360) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* ── LEFT COLUMN (70% - 8 Cols): CSKH WORK QUEUE TABLE ── */}
        <div className="xl:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden space-y-0">
          
          <div className="overflow-x-auto min-w-[1050px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 w-10 text-center">
                    <input 
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={pagination.rows.length > 0 && pagination.rows.every(ticket => selectedRowIds.includes(ticket.id))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="py-3 px-4 min-w-[280px]">THÔNG TIN PHIẾU</th>
                  <th className="py-3 px-4 min-w-[170px]">KHÁCH HÀNG & LIÊN QUAN</th>
                  <th className="py-3 px-4 min-w-[140px]">TRẠNG THÁI</th>
                  <th className="py-3 px-4 min-w-[130px]">SLA</th>
                  <th className="py-3 px-4 min-w-[140px]">CẬP NHẬT</th>
                  <th className="py-3 px-4 w-24 text-right">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {pagination.rows.map((ticket) => {
                  const isSelected = selectedTicketId === ticket.id;
                  const isChecked = selectedRowIds.includes(ticket.id);

                  // Priority Border Left Color
                  const borderLeftColor = 
                    ticket.priority === "CRITICAL" ? "border-l-4 border-l-rose-600" :
                    ticket.priority === "HIGH" ? "border-l-4 border-l-rose-500" :
                    ticket.priority === "MEDIUM" ? "border-l-4 border-l-amber-400" :
                    ticket.status === "resolved" ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-teal-400";

                  return (
                    <tr 
                      key={ticket.id}
                      onClick={() => handleRowClick(ticket)}
                      className={`cursor-pointer transition-colors ${borderLeftColor} ${
                        isSelected 
                          ? "bg-blue-50/60 dark:bg-blue-950/20" 
                          : "hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                      }`}
                    >
                      {/* Checkbox Column */}
                      <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleSelectRow(ticket.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      {/* Ticket Info Column */}
                      <td className="py-4 px-4 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-slate-900 dark:text-white text-xs">{ticket.ticketNumber}</span>
                          
                          {/* Priority Pill */}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            ticket.priority === "HIGH" || ticket.priority === "CRITICAL"
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                              : ticket.priority === "MEDIUM"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}>
                            {ticket.priority}
                          </span>
                        </div>

                        <div className="font-bold text-slate-900 dark:text-white text-xs leading-snug">
                          {ticket.subject}
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 max-w-md leading-relaxed">
                          {ticket.description}
                        </div>

                        {/* Category Tags */}
                        <div className="flex items-center gap-1.5 pt-1">
                          {ticket.categoryTags.map((tag, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-semibold">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Customer Column */}
                      <td className="py-4 px-4 space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center text-xs shrink-0">
                            {ticket.customerName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-xs">{ticket.customerName}</div>
                            <div className="text-[11px] text-slate-500 font-medium">{ticket.customerPhone}</div>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-600 dark:text-slate-400 font-medium pt-0.5">
                          <span>{ticket.projectName}</span>
                          <span className="mx-1 font-mono font-bold text-slate-700 dark:text-slate-300">{ticket.unitCode}</span>
                        </div>
                      </td>

                      {/* Status Column with Dots Stepper */}
                      <td className="py-4 px-4 space-y-2">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold border ${ticket.statusColor}`}>
                          {ticket.status === "new" && <Clock className="w-3 h-3" />}
                          {ticket.status === "investigating" && <Search className="w-3 h-3" />}
                          {ticket.status === "processing" && <Play className="w-3 h-3" />}
                          {ticket.status === "resolved" && <CheckCircle2 className="w-3 h-3" />}
                          <span>{ticket.statusLabel}</span>
                        </span>

                        {/* Progress Stepper Dots (4 Dots) */}
                        <div className="flex items-center gap-1 w-24">
                          {[1, 2, 3, 4].map((step) => {
                            const isDone = step <= ticket.progressStep;
                            return (
                              <React.Fragment key={step}>
                                <div className={`w-2 h-2 rounded-full ${
                                  isDone 
                                    ? ticket.status === "resolved" ? "bg-emerald-500" : "bg-blue-600"
                                    : "bg-slate-200 dark:bg-slate-700"
                                }`} />
                                {step < 4 && (
                                  <div className={`flex-1 h-0.5 ${
                                    step < ticket.progressStep 
                                      ? ticket.status === "resolved" ? "bg-emerald-500" : "bg-blue-600"
                                      : "bg-slate-200 dark:bg-slate-700"
                                  }`} />
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </td>

                      {/* SLA Column */}
                      <td className="py-4 px-4 font-medium">
                        {ticket.slaStatus === "overdue" ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Quá hạn</span>
                            </div>
                            <div className="text-[11px] text-rose-600 dark:text-rose-400 font-black">
                              {ticket.slaLabel.replace("Quá hạn ", "")}
                            </div>
                          </div>
                        ) : ticket.slaStatus === "valid" ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Còn hạn</span>
                            </div>
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                              {ticket.slaLabel.replace("Còn hạn ", "")}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">-</span>
                        )}
                      </td>

                      {/* Updated Column */}
                      <td className="py-4 px-4 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                        <div>{ticket.updatedTime}</div>
                        <div>{ticket.updatedDate}</div>
                        <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-bold pt-0.5">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{ticket.ownerName}</span>
                        </div>
                      </td>

                      {/* Action Column */}
                      <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            onClick={() => {
                              setSelectedTicketId(ticket.id);
                              setIsDetailOpen(true);
                            }}
                            className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-xs font-bold rounded-lg transition"
                          >
                            Xem
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedTicketId(ticket.id);
                              setIsDetailOpen(true);
                            }}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 transition cursor-pointer"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Footer (Matching Image 2) */}
          <div className="border-t border-slate-200 dark:border-slate-800"><LandPagination {...pagination} /><PremiumSelect value={supportPageSize} onChange={setSupportPageSize} className="m-3 w-32" options={[{value:'5',label:'5 / trang'},{value:'8',label:'8 / trang'},{value:'10',label:'10 / trang'},{value:'20',label:'20 / trang'},{value:'50',label:'50 / trang'}]} /></div>

        </div>

        {/* ── RIGHT COLUMN (30% - 4 Cols): CUSTOMER 360 & TIMELINE PANEL (Matching Image 2) ── */}
        {currentTicket && (<div className="xl:col-span-4 space-y-5">
          
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-5">
            
            {/* Header: Customer Profile Card */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 font-black text-lg overflow-hidden shrink-0 border border-slate-300 dark:border-slate-600">
                  {currentTicket.customerName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">{currentTicket.customerName}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-[10px] font-bold">
                      Khách hàng
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-medium flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" /> {currentTicket.customerPhone}</span>
                  </div>
                  <div className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                    <Mail className="w-3 h-3 text-slate-400" /> {currentTicket.customerEmail}
                  </div>
                </div>
              </div>

              <button 
                onClick={() => { window.location.href = "/dashboard/real-estate/customers"; }}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <span>Xem chi tiết</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {/* Asset Information Cards (3 Sub Cards matching Image 2) */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5 text-center">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Dự án</div>
                <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 truncate">{currentTicket.projectName}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5 text-center">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Mã căn</div>
                <div className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono mt-0.5">{currentTicket.unitCode}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5 text-center">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Quan hệ</div>
                <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">Chưa xác minh</div>
              </div>
            </div>

            {/* Sub Tabs Navigation */}
            <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 text-xs font-bold pt-1">
              <button 
                onClick={() => setRightPanelTab("timeline")}
                className={`pb-2 transition relative ${
                  rightPanelTab === "timeline"
                    ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Dòng thời gian
              </button>
              <button 
                onClick={() => setRightPanelTab("related")}
                className={`pb-2 transition relative ${
                  rightPanelTab === "related"
                    ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Thông tin liên quan
              </button>
              <button 
                onClick={() => setRightPanelTab("notes")}
                className={`pb-2 transition relative ${
                  rightPanelTab === "notes"
                    ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Ghi chú
              </button>
            </div>

            {/* Vertical Customer 360 Journey Stepper Timeline (Matching Image 2) */}
            {rightPanelTab === "timeline" && <p className="p-4 text-xs text-slate-500">Chưa có lịch sử khách hàng được xác minh.</p>}

            {rightPanelTab === "related" && (
              <div className="py-6 text-center text-xs text-slate-400 italic">
                Danh sách hợp đồng, công nợ và các phiếu dịch vụ liên quan của khách hàng.
              </div>
            )}

            {rightPanelTab === "notes" && (
              <div className="py-6 text-center text-xs text-slate-400 italic">
                Chưa có ghi chú nội bộ bổ sung cho khách hàng này.
              </div>
            )}

            {/* Bottom Link Button */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 text-center">
              <button 
                onClick={() => { window.location.href = "/dashboard/real-estate/customers"; }}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Danh sách khách hàng</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>

        </div>)}

      </div>

      {/* ── 5. MODAL: TIẾP NHẬN PHẢN ÁNH (NEW TICKET MODAL) ── */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative"
            >
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="absolute right-4 top-4 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>

              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <LifeBuoy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Tiếp Nhận Phản Ánh & Khiếu Nại</h3>
                  <p className="text-xs text-slate-500">Tạo phiếu yêu cầu hỗ trợ mới cho khách hàng bất động sản</p>
                </div>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                
                {/* Select Customer */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Khách Hàng *</label>
                  <PremiumSelect
                    options={[
                      { value: "Lê Văn C", label: "Lê Văn C (Grand Tower - CH-1204)" },
                      { value: "Phạm Thị D", label: "Phạm Thị D (Central Residence - CH-0901)" },
                      { value: "Nguyễn Văn H", label: "Nguyễn Văn H (Riverside City - CH-2103)" }
                    ]}
                    value={newCustomerName}
                    onChange={setNewCustomerName}
                    placeholder="Chọn khách hàng..."
                    buttonClassName="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:border-amber-500 active:scale-100"
                  />
                </div>

                {/* Priority & Category Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300">Mức Độ Mức Ưu Tiên *</label>
                    <PremiumSelect
                      options={[
                        { value: "CRITICAL", label: "⚡ CRITICAL - Khẩn cấp" },
                        { value: "HIGH", label: "🔴 HIGH - Cao" },
                        { value: "MEDIUM", label: "🟡 MEDIUM - Trung bình" },
                        { value: "LOW", label: "🟢 LOW - Thấp" }
                      ]}
                      value={newPriority}
                      onChange={val => setNewPriority(val as TicketPriority)}
                      placeholder="Chọn mức ưu tiên..."
                      buttonClassName="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:border-amber-500 active:scale-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300">Phân Loại *</label>
                    <PremiumSelect
                      options={[
                        { value: "SERVICE_QUALITY", label: "Chất lượng dịch vụ / Hồ sơ" },
                        { value: "BILLING", label: "Thanh toán & Lãi suất" },
                        { value: "TECHNICAL", label: "Kỹ thuật / Bảo hành" },
                        { value: "GENERAL", label: "Vận hành & Nội quy" }
                      ]}
                      value={newCategory}
                      onChange={val => setNewCategory(val as TicketCategory)}
                      placeholder="Chọn phân loại..."
                      buttonClassName="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:border-amber-500 active:scale-100"
                    />
                  </div>
                </div>

                {/* Subject */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Tiêu Đề Phản Ánh *</label>
                  <input 
                    type="text"
                    value={newSubject}
                    onChange={e => setNewSubject(e.target.value)}
                    placeholder="VD: Trễ hạn nộp hồ sơ xin cấp sổ hồng căn CH001"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Chi Tiết Phản Ánh / Yêu Cầu *</label>
                  <textarea 
                    rows={3}
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="Mô tả chi tiết nội dung khiếu nại của khách hàng..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500 resize-none"
                  />
                </div>

                {/* Modal Buttons */}
                <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button 
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-50 transition"
                  >
                    Hủy bỏ
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-slate-950 font-black rounded-xl shadow-sm transition"
                  >
                    Tạo Yêu Cầu
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 6. MODAL / DRAWER: CHI TIẾT PHIẾU PHẢN ÁNH ── */}
      <AnimatePresence>
        {isDetailOpen && currentTicket && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative"
            >
              <button 
                onClick={() => setIsDetailOpen(false)}
                className="absolute right-4 top-4 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>

              <div className="space-y-2 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-sm">{currentTicket.ticketNumber}</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-bold">
                    {currentTicket.priority}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${currentTicket.statusColor}`}>
                    {currentTicket.statusLabel}
                  </span>
                </div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white leading-snug">
                  {currentTicket.subject}
                </h2>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <div className="font-bold text-slate-400 uppercase text-[10px] mb-1">Nội dung phản ánh</div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 leading-relaxed">
                    {currentTicket.description}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Khách hàng</div>
                    <div className="font-bold text-slate-900 dark:text-white">{currentTicket.customerName}</div>
                    <div className="text-slate-500">{currentTicket.customerPhone}</div>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Dự án / Mã căn</div>
                    <div className="font-bold text-slate-900 dark:text-white">{currentTicket.projectName}</div>
                    <div className="font-mono text-blue-600 font-bold">{currentTicket.unitCode}</div>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Người phụ trách</div>
                    <div className="font-bold text-slate-900 dark:text-white">{currentTicket.ownerName}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Thời gian cập nhật</div>
                    <div className="font-medium text-slate-600 dark:text-slate-300">{currentTicket.updatedTime} - {currentTicket.updatedDate}</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button 
                  onClick={() => setIsDetailOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-200 transition"
                >
                  Đóng
                </button>
                <button 
                  onClick={() => {
                    unavailableLandAction("Thao tác lưu hoặc gửi dữ liệu");
                    setIsDetailOpen(false);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition"
                >
                  Cập nhật tiến độ
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
