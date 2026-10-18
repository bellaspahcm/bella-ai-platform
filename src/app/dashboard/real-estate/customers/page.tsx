"use client";
import { LandPreviewNotice, unavailableLandAction, LandPagination, useLandPagination, matchesBudgetRange } from "@/modules/real_estate/components/LandUiControls";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Phone, Mail, MessageSquare, Building2,
  Search, Plus, ChevronRight,
  TrendingUp, Clock, CheckCircle2,
  XCircle, Target, Handshake,
  Star, SlidersHorizontal, ArrowUpDown,
  LayoutList, LayoutGrid, Globe, MessageCircle, Share2, Tag, PhoneCall,
  X, Filter, ExternalLink, Calendar, RefreshCw, Send
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { PremiumSelect } from "@/components/ui/PremiumSelect";

export interface CustomerItem {
  id: string;
  code: string;
  avatarInitials: string;
  avatarBg: string;
  fullName: string;
  phone: string;
  email: string;
  city: string;
  project: string;
  source: string;
  sourceLabel: string;
  sourceType: 'facebook' | 'zalo' | 'google' | 'referral' | 'tiktok' | 'email' | 'event' | 'website';
  demandSummary: string;
  budgetLabel: string;
  status: 'lead' | 'contacted' | 'negotiating' | 'in_progress' | 'closed_won' | 'closed_lost';
  statusLabel: string;
  statusColor: string;
  salesOwnerId: string;
  salesOwnerName: string;
  salesAvatar: string;
  lastUpdatedText: string;
  interactionCount: number;
  // Investor 360 attributes
  investorProfile: {
    investorType: string; // 'Nhà đầu tư cá nhân' | 'Quỹ đầu tư' | 'Khách ở thực'
    budgetRange: string;
    propertyTypes: string[];
    bedroomCount: string;
    investmentGoal: string; // 'Tích sản' | 'Lướt sóng' | 'Cho thuê' | 'Ở thực'
    targetLocations: string[];
    views: string[];
    floorPreference: string;
    notes: string;
    interestedUnits: { code: string; price: string; view: string; status: string }[];
    transactionsCount: { holding: number; deposited: number; contracted: number };
  };
  timeline: { time: string; date: string; title: string; description: string; type: string }[];
}

type CustomerDrawerTab = 'overview' | 'demand' | 'shortlist' | 'transactions' | 'history';

const CUSTOMER_DATA: CustomerItem[] = [
  {
    id: 'c-001',
    code: 'KH-001284',
    avatarInitials: 'LC',
    avatarBg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
    fullName: 'Lê Văn Chánh',
    phone: '0901 234 567',
    email: 'le.chanh@gmail.com',
    city: 'TP. Hồ Chí Minh',
    project: 'Elyse Island',
    source: 'facebook',
    sourceLabel: 'Facebook Ads',
    sourceType: 'facebook',
    demandSummary: 'Căn hộ, view sông / Tầng cao, đầu tư',
    budgetLabel: '3.0 – 5.0 tỷ',
    status: 'negotiating',
    statusLabel: 'Đang đàm phán',
    statusColor: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    salesOwnerId: 's-001',
    salesOwnerName: 'Trần Minh Tuấn',
    salesAvatar: 'TM',
    lastUpdatedText: '1 tháng trước',
    interactionCount: 4,
    investorProfile: {
      investorType: 'Nhà đầu tư lâu năm',
      budgetRange: '3.0 – 5.0 tỷ',
      propertyTypes: ['Căn hộ cao cấp', 'Shophouse Marina'],
      bedroomCount: '2 – 3 PN',
      investmentGoal: 'Cho thuê & Tích sản lâu dài',
      targetLocations: ['Phú Quốc', 'Elyse Island'],
      views: ['Hướng sông', 'View Biển'],
      floorPreference: 'Tầng cao (15+)',
      notes: 'Ưu tiên căn view sông, tầng cao. Sẵn sàng đặt cọc nếu giá hợp lý.',
      interestedUnits: [
        { code: 'A1-1804', price: '4.28 tỷ', view: 'Sông & Marina', status: 'Khả dụng' },
        { code: 'A1-2108', price: '4.55 tỷ', view: 'Toàn cảnh Biển', status: 'Khả dụng' }
      ],
      transactionsCount: { holding: 1, deposited: 0, contracted: 0 }
    },
    timeline: [
      { time: '14:30', date: '10/08/2026', title: 'Họp đàm phán chiết khấu', description: 'Đã gặp trực tiếp tại Showroom Elyse Island.', type: 'meeting' },
      { time: '09:15', date: '25/07/2026', title: 'Gửi bảng tính dòng tiền cho thuê', description: 'Gửi qua Zalo tài liệu ROI 12%/năm.', type: 'zalo' },
      { time: '16:00', date: '15/07/2026', title: 'Tư vấn danh mục căn view sông', description: 'Khách chọn shortlist 2 căn A1-1804 & A1-2108.', type: 'call' }
    ]
  },
  {
    id: 'c-002',
    code: 'KH-001285',
    avatarInitials: 'PD',
    avatarBg: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300',
    fullName: 'Phạm Thị Diễm',
    phone: '0912 345 678',
    email: 'phamthidiem@hotmail.com',
    city: 'Hà Nội',
    project: 'Elyse Island',
    source: 'zalo',
    sourceLabel: 'Zalo OA',
    sourceType: 'zalo',
    demandSummary: 'Căn hộ 2PN / Ở thực',
    budgetLabel: '5.0 – 10.0 tỷ',
    status: 'contacted',
    statusLabel: 'Đã liên hệ',
    statusColor: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
    salesOwnerId: 's-002',
    salesOwnerName: 'Lê Thị Hoa',
    salesAvatar: 'LH',
    lastUpdatedText: '1 tháng trước',
    interactionCount: 2,
    investorProfile: {
      investorType: 'Khách mua ở thực',
      budgetRange: '5.0 – 10.0 tỷ',
      propertyTypes: ['Căn hộ 2PN', 'Biệt thự đơn lập'],
      bedroomCount: '2 PN',
      investmentGoal: 'Nghỉ dưỡng gia đình',
      targetLocations: ['Phú Quốc'],
      views: ['Nội khu vườn cảnh quan'],
      floorPreference: 'Tầng trung (6-12)',
      notes: 'Cần căn yên tĩnh, gần hồ bơi và khu vui chơi trẻ em.',
      interestedUnits: [
        { code: 'B2-0805', price: '6.20 tỷ', view: 'Vườn nhiệt đới', status: 'Khả dụng' }
      ],
      transactionsCount: { holding: 0, deposited: 0, contracted: 0 }
    },
    timeline: [
      { time: '11:00', date: '25/07/2026', title: 'Cuộc gọi tư vấn dự án', description: 'Tư vấn tiện ích dành cho gia đình.', type: 'call' }
    ]
  },
  {
    id: 'c-003',
    code: 'KH-001286',
    avatarInitials: 'HĐ',
    avatarBg: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    fullName: 'Hoàng Minh Đức',
    phone: '0933 111 222',
    email: 'hmduc@company.vn',
    city: 'Đà Nẵng',
    project: 'Sunrise Residence',
    source: 'google',
    sourceLabel: 'Google Ads',
    sourceType: 'google',
    demandSummary: 'Biệt thự nghỉ dưỡng / Đầu tư dài hạn',
    budgetLabel: '10.0 – 20.0 tỷ',
    status: 'lead',
    statusLabel: 'Lead mới',
    statusColor: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    salesOwnerId: 's-003',
    salesOwnerName: 'Nguyễn Thị Mai',
    salesAvatar: 'NM',
    lastUpdatedText: '2 giờ trước',
    interactionCount: 1,
    investorProfile: {
      investorType: 'Nhà đầu tư tổ chức',
      budgetRange: '10.0 – 20.0 tỷ',
      propertyTypes: ['Biệt thự biển', 'Penthouse'],
      bedroomCount: '3 – 4 PN',
      investmentGoal: 'Đầu tư dài hạn 5+ năm',
      targetLocations: ['Sunrise Residence'],
      views: ['Trực diện biển'],
      floorPreference: 'Biệt thự mặt biển',
      notes: 'Quan tâm chính sách bảo chứng dòng tiền thuê từ Vận hành 5 sao.',
      interestedUnits: [
        { code: 'V-02', price: '18.5 tỷ', view: 'Mặt biển direct', status: 'Giữ chỗ' }
      ],
      transactionsCount: { holding: 0, deposited: 0, contracted: 0 }
    },
    timeline: [
      { time: '08:30', date: '10/09/2026', title: 'Hệ thống tiếp nhận Lead từ Google Ads', description: 'Đăng ký thông tin nhận e-Brochure.', type: 'system' }
    ]
  },
  {
    id: 'c-004',
    code: 'KH-001287',
    avatarInitials: 'NT',
    avatarBg: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300',
    fullName: 'Ngô Thị Hạnh',
    phone: '0967 123 456',
    email: 'hanh.nt@gmail.com',
    city: 'TP. Hồ Chí Minh',
    project: 'Lumière Bay',
    source: 'tiktok',
    sourceLabel: 'TikTok Ads',
    sourceType: 'tiktok',
    demandSummary: 'Căn hộ 1PN / Cho thuê',
    budgetLabel: '2.0 – 3.0 tỷ',
    status: 'in_progress',
    statusLabel: 'Đang chăm sóc',
    statusColor: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
    salesOwnerId: 's-001',
    salesOwnerName: 'Trần Minh Tuấn',
    salesAvatar: 'TM',
    lastUpdatedText: '5 giờ trước',
    interactionCount: 3,
    investorProfile: {
      investorType: 'Nhà đầu tư cá nhân mới',
      budgetRange: '2.0 – 3.0 tỷ',
      propertyTypes: ['Căn hộ 1PN', 'Studio'],
      bedroomCount: '1 PN',
      investmentGoal: 'Cho thuê homestay / Airbnb',
      targetLocations: ['Lumière Bay'],
      views: ['Hồ bơi vô cực'],
      floorPreference: 'Tầng trung',
      notes: 'Cần hỗ trợ gói vay ngân hàng 0% lãi suất trong 24 tháng.',
      interestedUnits: [
        { code: 'LB-1209', price: '2.45 tỷ', view: 'Hồ bơi', status: 'Khả dụng' }
      ],
      transactionsCount: { holding: 0, deposited: 0, contracted: 0 }
    },
    timeline: [
      { time: '10:00', date: '09/09/2026', title: 'Gửi bảng tính lịch thanh toán vay', description: 'Đã gửi file Excel chi tiết tiến độ.', type: 'email' }
    ]
  },
  {
    id: 'c-005',
    code: 'KH-001288',
    avatarInitials: 'ĐTT',
    avatarBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
    fullName: 'Đỗ Minh Tuấn',
    phone: '0909 988 776',
    email: 'tuan.dm@gmail.com',
    city: 'Hà Nội',
    project: 'Bella Premium',
    source: 'referral',
    sourceLabel: 'Giới thiệu',
    sourceType: 'referral',
    demandSummary: 'Căn hộ 3PN / View biển',
    budgetLabel: '7.0 – 12.0 tỷ',
    status: 'closed_won',
    statusLabel: 'Đã mua',
    statusColor: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    salesOwnerId: 's-002',
    salesOwnerName: 'Lê Thị Hoa',
    salesAvatar: 'LH',
    lastUpdatedText: '3 ngày trước',
    interactionCount: 12,
    investorProfile: {
      investorType: 'VIP Investor (Đã sở hữu 2 căn)',
      budgetRange: '7.0 – 12.0 tỷ',
      propertyTypes: ['Căn 3PN gia đình', 'Shophouse phố biển'],
      bedroomCount: '3 PN',
      investmentGoal: 'Tích sản & Nghỉ dưỡng',
      targetLocations: ['Bella Premium'],
      views: ['Direct Seaview'],
      floorPreference: 'Tầng cao (20+)',
      notes: 'Khách hàng thân thiết. Đã ký Hợp đồng mua bán căn BP-1208.',
      interestedUnits: [
        { code: 'BP-1208', price: '7.65 tỷ', view: 'Panorama biển', status: 'Đã ký HĐMB' }
      ],
      transactionsCount: { holding: 0, deposited: 0, contracted: 1 }
    },
    timeline: [
      { time: '15:30', date: '06/09/2026', title: 'Hoàn tất ký kết HĐMB', description: 'Đã chuyển tiền cọc đợt 1 và nhận hợp đồng.', type: 'contract' }
    ]
  },
  {
    id: 'c-006',
    code: 'KH-001289',
    avatarInitials: 'BT',
    avatarBg: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
    fullName: 'Bùi Thị Mai',
    phone: '0933 666 888',
    email: 'mai.bt@gmail.com',
    city: 'Hải Phòng',
    project: 'Elyse Island',
    source: 'email',
    sourceLabel: 'Email Marketing',
    sourceType: 'email',
    demandSummary: 'Căn hộ 2PN / Ở thực',
    budgetLabel: '4.0 – 6.0 tỷ',
    status: 'closed_lost',
    statusLabel: 'Không tiếp tục',
    statusColor: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
    salesOwnerId: 's-004',
    salesOwnerName: 'Nguyễn Văn An',
    salesAvatar: 'NA',
    lastUpdatedText: '5 ngày trước',
    interactionCount: 6,
    investorProfile: {
      investorType: 'Khách tham khảo',
      budgetRange: '4.0 – 6.0 tỷ',
      propertyTypes: ['Căn 2PN'],
      bedroomCount: '2 PN',
      investmentGoal: 'Ở thực',
      targetLocations: ['Elyse Island'],
      views: ['Nội khu'],
      floorPreference: 'Tầng thấp',
      notes: 'Đã chọn mua dự án đối thủ cạnh tranh do thời gian bàn giao sớm hơn.',
      interestedUnits: [],
      transactionsCount: { holding: 0, deposited: 0, contracted: 0 }
    },
    timeline: [
      { time: '11:20', date: '04/09/2026', title: 'Khách xác nhận dừng tìm hiểu', description: 'Lý do: Đã chốt mua dự án khác.', type: 'system' }
    ]
  },
  {
    id: 'c-007',
    code: 'KH-001290',
    avatarInitials: 'TN',
    avatarBg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    fullName: 'Trần Nam',
    phone: '0987 654 321',
    email: 'nam.tran@gmail.com',
    city: 'TP. Hồ Chí Minh',
    project: 'Sunrise Residence',
    source: 'event',
    sourceLabel: 'Sự kiện',
    sourceType: 'event',
    demandSummary: 'Biệt thự / Đầu tư',
    budgetLabel: '15.0 – 25.0 tỷ',
    status: 'negotiating',
    statusLabel: 'Đang đàm phán',
    statusColor: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    salesOwnerId: 's-001',
    salesOwnerName: 'Trần Minh Tuấn',
    salesAvatar: 'TM',
    lastUpdatedText: '1 ngày trước',
    interactionCount: 5,
    investorProfile: {
      investorType: 'VIP Investor (Quản lý quỹ cá nhân)',
      budgetRange: '15.0 – 25.0 tỷ',
      propertyTypes: ['Biệt thự đơn lập', 'Dinh thự đảo'],
      bedroomCount: '4 PN+',
      investmentGoal: 'Tích sản dòng họ',
      targetLocations: ['Sunrise Residence'],
      views: ['Biển Panorama'],
      floorPreference: 'Mặt sông / Biển',
      notes: 'Muốn đàm phán phương thức thanh toán giãn 36 tháng.',
      interestedUnits: [
        { code: 'SR-V01', price: '22.8 tỷ', view: 'Mặt hồ & Biển', status: 'Khả dụng' }
      ],
      transactionsCount: { holding: 1, deposited: 0, contracted: 0 }
    },
    timeline: [
      { time: '17:00', date: '08/09/2026', title: 'Gửi đề xuất thanh toán đặc quyền', description: 'Trình Chủ đầu tư duyệt lịch thanh toán 36 tháng.', type: 'meeting' }
    ]
  },
  {
    id: 'c-008',
    code: 'KH-001291',
    avatarInitials: 'PT',
    avatarBg: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
    fullName: 'Phan Thuận',
    phone: '0918 222 333',
    email: 'thuan.pt@gmail.com',
    city: 'Cần Thơ',
    project: 'Elyse Island',
    source: 'website',
    sourceLabel: 'Website',
    sourceType: 'website',
    demandSummary: 'Căn hộ 2–3PN / View sông',
    budgetLabel: '5.0 – 9.0 tỷ',
    status: 'in_progress',
    statusLabel: 'Đang chăm sóc',
    statusColor: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
    salesOwnerId: 's-003',
    salesOwnerName: 'Nguyễn Thị Mai',
    salesAvatar: 'NM',
    lastUpdatedText: '4 giờ trước',
    interactionCount: 2,
    investorProfile: {
      investorType: 'Nhà đầu tư cá nhân',
      budgetRange: '5.0 – 9.0 tỷ',
      propertyTypes: ['Căn 2PN+', 'Duplex'],
      bedroomCount: '2 – 3 PN',
      investmentGoal: 'Tích sản & Nghỉ dưỡng',
      targetLocations: ['Elyse Island'],
      views: ['Sông & Bến du thuyền'],
      floorPreference: 'Tầng cao (18+)',
      notes: 'Đang cân nhắc giữa căn Duplex 3PN và căn góc 2PN view sông.',
      interestedUnits: [
        { code: 'A1-18B', price: '5.60 tỷ', view: 'View Sông góc', status: 'Khả dụng' }
      ],
      transactionsCount: { holding: 0, deposited: 0, contracted: 0 }
    },
    timeline: [
      { time: '14:00', date: '09/09/2026', title: 'Tư vấn thiết kế mặt bằng Duplex', description: 'Gửi 3D Walkthrough mặt bằng căn góc.', type: 'zalo' }
    ]
  }
];

export default function RealEstateCustomersPage() {
  const [customers, setCustomers] = useState<CustomerItem[]>(CUSTOMER_DATA);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>('c-001');
  const [activeTabFilter, setActiveTabFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  
  // Secondary Dropdowns
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterDemand, setFilterDemand] = useState<string>('all');
  const [filterBudget, setFilterBudget] = useState<string>('all');
  const [filterSales, setFilterSales] = useState<string>('all');
  const [sortAscending, setSortAscending] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Modals & Drawer State
  const [drawerTab, setDrawerTab] = useState<CustomerDrawerTab>('demand');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [newInteractionNote, setNewInteractionNote] = useState('');
  const [headerProject, setHeaderProject] = useState<string>('all');
  const [modalProject, setModalProject] = useState<string>('Elyse Island');
  const [modalReassignSales, setModalReassignSales] = useState<string>('Lê Thị Hoa (PKD 2)');
  const [pageSize, setPageSize] = useState<string>('8');



  // Operational Customer Intelligence Stats (Exact matching Image 2 Header KPIs)
  const stats = useMemo(() => {
    return {
      total: 1284,
      active: 326,
      demandCount: 186,
      inTransaction: 84,
      closedWon: 742,
      pipelineValue: '312 tỷ',
      closedLost: 46
    };
  }, []);

  // Filtered List
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      // Primary Tab Filter
      if (activeTabFilter === 'active' && c.status !== 'contacted' && c.status !== 'in_progress' && c.status !== 'negotiating') return false;
      if (activeTabFilter === 'in_progress' && c.status !== 'in_progress' && c.status !== 'contacted') return false;
      if (activeTabFilter === 'negotiating' && c.status !== 'negotiating') return false;
      if (activeTabFilter === 'closed_won' && c.status !== 'closed_won') return false;
      if (activeTabFilter === 'closed_lost' && c.status !== 'closed_lost') return false;

      // Dropdown filters
      if (filterDemand !== 'all' && !c.investorProfile.propertyTypes.some(type => type.toLowerCase().includes(({ apartment: 'căn hộ', villa: 'biệt thự', shophouse: 'shophouse' }[filterDemand] || filterDemand).toLowerCase()))) return false;
      if (!matchesBudgetRange(c.budgetLabel, filterBudget)) return false;
      if (filterProject !== 'all' && c.project !== filterProject) return false;
      if (filterSource !== 'all' && c.source !== filterSource) return false;
      if (filterSales !== 'all' && c.salesOwnerName !== filterSales) return false;

      // Search query
      if (search) {
        const q = search.toLowerCase();
        const mName = c.fullName.toLowerCase().includes(q);
        const mPhone = c.phone.includes(q);
        const mEmail = c.email.toLowerCase().includes(q);
        const mCode = c.code.toLowerCase().includes(q);
        const mProj = c.project.toLowerCase().includes(q);
        if (!mName && !mPhone && !mEmail && !mCode && !mProj) return false;
      }
      return true;
    }).sort((a, b) => (sortAscending ? 1 : -1) * a.fullName.localeCompare(b.fullName, "vi"));
  }, [sortAscending, customers, activeTabFilter, filterProject, filterSource, filterDemand, filterBudget, filterSales, search]);
  const pagination = useLandPagination(filteredCustomers, Number(pageSize));
  const selectedCustomer = pagination.rows.find(c => c.id === selectedCustomerId) || null;

  const handleAddInteraction = () => { unavailableLandAction("Lưu dữ liệu nghiệp vụ"); };

  const drawerTabs: Array<{ id: CustomerDrawerTab; label: string }> = [
    { id: 'demand', label: 'Thông tin' },
    { id: 'shortlist', label: 'Căn quan tâm' },
    { id: 'history', label: 'Lịch sử' },
    { id: 'transactions', label: 'Giao dịch' },
  ];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto font-sans text-slate-900 dark:text-slate-100 pb-12">
      <LandPreviewNotice />
      {/* ── 1. Page Header (Matching Image 2 Title & Actions) ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
            <span>Bella Land</span>
            <span>/</span>
            <span>Kinh doanh</span>
            <span>/</span>
            <span className="text-slate-700 dark:text-slate-200 font-bold">Khách hàng & Nhà đầu tư</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            Khách hàng & Nhà đầu tư
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Quản lý khách hàng, nhà đầu tư và hành trình từ nhu cầu đến giao dịch
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <PremiumSelect
            value={filterProject}
            onChange={setFilterProject}
            className="w-44"
            options={[{ value: "all", label: "Tất cả dự án" },
              { value: "Elyse Island", label: "Elyse Island" },
              { value: "Sunrise Residence", label: "Sunrise Residence" },
              { value: "Lumière Bay", label: "Lumière Bay" },
            ]}
          />

          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              placeholder="Tìm tên, SĐT, email, dự án..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none shadow-xs"
            />
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Thêm khách hàng
          </button>
        </div>
      </div>

      {/* ── 2. Top Operational KPI Cards (6 Cards Matching Image 2) ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Card 1: Tổng khách hàng */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Tổng khách hàng</span>
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black">
              ↑ 12%
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white">{stats.total.toLocaleString()}</span>
            <div className="flex items-end gap-1 h-5">
              {[40, 65, 50, 85, 70, 95, 100].map((h, i) => (
                <div key={i} className="w-1 bg-emerald-500 rounded-xs" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: Đang Active */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-rose-600 uppercase tracking-wider text-[10px]">Đang active</span>
            <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black">
              ↑ 8%
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-2xl lg:text-3xl font-black text-rose-600">{stats.active}</span>
            <Target className="w-6 h-6 text-rose-500 opacity-60" />
          </div>
        </div>

        {/* Card 3: Có nhu cầu mua */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-amber-600 uppercase tracking-wider text-[10px]">Có nhu cầu mua</span>
            <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black">
              ↑ 15%
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-2xl lg:text-3xl font-black text-amber-600">{stats.demandCount}</span>
            <Building2 className="w-6 h-6 text-amber-500 opacity-60" />
          </div>
        </div>

        {/* Card 4: Đang có giao dịch */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-blue-600 uppercase tracking-wider text-[10px]">Đang có giao dịch</span>
            <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black">
              ↑ 6%
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-2xl lg:text-3xl font-black text-blue-600">{stats.inTransaction}</span>
            <Handshake className="w-6 h-6 text-blue-500 opacity-60" />
          </div>
        </div>

        {/* Card 5: Đã mua */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-emerald-600 uppercase tracking-wider text-[10px]">Đã mua</span>
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black">
              ↑ 20%
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-2xl lg:text-3xl font-black text-emerald-600">{stats.closedWon}</span>
            <CheckCircle2 className="w-6 h-6 text-emerald-500 opacity-60" />
          </div>
        </div>

        {/* Card 6: Giá trị pipeline */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-amber-600 uppercase tracking-wider text-[10px]">Giá trị pipeline</span>
            <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black">
              ↑ 18%
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-2xl lg:text-3xl font-black text-amber-600">{stats.pipelineValue}</span>
            <Star className="w-6 h-6 text-amber-500 opacity-60" />
          </div>
        </div>
      </div>

      {/* ── 3. Pipeline Filter Tabs & Secondary Controls (Matching Image 2) ── */}
      <div className="space-y-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: `Tất cả (${stats.total.toLocaleString()})` },
            { id: 'active', label: `Khách tiềm năng (${stats.active})` },
            { id: 'in_progress', label: `Đang chăm sóc (${stats.demandCount})` },
            { id: 'negotiating', label: `Đang đàm phán (${stats.inTransaction})` },
            { id: 'closed_won', label: `Đã mua (${stats.closedWon})` },
            { id: 'closed_lost', label: `Không tiếp tục (${stats.closedLost})` },
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
        </div>

        {/* Secondary Dropdowns Toolbar */}
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
              value={filterSource}
              onChange={setFilterSource}
              placeholder="Nguồn: Tất cả"
              className="w-40"
              options={[
                { value: "all", label: "Nguồn: Tất cả" },
                { value: "facebook", label: "Facebook Ads" },
                { value: "zalo", label: "Zalo OA" },
                { value: "google", label: "Google Ads" },
                { value: "referral", label: "Giới thiệu" },
                { value: "tiktok", label: "TikTok Ads" },
                { value: "email", label: "Email Marketing" },
                { value: "event", label: "Sự kiện" },
                { value: "website", label: "Website" },
              ]}
            />

            <PremiumSelect
              value={filterDemand}
              onChange={setFilterDemand}
              placeholder="Nhu cầu: Tất cả"
              className="w-40"
              options={[
                { value: "all", label: "Nhu cầu: Tất cả" },
                { value: "apartment", label: "Căn hộ" },
                { value: "villa", label: "Biệt thự" },
                { value: "shophouse", label: "Shophouse" },
              ]}
            />

            <PremiumSelect
              value={filterBudget}
              onChange={setFilterBudget}
              placeholder="Ngân sách: Tất cả"
              className="w-44"
              options={[
                { value: "all", label: "Ngân sách: Tất cả" },
                { value: "3-5", label: "3 – 5 tỷ" },
                { value: "5-10", label: "5 – 10 tỷ" },
                { value: "10-20", label: "10 – 20 tỷ" },
              ]}
            />

            <PremiumSelect
              value={filterSales}
              onChange={setFilterSales}
              placeholder="Sales: Tất cả"
              className="w-44"
              options={[
                { value: "all", label: "Sales: Tất cả" },
                { value: "Trần Minh Tuấn", label: "Trần Minh Tuấn" },
                { value: "Lê Thị Hoa", label: "Lê Thị Hoa" },
                { value: "Nguyễn Thị Mai", label: "Nguyễn Thị Mai" },
                { value: "Nguyễn Văn An", label: "Nguyễn Văn An" },
              ]}
            />

            <button title="Xóa bộ lọc" onClick={() => { setSearch(""); setFilterProject("all"); setFilterSource("all"); setFilterDemand("all"); setFilterBudget("all"); setFilterSales("all"); setActiveTabFilter("all"); }} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Bộ lọc ▾
            </button>

            <button aria-label="Đảo thứ tự tên khách hàng" onClick={() => setSortAscending(value => !value)} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5" /> Sắp xếp ▾
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              aria-label="Danh sách khách hàng" aria-pressed={viewMode === 'table'} onClick={() => setViewMode('table')}
              className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
              }`}
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              aria-label="Lưới khách hàng" aria-pressed={viewMode === 'grid'} onClick={() => setViewMode('grid')}
              className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── 4. Main Body: Customer Table & Investor 360 Workspace Drawer (Matching Image 2) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left Column (Customer Work Queue Table) */}
        <div className={`${selectedCustomer ? 'lg:col-span-8' : 'lg:col-span-12'} bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs transition-all`}>
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
            {viewMode === 'grid' ? <div role="region" aria-label="Lưới khách hàng" className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">{pagination.rows.map(customer => <button key={customer.id} onClick={() => setSelectedCustomerId(customer.id)} className="rounded-xl border p-4 text-left"><strong>{customer.fullName}</strong><p>{customer.phone}</p><p>{customer.project}</p><p>{customer.budgetLabel}</p></button>)}{pagination.rows.length === 0 && <p>Không có khách hàng phù hợp.</p>}</div> : (<table className="w-full text-left text-xs border-collapse min-w-[1050px]">
              <thead className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="p-3.5 w-10 text-center whitespace-nowrap">
                    <span>Chọn</span>
                  </th>
                  <th className="p-3.5 whitespace-nowrap">Khách hàng</th>
                  <th className="p-3.5 whitespace-nowrap">Dự án / Nguồn</th>
                  <th className="p-3.5 whitespace-nowrap">Nhu cầu</th>
                  <th className="p-3.5 whitespace-nowrap">Ngân sách</th>
                  <th className="p-3.5 whitespace-nowrap">Trạng thái</th>
                  <th className="p-3.5 whitespace-nowrap">Sales phụ trách</th>
                  <th className="p-3.5 whitespace-nowrap">Cập nhật</th>
                  <th className="p-3.5 text-right whitespace-nowrap">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400 font-semibold whitespace-nowrap">
                      Không tìm thấy khách hàng nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  pagination.rows.map(customer => {
                    const isSelected = selectedCustomerId === customer.id;

                    return (
                      <tr
                        key={customer.id}
                        onClick={() => setSelectedCustomerId(customer.id)}
                        className={`transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/70 dark:bg-blue-950/40 font-semibold'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <td className="p-3.5 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <input
                            type="radio" name="customers-selection" aria-label="Chọn hàng"
                            checked={isSelected}
                            onChange={() => setSelectedCustomerId(customer.id)}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                        </td>

                        {/* Customer Info */}
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2.5 whitespace-nowrap">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${customer.avatarBg}`}>
                              {customer.avatarInitials}
                            </div>
                            <div className="whitespace-nowrap">
                              <p className="font-extrabold text-slate-900 dark:text-white text-xs whitespace-nowrap">{customer.fullName}</p>
                              <p className="text-[11px] text-slate-500 font-medium whitespace-nowrap mt-0.5">
                                {customer.phone} <span className="text-slate-300 dark:text-slate-600">·</span> {customer.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Project & Source */}
                        <td className="p-3.5 whitespace-nowrap">
                          <p className="font-bold text-slate-800 dark:text-slate-200 text-xs whitespace-nowrap">{customer.project}</p>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-0.5 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md whitespace-nowrap">
                            <Globe className="w-2.5 h-2.5 text-blue-500" /> {customer.sourceLabel}
                          </span>
                        </td>

                        {/* Demand */}
                        <td className="p-3.5 whitespace-nowrap">
                          <p className="font-bold text-slate-800 dark:text-slate-200 text-xs whitespace-nowrap">{customer.demandSummary.split('/')[0]}</p>
                          <p className="text-[10px] text-slate-400 font-semibold whitespace-nowrap">{customer.demandSummary.split('/')[1] || customer.demandSummary}</p>
                        </td>

                        {/* Budget */}
                        <td className="p-3.5 whitespace-nowrap">
                          <span className="font-extrabold text-slate-900 dark:text-white text-xs whitespace-nowrap">
                            {customer.budgetLabel}
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="p-3.5 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border inline-block whitespace-nowrap ${customer.statusColor}`}>
                            ● {customer.statusLabel}
                          </span>
                        </td>

                        {/* Sales Owner */}
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-extrabold text-[9px] text-slate-700 dark:text-slate-200 shrink-0">
                              {customer.salesAvatar}
                            </div>
                            <span className="font-bold text-slate-800 dark:text-slate-200 text-xs whitespace-nowrap">
                              {customer.salesOwnerName}
                            </span>
                          </div>
                        </td>

                        {/* Updated time & interactions */}
                        <td className="p-3.5 whitespace-nowrap">
                          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{customer.lastUpdatedText}</p>
                          <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{customer.interactionCount} tương tác</p>
                        </td>

                        {/* Action Dots */}
                        <td className="p-3.5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedCustomerId(customer.id)}
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
            </table>)}
          </div>

          {/* Pagination Footer (Matching Image 2) */}
          <div className="border-t border-slate-200 dark:border-slate-800"><LandPagination {...pagination} /><PremiumSelect value={pageSize} onChange={setPageSize} className="m-3 w-32" options={[{value:'5',label:'5 / trang'},{value:'8',label:'8 / trang'},{value:'10',label:'10 / trang'},{value:'20',label:'20 / trang'},{value:'50',label:'50 / trang'}]} /></div>
        </div>

        {/* Right Column: Investor 360 Workspace Drawer (Matching Image 2 Right Drawer Panel) */}
        {selectedCustomer && (
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-md space-y-5 sticky top-6">
            {/* Drawer Header */}
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    {selectedCustomer.fullName}
                  </h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${selectedCustomer.statusColor}`}>
                    ● {selectedCustomer.statusLabel}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-bold tracking-wider uppercase mt-0.5">
                  {selectedCustomer.code} <span className="text-slate-300">·</span> {selectedCustomer.investorProfile.investorType}
                </p>
                <div className="space-y-1 mt-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
                  <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-blue-500" /> {selectedCustomer.phone}</p>
                  <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-400" /> {selectedCustomer.email}</p>
                  <p className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-emerald-500" /> {selectedCustomer.city}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedCustomerId(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Contact Action Bar */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => { if (typeof window !== 'undefined') window.location.href = `tel:${selectedCustomer.phone}`; unavailableLandAction("Thao tác lưu hoặc gửi dữ liệu"); }}
                className="px-3 py-2 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <PhoneCall className="w-3.5 h-3.5" /> Gọi ngay
              </button>
              <button
                onClick={() => { if (typeof window !== 'undefined') window.open(`https://zalo.me/${selectedCustomer.phone}`, '_blank'); unavailableLandAction("Thao tác lưu hoặc gửi dữ liệu"); }}
                className="px-3 py-2 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 text-sky-700 dark:text-sky-300 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5" /> Zalo
              </button>
              <button
                onClick={() => { if (typeof window !== 'undefined') window.location.href = `mailto:${selectedCustomer.email}`; unavailableLandAction("Thao tác lưu hoặc gửi dữ liệu"); }}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" /> Email
              </button>
            </div>

            {/* Drawer Navigation Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-100 dark:border-slate-800 pb-2 overflow-x-auto scrollbar-none text-xs font-bold">
              {drawerTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setDrawerTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer ${
                    drawerTab === tab.id
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Nhu cầu & Dự án (Investor Requirement Profile) */}
            {drawerTab === 'demand' && (
              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">NHU CẦU & DỰ ÁN</h4>
                  <div className="space-y-2 bg-slate-50/80 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-500 font-medium">Dự án quan tâm</span>
                      <span className="font-extrabold text-slate-900 dark:text-white">{selectedCustomer.project}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-500 font-medium">Ngân sách dự kiến</span>
                      <span className="font-black text-blue-600 dark:text-blue-400">{selectedCustomer.investorProfile.budgetRange}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-500 font-medium">Loại sản phẩm</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{selectedCustomer.investorProfile.propertyTypes.join(', ')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-500 font-medium">Số phòng ngủ</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{selectedCustomer.investorProfile.bedroomCount}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-500 font-medium">Mục đích sở hữu</span>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{selectedCustomer.investorProfile.investmentGoal}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500 font-medium">Khu vực / View</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{selectedCustomer.investorProfile.views.join(' · ')}</span>
                    </div>
                  </div>
                </div>

                {/* Specific Notes */}
                {selectedCustomer.investorProfile.notes && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/50 rounded-2xl text-amber-900 dark:text-amber-200">
                    <span className="font-extrabold block text-[11px] mb-0.5">📌 GHI CHÚ NHU CẦU ĐẶC BIỆT:</span>
                    <p className="italic">{selectedCustomer.investorProfile.notes}</p>
                  </div>
                )}

                {/* Sales Owner Box */}
                <div>
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">SALES PHỤ TRÁCH</h4>
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-xs">
                        {selectedCustomer.salesAvatar}
                      </div>
                      <div>
                        <p className="font-extrabold text-slate-900 dark:text-white text-xs">{selectedCustomer.salesOwnerName}</p>
                        <p className="text-[10px] text-slate-400 font-medium">Phòng Kinh Doanh BĐS 1</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowReassignModal(true)}
                      className="px-2.5 py-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 rounded-xl transition-all"
                    >
                      ⇄ Chuyển sales
                    </button>
                  </div>
                </div>

                {/* Inventory Matrix Matching Action */}
                <Link
                  href="/dashboard/real-estate/apartments"
                  className="w-full py-3 bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-950 hover:to-indigo-950 text-white font-extrabold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 group cursor-pointer"
                >
                  <Building2 className="w-4 h-4 text-blue-300 group-hover:scale-110 transition-transform" />
                  Tìm sản phẩm phù hợp từ Bảng hàng
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </Link>
              </div>
            )}

            {/* Tab 2: Shortlist / Căn quan tâm */}
            {drawerTab === 'shortlist' && (
              <div className="space-y-3 text-xs">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  SẢN PHẨM KHÁCH QUAN TÂM ({selectedCustomer.investorProfile.interestedUnits.length})
                </h4>
                {selectedCustomer.investorProfile.interestedUnits.length === 0 ? (
                  <p className="text-slate-400 italic">Chưa có sản phẩm nào được lưu vào danh sách quan tâm.</p>
                ) : (
                  selectedCustomer.investorProfile.interestedUnits.map((unit, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-slate-900 dark:text-white text-sm">{unit.code}</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                          {unit.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500 font-medium text-[11px]">
                        <span>Giá: <strong className="text-blue-600 dark:text-blue-400">{unit.price}</strong></span>
                        <span>{unit.view}</span>
                      </div>
                    </div>
                  ))
                )}
                
                <Link
                  href="/dashboard/real-estate/apartments"
                  className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
                >
                  <Plus className="w-4 h-4" /> Thêm căn từ Bảng hàng
                </Link>
              </div>
            )}

            {/* Tab 3: History / Interactive Timeline */}
            {drawerTab === 'history' && (
              <div className="space-y-3 text-xs">
                {/* Quick Add Interaction Box */}
                <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="font-extrabold text-slate-900 dark:text-white text-[11px] block">📝 GHI NHẬN TƯƠNG TÁC MỚI</span>
                  <textarea
                    value={newInteractionNote}
                    onChange={e => setNewInteractionNote(e.target.value)}
                    placeholder="Nhập nội dung tương tác, cuộc gọi, tư vấn..."
                    rows={2}
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none resize-none"
                  />
                  <button
                    onClick={handleAddInteraction}
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1"
                  >
                    <Send className="w-3 h-3" /> Lưu tương tác
                  </button>
                </div>

                <div className="space-y-3 pt-2">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">LỊCH SỬ TƯƠNG TÁC ({selectedCustomer.timeline.length})</h4>
                  <div className="space-y-3 border-l-2 border-slate-200 dark:border-slate-800 pl-3 ml-1">
                    {selectedCustomer.timeline.map((item, idx) => (
                      <div key={idx} className="relative space-y-0.5">
                        <div className="absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full bg-blue-600" />
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-extrabold text-slate-900 dark:text-white">{item.title}</span>
                          <span className="text-slate-400 font-medium">{item.time} · {item.date}</span>
                        </div>
                        <p className="text-slate-500 text-[11px]">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Transactions & Portfolio */}
            {drawerTab === 'transactions' && (
              <div className="space-y-3 text-xs">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">TỔNG QUAN GIAO DỊCH</h4>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <span className="text-xl font-black text-amber-600 block">{selectedCustomer.investorProfile.transactionsCount.holding}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Giữ chỗ</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <span className="text-xl font-black text-blue-600 block">{selectedCustomer.investorProfile.transactionsCount.deposited}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Đã cọc</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <span className="text-xl font-black text-emerald-600 block">{selectedCustomer.investorProfile.transactionsCount.contracted}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">HĐMB</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 5. Modal: Thêm Khách Hàng Mới ── */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="max-h-[90vh] overflow-y-auto relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" /> Thêm Khách Hàng & Nhà Đầu Tư Mới
                </h3>
                <button onClick={() => setShowAddModal(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>

              <form onSubmit={e => { e.preventDefault(); unavailableLandAction("Thao tác lưu hoặc gửi dữ liệu"); setShowAddModal(false); }} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Họ và tên *</label>
                    <input required placeholder="Lê Văn Chánh" className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none" />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Số điện thoại *</label>
                    <input required placeholder="0901 234 567" className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Dự án quan tâm</label>
                    <PremiumSelect
                      value={modalProject}
                      onChange={setModalProject}
                      options={[
                        { value: "Elyse Island", label: "Elyse Island" },
                        { value: "Sunrise Residence", label: "Sunrise Residence" },
                        { value: "Lumière Bay", label: "Lumière Bay" },
                        { value: "Bella Premium", label: "Bella Premium" },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Ngân sách dự kiến</label>
                    <input placeholder="3.0 – 5.0 tỷ" className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none" />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Nhu cầu & Ghi chú đặc biệt</label>
                  <textarea placeholder="VD: Tìm căn view sông, tầng cao, ưu tiên đầu tư..." rows={2} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none resize-none" />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 font-bold bg-slate-100 text-slate-600 rounded-xl">Hủy</button>
                  <button type="submit" className="px-5 py-2 font-bold bg-blue-600 text-white rounded-xl">Tạo hồ sơ 360°</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 6. Modal: Chuyển Sales Phụ Trách ── */}
      <AnimatePresence>
        {showReassignModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowReassignModal(false)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="max-h-[90vh] overflow-y-auto relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-black text-slate-900 dark:text-white">Chuyển Sales Phụ Trách Hồ Sơ</h3>
                <button onClick={() => setShowReassignModal(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-500 block mb-1">Chuyển từ sales hiện tại</label>
                  <input disabled value={selectedCustomer?.salesOwnerName || ''} className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold" />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Đến sales phụ trách mới *</label>
                  <PremiumSelect
                    value={modalReassignSales}
                    onChange={setModalReassignSales}
                    options={[
                      { value: "Lê Thị Hoa (PKD 2)", label: "Lê Thị Hoa (PKD 2)" },
                      { value: "Nguyễn Thị Mai (PKD 1)", label: "Nguyễn Thị Mai (PKD 1)" },
                      { value: "Nguyễn Văn An (PKD 3)", label: "Nguyễn Văn An (PKD 3)" },
                    ]}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button type="button" onClick={() => setShowReassignModal(false)} className="px-4 py-2 font-bold bg-slate-100 text-slate-600 rounded-xl">Hủy</button>
                  <button onClick={() => { unavailableLandAction("Thao tác lưu hoặc gửi dữ liệu"); setShowReassignModal(false); }} className="px-5 py-2 font-bold bg-blue-600 text-white rounded-xl">Xác nhận chuyển</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
