"use client";
import { LandPreviewNotice, unavailableLandAction, LandPagination, useLandPagination, inDateRange } from "@/modules/real_estate/components/LandUiControls";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { downloadPdfReport, downloadCsvReport } from "@/modules/real_estate/utils/exportUtils";
import {
  FileText, Search, Download, Eye, Clock,
  CheckCircle2, AlertTriangle, XCircle, FileSignature,
  Filter, Plus, X, Share2, MoreHorizontal,
  Building2, Home, User, Layers, Calendar, ChevronRight,
  ShieldCheck, FileSpreadsheet, Tag, ArrowUpRight, ArrowDownRight,
  Sparkles, History, Link2, Bell, CheckSquare, Square, ChevronLeft
} from "lucide-react";
import { PremiumSelect } from "@/components/ui/PremiumSelect";

// ── TYPES & INTERFACES ──
export type LegalDocStatus = 'signed' | 'approved' | 'pending_approval' | 'pending_signature' | 'draft' | 'expiring' | 'has_issue';
type LegalDocumentDrawerTab = 'info' | 'versions' | 'history' | 'linked';

export interface DocumentVersion {
  version: string;
  createdAt: string;
  createdByName: string;
  note: string;
  isCurrent: boolean;
  fileSize: string;
}

export interface DocumentAuditLog {
  id: string;
  time: string;
  action: string;
  actor: string;
  role: string;
  detail: string;
}

export interface LegalDocumentItem {
  id: string;
  code: string;
  title: string;
  type: string;
  tags: { label: string; bg: string; text: string }[];
  project: string;
  unitCode: string;
  customerName: string;
  customerCode: string;
  version: string;
  isCurrentVersion: boolean;
  createdAt: string;
  createdByName: string;
  status: LegalDocStatus;
  statusLabel: string;
  statusBadgeBg: string;
  statusTextColor: string;
  fileIconBg: string;
  fileIconColor: string;
  signedDate?: string;
  signatureType?: string;
  mainContractCode?: string;
  linkedDocsCount?: number;
  validityRange?: string;
  description?: string;
  versionsList: DocumentVersion[];
  auditLogs: DocumentAuditLog[];
  isMine?: boolean;
  isPendingMyApproval?: boolean;
}

// ── MOCK LEGAL DOCUMENTS (Matching Reference Image 2) ──
const INITIAL_LEGAL_DOCS: LegalDocumentItem[] = [
  {
    id: "doc-001",
    code: "HĐMB-2026-0001",
    title: "HĐMB - CH001 - Nguyễn Văn An",
    type: "Hợp đồng mua bán",
    tags: [
      { label: "Hợp đồng", bg: "bg-blue-50 dark:bg-blue-950/50", text: "text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
      { label: "Quan trọng", bg: "bg-rose-50 dark:bg-rose-950/50", text: "text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800" }
    ],
    project: "The Grand Tower",
    unitCode: "CH-001",
    customerName: "Nguyễn Văn An",
    customerCode: "KH00123",
    version: "v3",
    isCurrentVersion: true,
    createdAt: "15/07/2026 10:30",
    createdByName: "Nguyễn Thị B",
    status: "signed",
    statusLabel: "Đã ký số",
    statusBadgeBg: "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800",
    statusTextColor: "text-emerald-700 dark:text-emerald-400",
    fileIconBg: "bg-rose-100 dark:bg-rose-950/50",
    fileIconColor: "text-rose-600 dark:text-rose-400",
    signedDate: "16/07/2026",
    signatureType: "Ký số (VNPT CA)",
    mainContractCode: "HĐĐC - CH001",
    linkedDocsCount: 2,
    validityRange: "16/07/2026 - 16/07/2056 (30 năm)",
    description: "Hợp đồng mua bán chính thức căn hộ cao cấp CH-001 dự án The Grand Tower.",
    isMine: true,
    isPendingMyApproval: false,
    versionsList: [
      { version: "v3", createdAt: "15/07/2026 10:30", createdByName: "Nguyễn Thị B", note: "Cập nhật điều khoản thanh toán đợt 3 theo thỏa thuận", isCurrent: true, fileSize: "4.2 MB" },
      { version: "v2", createdAt: "12/07/2026 14:15", createdByName: "Nguyễn Văn A", note: "Chỉnh sửa thông tin pháp nhân bên mua", isCurrent: false, fileSize: "4.1 MB" },
      { version: "v1", createdAt: "10/07/2026 09:00", createdByName: "Nguyễn Thị B", note: "Bản khởi tạo ban đầu", isCurrent: false, fileSize: "3.8 MB" }
    ],
    auditLogs: [
      { id: "log-1", time: "16/07/2026 15:45", action: "Ký số thành công", actor: "Nguyễn Văn An", role: "Khách hàng", detail: "Đã ký qua cổng chữ ký số VNPT CA" },
      { id: "log-2", time: "15/07/2026 16:20", action: "Phê duyệt tài liệu", actor: "Trần Minh Tâm", role: "Trưởng phòng Pháp lý", detail: "Đã duyệt bản thảo v3" },
      { id: "log-3", time: "15/07/2026 10:30", action: "Tải lên v3", actor: "Nguyễn Thị B", role: "Chuyên viên Pháp lý", detail: "Cập nhật bản mới" }
    ]
  },
  {
    id: "doc-002",
    code: "BB-2026-0042",
    title: "Biên bản đặt cọc - CH042 - Trần Thị Bình",
    type: "Biên bản đặt cọc",
    tags: [
      { label: "Đặt cọc", bg: "bg-amber-50 dark:bg-amber-950/50", text: "text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
      { label: "Khách hàng", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700" }
    ],
    project: "Riverside Heights",
    unitCode: "CH-042",
    customerName: "Trần Thị Bình",
    customerCode: "KH00456",
    version: "v1",
    isCurrentVersion: true,
    createdAt: "20/07/2026 11:20",
    createdByName: "Phạm Minh Đức",
    status: "approved",
    statusLabel: "Đã duyệt",
    statusBadgeBg: "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800",
    statusTextColor: "text-emerald-700 dark:text-emerald-400",
    fileIconBg: "bg-amber-100 dark:bg-amber-950/50",
    fileIconColor: "text-amber-600 dark:text-amber-400",
    signedDate: "Chưa ký",
    signatureType: "Chờ ký trực tiếp",
    mainContractCode: "DC-2026-042",
    linkedDocsCount: 1,
    validityRange: "20/07/2026 - 20/08/2026 (30 ngày)",
    isMine: false,
    isPendingMyApproval: false,
    versionsList: [
      { version: "v1", createdAt: "20/07/2026 11:20", createdByName: "Phạm Minh Đức", note: "Tạo biên bản cọc đợt 1", isCurrent: true, fileSize: "1.8 MB" }
    ],
    auditLogs: [
      { id: "log-1", time: "20/07/2026 14:00", action: "Phê duyệt biên bản", actor: "Trần Minh Tâm", role: "Trưởng phòng Kinh doanh", detail: "Đã duyệt hạn mức cọc 100tr" }
    ]
  },
  {
    id: "doc-003",
    code: "HĐMB-2026-0003",
    title: "HĐMB - SH008 - Lê Hoàng Cường",
    type: "Hợp đồng mua bán",
    tags: [
      { label: "Hợp đồng", bg: "bg-blue-50 dark:bg-blue-950/50", text: "text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
      { label: "Shophouse", bg: "bg-purple-50 dark:bg-purple-950/50", text: "text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800" }
    ],
    project: "The Grand Tower",
    unitCode: "SH-008",
    customerName: "Lê Hoàng Cường",
    customerCode: "KH00789",
    version: "v2",
    isCurrentVersion: true,
    createdAt: "28/07/2026 16:00",
    createdByName: "Nguyễn Văn A",
    status: "pending_approval",
    statusLabel: "Đang duyệt",
    statusBadgeBg: "bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800",
    statusTextColor: "text-amber-700 dark:text-amber-400",
    fileIconBg: "bg-blue-100 dark:bg-blue-950/50",
    fileIconColor: "text-blue-600 dark:text-blue-400",
    mainContractCode: "HĐĐC - SH008",
    linkedDocsCount: 3,
    validityRange: "Dự kiến 01/08/2026",
    isMine: true,
    isPendingMyApproval: true,
    versionsList: [
      { version: "v2", createdAt: "28/07/2026 16:00", createdByName: "Nguyễn Văn A", note: "Cập nhật thông tin Shophouse khối đế", isCurrent: true, fileSize: "5.1 MB" },
      { version: "v1", createdAt: "25/07/2026 10:00", createdByName: "Nguyễn Văn A", note: "Bản thảo ban đầu", isCurrent: false, fileSize: "4.9 MB" }
    ],
    auditLogs: [
      { id: "log-1", time: "28/07/2026 16:05", action: "Gửi phê duyệt", actor: "Nguyễn Văn A", role: "Quản trị viên", detail: "Trình duyệt Giám đốc Pháp lý" }
    ]
  },
  {
    id: "doc-004",
    code: "PL-2026-0010",
    title: "Phụ lục HĐMB - Thanh toán đợt 2",
    type: "Phụ lục hợp đồng",
    tags: [
      { label: "Phụ lục", bg: "bg-purple-50 dark:bg-purple-950/50", text: "text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800" },
      { label: "Thanh toán", bg: "bg-emerald-50 dark:bg-emerald-950/50", text: "text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" }
    ],
    project: "The Grand Tower",
    unitCode: "CH-001",
    customerName: "Nguyễn Văn An",
    customerCode: "KH00123",
    version: "v1",
    isCurrentVersion: true,
    createdAt: "30/07/2026 09:15",
    createdByName: "Trần Minh Tâm",
    status: "pending_signature",
    statusLabel: "Chờ ký",
    statusBadgeBg: "bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800",
    statusTextColor: "text-purple-700 dark:text-purple-400",
    fileIconBg: "bg-purple-100 dark:bg-purple-950/50",
    fileIconColor: "text-purple-600 dark:text-purple-400",
    mainContractCode: "HĐMB-2026-0001",
    linkedDocsCount: 1,
    validityRange: "30/07/2026 - 30/07/2027",
    isMine: false,
    isPendingMyApproval: false,
    versionsList: [
      { version: "v1", createdAt: "30/07/2026 09:15", createdByName: "Trần Minh Tâm", note: "Lịch gia hạn thanh toán đợt 2", isCurrent: true, fileSize: "2.1 MB" }
    ],
    auditLogs: [
      { id: "log-1", time: "30/07/2026 10:00", action: "Đã duyệt nội dung", actor: "Trần Minh Tâm", role: "Trưởng phòng Pháp lý", detail: "Chờ khách hàng ký OTP SmartCA" }
    ]
  },
  {
    id: "doc-005",
    code: "BBBG-2026-0015",
    title: "Biên bản bàn giao - CH015",
    type: "Biên bản bàn giao",
    tags: [
      { label: "Bàn giao", bg: "bg-emerald-50 dark:bg-emerald-950/50", text: "text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
      { label: "Căn hộ", bg: "bg-blue-50 dark:bg-blue-950/50", text: "text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800" }
    ],
    project: "Riverside Heights",
    unitCode: "CH-015",
    customerName: "Phạm Minh Đức",
    customerCode: "KH00678",
    version: "v1",
    isCurrentVersion: true,
    createdAt: "10/07/2026 14:30",
    createdByName: "Lê Thị Mai",
    status: "signed",
    statusLabel: "Đã ký số",
    statusBadgeBg: "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800",
    statusTextColor: "text-emerald-700 dark:text-emerald-400",
    fileIconBg: "bg-emerald-100 dark:bg-emerald-950/50",
    fileIconColor: "text-emerald-600 dark:text-emerald-400",
    signedDate: "11/07/2026",
    signatureType: "Ký máy tablet tại công trình",
    mainContractCode: "HĐMB-RS-015",
    linkedDocsCount: 4,
    validityRange: "Bàn giao chính thức",
    isMine: false,
    isPendingMyApproval: false,
    versionsList: [
      { version: "v1", createdAt: "10/07/2026 14:30", createdByName: "Lê Thị Mai", note: "Nghiệm thu bàn giao căn hộ CH-015", isCurrent: true, fileSize: "3.5 MB" }
    ],
    auditLogs: [
      { id: "log-1", time: "11/07/2026 16:00", action: "Ký bàn giao", actor: "Phạm Minh Đức", role: "Chủ hộ", detail: "Đã ký xác nhận 100% hạng mục" }
    ]
  },
  {
    id: "doc-006",
    code: "GCN-2026-0012",
    title: "GCN - TN012",
    type: "Giấy chứng nhận",
    tags: [
      { label: "Giấy chứng nhận", bg: "bg-blue-50 dark:bg-blue-950/50", text: "text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
      { label: "Pháp lý", bg: "bg-purple-50 dark:bg-purple-950/50", text: "text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800" }
    ],
    project: "Sunrise Villa",
    unitCode: "TN-012",
    customerName: "Hộ Ngô Thị Hà",
    customerCode: "KH00912",
    version: "v1",
    isCurrentVersion: true,
    createdAt: "02/07/2026 08:45",
    createdByName: "Nguyễn Văn B",
    status: "approved",
    statusLabel: "Đã duyệt",
    statusBadgeBg: "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800",
    statusTextColor: "text-emerald-700 dark:text-emerald-400",
    fileIconBg: "bg-blue-100 dark:bg-blue-950/50",
    fileIconColor: "text-blue-600 dark:text-blue-400",
    signedDate: "Đã cấp sổ hồng",
    mainContractCode: "HD-SV-012",
    linkedDocsCount: 2,
    validityRange: "Vĩnh viễn",
    isMine: false,
    isPendingMyApproval: false,
    versionsList: [
      { version: "v1", createdAt: "02/07/2026 08:45", createdByName: "Nguyễn Văn B", note: "Quét bản chính GCN quyền sử dụng đất & tài sản gắn liền", isCurrent: true, fileSize: "8.4 MB" }
    ],
    auditLogs: [
      { id: "log-1", time: "02/07/2026 10:30", action: "Xác thực hồ sơ", actor: "Sở Tài Nguyên Môi Trường", role: "Cơ quan cấp", detail: "Đã trích lục thành công" }
    ]
  },
  {
    id: "doc-007",
    code: "PCCC-2026-0021",
    title: "Văn bản nghiệm thu PCCC",
    type: "Văn bản nghiệm thu",
    tags: [
      { label: "Pháp lý", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700" },
      { label: "Kỹ thuật", bg: "bg-amber-50 dark:bg-amber-950/50", text: "text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800" }
    ],
    project: "The Grand Tower",
    unitCode: "Block A",
    customerName: "Ban quản lý dự án",
    customerCode: "BQL-GDT",
    version: "v1",
    isCurrentVersion: true,
    createdAt: "18/07/2026 15:10",
    createdByName: "Lê Quốc Huy",
    status: "draft",
    statusLabel: "Nháp",
    statusBadgeBg: "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700",
    statusTextColor: "text-slate-700 dark:text-slate-300",
    fileIconBg: "bg-amber-100 dark:bg-amber-950/50",
    fileIconColor: "text-amber-600 dark:text-amber-400",
    linkedDocsCount: 5,
    validityRange: "Đang trình duyệt Cảnh sát PCCC",
    isMine: true,
    isPendingMyApproval: false,
    versionsList: [
      { version: "v1", createdAt: "18/07/2026 15:10", createdByName: "Lê Quốc Huy", note: "Bản thảo công văn nghiệm thu PCCC Block A", isCurrent: true, fileSize: "6.2 MB" }
    ],
    auditLogs: [
      { id: "log-1", time: "18/07/2026 15:10", action: "Tạo bản nháp", actor: "Lê Quốc Huy", role: "Kỹ sư Trưởng PCCC", detail: "Đang chờ hoàn thiện hồ sơ" }
    ]
  },
  {
    id: "doc-008",
    code: "DVQL-2026-0032",
    title: "Hợp đồng dịch vụ quản lý",
    type: "Hợp đồng dịch vụ",
    tags: [
      { label: "Dịch vụ", bg: "bg-rose-50 dark:bg-rose-950/50", text: "text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800" },
      { label: "Vận hành", bg: "bg-blue-50 dark:bg-blue-950/50", text: "text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800" }
    ],
    project: "Riverside Heights",
    unitCode: "Toàn khu",
    customerName: "Công ty ABC",
    customerCode: "DT-ABC01",
    version: "v1",
    isCurrentVersion: true,
    createdAt: "25/07/2026 13:00",
    createdByName: "Trần Thị Lan",
    status: "expiring",
    statusLabel: "Sắp hết hạn",
    statusBadgeBg: "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800",
    statusTextColor: "text-rose-700 dark:text-rose-400",
    fileIconBg: "bg-rose-100 dark:bg-rose-950/50",
    fileIconColor: "text-rose-600 dark:text-rose-400",
    validityRange: "Còn 15 ngày (Hết hạn 15/08/2026)",
    isMine: false,
    isPendingMyApproval: false,
    versionsList: [
      { version: "v1", createdAt: "25/07/2026 13:00", createdByName: "Trần Thị Lan", note: "Hợp đồng vận hành tòa nhà Riverside Heights năm 2025-2026", isCurrent: true, fileSize: "3.1 MB" }
    ],
    auditLogs: [
      { id: "log-1", time: "01/08/2026 08:00", action: "Cảnh báo tự động", actor: "Hệ thống Bella ERP", role: "System Auto Alert", detail: "Gửi thông báo tái ký hợp đồng dịch vụ" }
    ]
  }
];

export default function LegalDocumentsOperationsCenterPage() {
  const [documents, setDocuments] = useState<LegalDocumentItem[]>(INITIAL_LEGAL_DOCS);
  const [selectedDocId, setSelectedDocId] = useState<string>("doc-001");
  const [activeTabFilter, setActiveTabFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  // Dropdown Filters
  const [filterType, setFilterType] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterOwner, setFilterOwner] = useState<string>("all");
  const [pageSize, setPageSize] = useState("20");
  const [filterTime, setFilterTime] = useState<string>("all");

  // Selection Checkboxes
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  // Right Panel Drawer Tab
  const [drawerTab, setDrawerTab] = useState<LegalDocumentDrawerTab>('info');

  // Modals & Action States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);

  // New Document Form State
  const [newDocForm, setNewDocForm] = useState({
    title: "",
    code: "",
    type: "Hợp đồng mua bán",
    project: "The Grand Tower",
    unitCode: "CH-001",
    customerName: "",
    customerCode: "KH00999",
    status: "draft" as LegalDocStatus,
    description: "",
    fileSize: "2.5 MB"
  });

  // Selected Document object


  // Operational KPIs (Matching Image 2 Metrics)
  const kpis = useMemo(() => {
    return {
      total: 1248,
      signed: 836,
      pendingApproval: 12,
      pendingSignature: 8,
      expiring: 5,
      hasIssue: 2
    };
  }, []);

  // Filtered List Logic
  const filteredDocs = useMemo(() => {
    return documents.filter(d => {
      // Quick Tab Filter
      if (activeTabFilter === "mine" && !d.isMine) return false;
      if (activeTabFilter === "pending_my_approval" && !d.isPendingMyApproval) return false;
      if (activeTabFilter === "pending_signature" && d.status !== "pending_signature") return false;
      if (activeTabFilter === "expiring" && d.status !== "expiring") return false;
      if (activeTabFilter === "has_issue" && d.status !== "has_issue") return false;

      // Dropdown Filters
      if (!inDateRange(d.createdAt, filterTime)) return false;
      if (filterType !== "all" && d.type !== filterType) return false;
      if (filterProject !== "all" && d.project !== filterProject) return false;
      if (filterStatus !== "all" && d.status !== filterStatus) return false;
      if (filterOwner !== "all" && d.createdByName !== filterOwner) return false;

      // Search Query
      if (search) {
        const q = search.toLowerCase();
        const mTitle = d.title.toLowerCase().includes(q);
        const mCode = d.code.toLowerCase().includes(q);
        const mCust = d.customerName.toLowerCase().includes(q);
        const mUnit = d.unitCode.toLowerCase().includes(q);
        const mProj = d.project.toLowerCase().includes(q);
        if (!mTitle && !mCode && !mCust && !mUnit && !mProj) return false;
      }
      return true;
    });
  }, [documents, activeTabFilter, filterType, filterProject, filterStatus, filterOwner, filterTime, search]);
  const pagination = useLandPagination(filteredDocs, Number(pageSize));
  const selectedDoc = pagination.rows.find(d => d.id === selectedDocId) || null;

  // Handle Multi Select
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDocIds(pagination.rows.map(d => d.id));
    } else {
      setSelectedDocIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedDocIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Create Document Handler
  const handleCreateDocumentSubmit = (e: React.FormEvent) => { e.preventDefault(); unavailableLandAction("Lưu dữ liệu nghiệp vụ"); };

  const drawerTabs: Array<{ id: LegalDocumentDrawerTab; label: string }> = selectedDoc
    ? [
        { id: 'info', label: 'Thông tin' },
        { id: 'versions', label: `Phiên bản (${selectedDoc.versionsList.length})` },
        { id: 'history', label: `Lịch sử (${selectedDoc.auditLogs.length})` },
        { id: 'linked', label: 'Tài liệu liên quan' },
      ]
    : [];

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1680px] mx-auto font-sans text-slate-900 dark:text-slate-100 pb-12">
      <LandPreviewNotice />
      
      {/* ── 1. HEADER BANNER WITH ARCHITECTURAL WATERMARK (Matching Image 2) ── */}
      <div className="relative rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 md:p-6 shadow-xs">
        {/* Decorative Modern High-rise Banner Graphic on Right Side */}
        <div 
          className="absolute right-0 top-0 bottom-0 w-1/2 bg-cover bg-right opacity-[0.08] dark:opacity-20 pointer-events-none mix-blend-multiply dark:mix-blend-luminosity"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-transparent dark:from-slate-900 dark:via-slate-900/90 dark:to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-bold">
                <FileText className="w-3.5 h-3.5" /> Hồ sơ & Pháp lý
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              Kho Tài Liệu Pháp Lý
            </h1>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium max-w-2xl">
              Quản lý hợp đồng, phụ lục, biên bản và các tài liệu pháp lý của dự án
            </p>
          </div>

          {/* Right Header Controls & Motto */}
          <div className="flex flex-col items-start md:items-end gap-2.5">
            <div className="hidden xl:block text-right">
              <div className="font-serif italic text-blue-900/80 dark:text-amber-300 text-sm font-semibold tracking-wide">
                Nền tảng vững chắc - Cho những giá trị bền lâu
              </div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-0.5">
                BELLA LAND · REAL ESTATE FOR A BRIGHTER TOMORROW
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              {/* Search Header Tool */}
              <div className="relative w-48 lg:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input 
                  placeholder="Tìm kiếm..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none shadow-2xs"
                />
              </div>

              {/* Notification Bell */}
              <button 
                onClick={() => { setFilterStatus('pending_approval'); toast.info("Đã lọc danh sách tài liệu chờ phê duyệt!"); }}
                className="relative p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-[10px] font-black text-white flex items-center justify-center">
                  3
                </span>
              </button>

              {/* Project Selector Chip */}
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200">
                <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>The Grand Tower</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. 6 OPERATIONAL KPI CARDS (Matching Image 2 Exact Counts) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        
        {/* KPI 1: Tổng tài liệu */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{kpis.total.toLocaleString('vi-VN')}</span>
              <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center">
                <ArrowUpRight className="w-3 h-3" /> 12%
              </span>
            </div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">Tổng tài liệu</div>
            <div className="text-[10px] text-slate-400 font-medium">so với tháng trước</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Đã ký số */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{kpis.signed}</span>
              <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center">
                <ArrowUpRight className="w-3 h-3" /> 18%
              </span>
            </div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">Đã ký số</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Đang chờ duyệt */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{kpis.pendingApproval}</span>
              <span className="text-[11px] font-extrabold text-rose-600 dark:text-rose-400 flex items-center">
                <ArrowDownRight className="w-3 h-3" /> 5%
              </span>
            </div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">Đang chờ duyệt</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-800/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: Chờ ký */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{kpis.pendingSignature}</span>
              <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center">
                <ArrowUpRight className="w-3 h-3" /> 33%
              </span>
            </div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">Chờ ký</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200/60 dark:border-purple-800/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <FileSignature className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 5: Sắp hết hiệu lực */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{kpis.expiring}</span>
              <span className="text-[11px] font-extrabold text-rose-600 dark:text-rose-400 flex items-center">
                <ArrowUpRight className="w-3 h-3" /> 150%
              </span>
            </div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">Sắp hết hiệu lực</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200/60 dark:border-rose-800/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 6: Có vấn đề */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{kpis.hasIssue}</span>
              <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center">
                <ArrowUpRight className="w-3 h-3" /> 50%
              </span>
            </div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">Có vấn đề</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── 3. SEARCH & ADVANCED FILTER DROPDOWNS (Matching Image 2) ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Main Filter Search Bar */}
          <div className="relative flex-1 min-w-[280px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              placeholder="Tìm kiếm theo tên tài liệu, mã, khách hàng, căn hộ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 transition"
            />
          </div>

          {/* 5 Dropdown Filters */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <PremiumSelect
              value={filterType}
              onChange={setFilterType}
              placeholder="Loại tài liệu"
              className="w-44"
              options={[
                { value: "all", label: "Loại tài liệu" },
                { value: "Hợp đồng mua bán", label: "Hợp đồng mua bán" },
                { value: "Biên bản đặt cọc", label: "Biên bản đặt cọc" },
                { value: "Phụ lục hợp đồng", label: "Phụ lục hợp đồng" },
                { value: "Biên bản bàn giao", label: "Biên bản bàn giao" },
                { value: "Giấy chứng nhận", label: "Giấy chứng nhận" },
                { value: "Văn bản nghiệm thu", label: "Văn bản nghiệm thu" },
                { value: "Hợp đồng dịch vụ", label: "Hợp đồng dịch vụ" },
              ]}
            />

            <PremiumSelect
              value={filterProject}
              onChange={setFilterProject}
              placeholder="Dự án"
              className="w-40"
              options={[
                { value: "all", label: "Dự án" },
                { value: "The Grand Tower", label: "The Grand Tower" },
                { value: "Riverside Heights", label: "Riverside Heights" },
                { value: "Sunrise Villa", label: "Sunrise Villa" },
              ]}
            />

            <PremiumSelect
              value={filterStatus}
              onChange={setFilterStatus}
              placeholder="Trạng thái"
              className="w-40"
              options={[
                { value: "all", label: "Trạng thái" },
                { value: "signed", label: "Đã ký số" },
                { value: "approved", label: "Đã duyệt" },
                { value: "pending_approval", label: "Đang duyệt" },
                { value: "pending_signature", label: "Chờ ký" },
                { value: "draft", label: "Nháp" },
                { value: "expiring", label: "Sắp hết hạn" },
              ]}
            />

            <PremiumSelect
              value={filterOwner}
              onChange={setFilterOwner}
              placeholder="Người phụ trách"
              className="w-44"
              options={[
                { value: "all", label: "Người phụ trách" },
                { value: "Nguyễn Thị B", label: "Nguyễn Thị B" },
                { value: "Phạm Minh Đức", label: "Phạm Minh Đức" },
                { value: "Nguyễn Văn A", label: "Nguyễn Văn A" },
                { value: "Trần Minh Tâm", label: "Trần Minh Tâm" },
              ]}
            />

            <PremiumSelect
              value={filterTime}
              onChange={setFilterTime}
              placeholder="Thời gian"
              className="w-36"
              options={[
                { value: "all", label: "Thời gian" },
                { value: "month", label: "Tháng này" },
                { value: "quarter", label: "Quý này" },
                { value: "2026", label: "Năm 2026" },
              ]}
            />

            <button 
              onClick={() => {
                setFilterType('all');
                setFilterProject('all');
                setFilterStatus('all');
                setFilterOwner('all');
                setSearch(''); setFilterTime('all'); setActiveTabFilter('all');
              }}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition"
              title="Đặt lại bộ lọc"
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Filter Pills & Primary Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          
          {/* Quick Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: 'all', label: 'Tất cả', count: '1,248' },
              { id: 'mine', label: 'Của tôi', count: '24' },
              { id: 'pending_my_approval', label: 'Chờ tôi duyệt', count: '12' },
              { id: 'pending_signature', label: 'Chờ ký', count: '8' },
              { id: 'expiring', label: 'Sắp hết hạn', count: '5' },
              { id: 'has_issue', label: 'Có vấn đề', count: '2' },
            ].map(tab => {
              const isActive = activeTabFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTabFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Actions: Export & Create Button */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              onClick={() => {
                unavailableLandAction("Xuất tài liệu nghiệp vụ");
                unavailableLandAction("Thao tác lưu hoặc gửi dữ liệu");
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Xuất dữ liệu</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Tạo Tài Liệu Mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 4. MAIN LAYOUT GRID: TABLE (LEFT) + DETAIL DRAWER (RIGHT) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        
        {/* LEFT COLUMN: LEGAL DOCUMENTS DATA TABLE (8 COLS) */}
        <div className="xl:col-span-8 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden space-y-0">
          
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider text-[11px]">
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filteredDocs.every(doc => selectedDocIds.includes(doc.id)) && filteredDocs.length > 0}
                      onChange={e => handleSelectAll(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="p-3 font-bold">Tài liệu</th>
                  <th className="p-3 font-bold">Loại</th>
                  <th className="p-3 font-bold">Dự án / Căn hộ</th>
                  <th className="p-3 font-bold">Khách hàng</th>
                  <th className="p-3 font-bold">Phiên bản</th>
                  <th className="p-3 font-bold">Ngày tạo</th>
                  <th className="p-3 font-bold">Trạng thái</th>
                  <th className="p-3 font-bold text-right">Thao tác</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
                {pagination.rows.map((doc) => {
                  const isSelected = doc.id === selectedDocId;
                  const isChecked = selectedDocIds.includes(doc.id);

                  return (
                    <tr
                      key={doc.id}
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`group transition-colors cursor-pointer ${
                        isSelected 
                          ? 'bg-blue-50/70 dark:bg-blue-950/30 font-semibold' 
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleSelectOne(doc.id)}
                          className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      {/* File Icon + Title + Code + Tags */}
                      <td className="p-3 max-w-[240px]">
                        <div className="flex items-start gap-2.5">
                          <div className={`w-8 h-8 rounded-lg ${doc.fileIconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                            <FileText className={`w-4 h-4 ${doc.fileIconColor}`} />
                          </div>

                          <div className="space-y-1 min-w-0">
                            <div className="font-extrabold text-slate-900 dark:text-white leading-tight truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {doc.title}
                            </div>
                            <div className="text-[11px] font-bold text-slate-400 font-mono">
                              #{doc.code}
                            </div>
                            <div className="flex items-center gap-1 flex-wrap">
                              {doc.tags.map((t, idx) => (
                                <span 
                                  key={idx} 
                                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${t.bg} ${t.text}`}
                                >
                                  {t.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Loại */}
                      <td className="p-3 text-slate-600 dark:text-slate-300 font-bold whitespace-nowrap">
                        {doc.type}
                      </td>

                      {/* Dự án / Căn hộ */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white">{doc.project}</div>
                        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{doc.unitCode}</div>
                      </td>

                      {/* Khách hàng */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white">{doc.customerName}</div>
                        <div className="text-[11px] font-semibold text-slate-400">{doc.customerCode}</div>
                      </td>

                      {/* Phiên bản */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span className="font-extrabold text-slate-700 dark:text-slate-200">{doc.version}</span>
                          {doc.isCurrentVersion && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                              Hiện tại
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Ngày tạo & Người tạo */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-700 dark:text-slate-300">{doc.createdAt.split(' ')[0]}</div>
                        <div className="text-[11px] text-slate-400 font-medium">{doc.createdByName}</div>
                      </td>

                      {/* Trạng thái Badge */}
                      <td className="p-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${doc.statusBadgeBg} ${doc.statusTextColor}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {doc.statusLabel}
                        </span>
                      </td>

                      {/* Thao tác Menu */}
                      <td className="p-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="relative inline-block text-left">
                          <button
                            onClick={() => setActiveActionMenuId(activeActionMenuId === doc.id ? null : doc.id)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>

                          {/* Action Dropdown Menu */}
                          {activeActionMenuId === doc.id && (
                            <div className="absolute right-0 mt-1 w-44 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-1 z-50 text-left text-xs font-semibold space-y-0.5">
                              <button
                                onClick={() => {
                                  setSelectedDocId(doc.id);
                                  setActiveActionMenuId(null);
                                  unavailableLandAction("Thao tác lưu hoặc gửi dữ liệu");
                                }}
                                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                              >
                                <Eye className="w-3.5 h-3.5 text-blue-500" /> Xem chi tiết
                              </button>

                              <button
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  unavailableLandAction("Xuất tài liệu nghiệp vụ");
                                  unavailableLandAction("Thao tác lưu hoặc gửi dữ liệu");
                                }}
                                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                              >
                                <Download className="w-3.5 h-3.5 text-emerald-500" /> Tải xuống
                              </button>

                              {doc.status === 'pending_approval' && (
                                <button
                                  onClick={() => { unavailableLandAction("Phê duyệt hoặc cập nhật nghiệp vụ"); }}
                                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-emerald-600 font-bold"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" /> Phê duyệt
                                </button>
                              )}

                              {doc.status === 'pending_signature' && (
                                <button
                                  onClick={() => { unavailableLandAction("Phê duyệt hoặc cập nhật nghiệp vụ"); }}
                                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-purple-600 font-bold"
                                >
                                  <FileSignature className="w-3.5 h-3.5" /> Ký số tài liệu
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  unavailableLandAction("Thao tác lưu hoặc gửi dữ liệu");
                                }}
                                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                              >
                                <History className="w-3.5 h-3.5 text-amber-500" /> Tạo phiên bản mới
                              </button>

                              <button
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  unavailableLandAction("Hủy tài liệu");
                                }}
                                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 flex items-center gap-2"
                              >
                                <XCircle className="w-3.5 h-3.5" /> Hủy tài liệu
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredDocs.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 dark:text-slate-500 italic">
                      Không tìm thấy tài liệu pháp lý phù hợp với bộ lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer Pagination Controls (Matching Image 2) */}
          <div className="border-t border-slate-200 dark:border-slate-800"><LandPagination {...pagination} /><PremiumSelect value={pageSize} onChange={setPageSize} className="m-3 w-32" options={[{value:'5',label:'5 / trang'},{value:'8',label:'8 / trang'},{value:'10',label:'10 / trang'},{value:'20',label:'20 / trang'},{value:'50',label:'50 / trang'}]} /></div>
        </div>

        {/* RIGHT COLUMN: CHI TIẾT TÀI LIỆU DRAWER PANEL (4 COLS - Matching Image 2 Exact Layout) */}
        <div className="xl:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-5 sticky top-6">
          
          {selectedDoc ? (
            <>
              {/* Drawer Header Card */}
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <FileText className="w-5 h-5" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                        {selectedDoc.title}
                      </h2>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${selectedDoc.statusBadgeBg} ${selectedDoc.statusTextColor}`}>
                        ● {selectedDoc.statusLabel}
                      </span>
                    </div>

                    <div className="text-xs font-mono font-bold text-slate-400">
                      #{selectedDoc.code}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      {selectedDoc.tags.map((t, i) => (
                        <span key={i} className={`px-2 py-0.2 rounded text-[10px] font-bold border ${t.bg} ${t.text}`}>
                          {t.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedDocId("")}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 4 Detail Drawer Tabs */}
              <div className="flex items-center border-b border-slate-200 dark:border-slate-800 gap-2">
                {drawerTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setDrawerTab(tab.id)}
                    className={`pb-2 text-xs font-bold transition border-b-2 ${
                      drawerTab === tab.id
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-black'
                        : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* TAB 1: THÔNG TIN (Matching Image 2 Drawer Section) */}
              {drawerTab === 'info' && (
                <div className="space-y-4 text-xs">
                  {/* General Info Box */}
                  <div className="space-y-2.5">
                    <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px] text-slate-400">
                      Thông tin chung
                    </h3>

                    <div className="grid grid-cols-3 gap-1.5 py-1 border-b border-slate-100 dark:border-slate-800/80">
                      <span className="text-slate-400 font-semibold">Tên tài liệu</span>
                      <span className="col-span-2 font-bold text-slate-900 dark:text-white">{selectedDoc.title}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 py-1 border-b border-slate-100 dark:border-slate-800/80">
                      <span className="text-slate-400 font-semibold">Mã tài liệu</span>
                      <span className="col-span-2 font-mono font-bold text-slate-700 dark:text-slate-300">#{selectedDoc.code}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 py-1 border-b border-slate-100 dark:border-slate-800/80">
                      <span className="text-slate-400 font-semibold">Loại tài liệu</span>
                      <span className="col-span-2 font-bold text-slate-900 dark:text-white">{selectedDoc.type}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 py-1 border-b border-slate-100 dark:border-slate-800/80">
                      <span className="text-slate-400 font-semibold">Trạng thái</span>
                      <span className="col-span-2">
                        <span className={`inline-flex items-center gap-1 font-bold ${selectedDoc.statusTextColor}`}>
                          ● {selectedDoc.statusLabel}
                        </span>
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 py-1 border-b border-slate-100 dark:border-slate-800/80">
                      <span className="text-slate-400 font-semibold">Phiên bản</span>
                      <span className="col-span-2 font-bold text-emerald-600 dark:text-emerald-400">
                        {selectedDoc.version} (Hiện tại)
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 py-1 border-b border-slate-100 dark:border-slate-800/80">
                      <span className="text-slate-400 font-semibold">Ngày tạo</span>
                      <span className="col-span-2 font-semibold text-slate-800 dark:text-slate-200">{selectedDoc.createdAt}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 py-1 border-b border-slate-100 dark:border-slate-800/80">
                      <span className="text-slate-400 font-semibold">Người tạo</span>
                      <span className="col-span-2 font-semibold text-slate-800 dark:text-slate-200">{selectedDoc.createdByName}</span>
                    </div>

                    {selectedDoc.signedDate && (
                      <div className="grid grid-cols-3 gap-1.5 py-1 border-b border-slate-100 dark:border-slate-800/80">
                        <span className="text-slate-400 font-semibold">Ngày ký</span>
                        <span className="col-span-2 font-semibold text-slate-800 dark:text-slate-200">{selectedDoc.signedDate}</span>
                      </div>
                    )}

                    {selectedDoc.signatureType && (
                      <div className="grid grid-cols-3 gap-1.5 py-1 border-b border-slate-100 dark:border-slate-800/80">
                        <span className="text-slate-400 font-semibold">Hình thức ký</span>
                        <span className="col-span-2 font-semibold text-slate-800 dark:text-slate-200">{selectedDoc.signatureType}</span>
                      </div>
                    )}
                  </div>

                  {/* Linked Relationships Box (Matching Image 2 Context) */}
                  <div className="space-y-2.5 pt-2">
                    <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px] text-slate-400">
                      Thông tin liên quan
                    </h3>

                    <div className="flex items-center justify-between py-1.5 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-blue-500" /> Dự án
                      </span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">{selectedDoc.project}</span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
                        <Home className="w-3.5 h-3.5 text-amber-500" /> Căn hộ
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">{selectedDoc.unitCode}</span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-emerald-500" /> Khách hàng
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">{selectedDoc.customerName} ({selectedDoc.customerCode})</span>
                    </div>

                    {selectedDoc.mainContractCode && (
                      <div className="flex items-center justify-between py-1.5 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-purple-500" /> Hợp đồng chính
                        </span>
                        <span className="font-bold text-purple-600 dark:text-purple-400">{selectedDoc.mainContractCode}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between py-1.5 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-500" /> Phụ lục liên quan
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">{selectedDoc.linkedDocsCount || 2} tài liệu</span>
                    </div>

                    {selectedDoc.validityRange && (
                      <div className="flex items-center justify-between py-1.5 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-rose-500" /> Hiệu lực
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedDoc.validityRange}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: PHIÊN BẢN (Version History Graph) */}
              {drawerTab === 'versions' && (
                <div className="space-y-3 text-xs">
                  <div className="text-[11px] font-bold text-slate-400">
                    Lịch sử nâng cấp phiên bản tài liệu
                  </div>
                  {selectedDoc.versionsList.map((ver, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-slate-900 dark:text-white text-sm">{ver.version}</span>
                        {ver.isCurrent ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Hiện tại
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Lưu trữ</span>
                        )}
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 font-medium">{ver.note}</p>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span>{ver.createdByName} · {ver.createdAt}</span>
                        <span className="font-mono">{ver.fileSize}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 3: LỊCH SỬ & AUDIT LOG */}
              {drawerTab === 'history' && (
                <div className="space-y-3 text-xs">
                  <div className="text-[11px] font-bold text-slate-400">
                    Nhật ký thao tác & Chữ ký số (Audit Trail)
                  </div>
                  <div className="relative pl-4 space-y-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                    {selectedDoc.auditLogs.map((log) => (
                      <div key={log.id} className="relative space-y-0.5">
                        <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-white dark:ring-slate-900" />
                        <div className="font-bold text-slate-900 dark:text-white">{log.action}</div>
                        <div className="text-slate-600 dark:text-slate-300">{log.detail}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{log.actor} ({log.role}) · {log.time}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: TÀI LIỆU LIÊN QUAN */}
              {drawerTab === 'linked' && (
                <div className="space-y-2.5 text-xs">
                  <div className="text-[11px] font-bold text-slate-400">
                    Danh mục giấy tờ cùng hồ sơ căn {selectedDoc.unitCode}
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">Biên bản đặt cọc</div>
                        <div className="text-[10px] text-slate-400 font-mono">#DC-{selectedDoc.unitCode}</div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">Đã duyệt</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-purple-500" />
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">Phụ lịch thanh toán đợt 2</div>
                        <div className="text-[10px] text-slate-400 font-mono">#PL-TT02</div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700">Chờ ký</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-500" />
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">Giấy chứng nhận (Sổ hồng)</div>
                        <div className="text-[10px] text-slate-400 font-mono">#GCN-{selectedDoc.unitCode}</div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">Đã cấp</span>
                  </div>
                </div>
              )}

              {/* Drawer Bottom Action Buttons (Matching Image 2 Footer Actions) */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => unavailableLandAction("Thao tác lưu hoặc gửi dữ liệu")}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs transition flex items-center justify-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" /> Xem trước
                </button>

                <button
                  onClick={() => {
                    unavailableLandAction("Xuất tài liệu nghiệp vụ");
                    unavailableLandAction("Thao tác lưu hoặc gửi dữ liệu");
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs transition flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Tải xuống
                </button>

                <button
                  onClick={() => unavailableLandAction("Chia sẻ tài liệu chưa có liên kết đã xác minh")}
                  className="py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" /> Chia sẻ
                </button>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs italic">
              Vui lòng chọn một tài liệu từ bảng để xem chi tiết.
            </div>
          )}

        </div>
      </div>

      {/* ── 5. MODAL: TẠO TÀI LIỆU MỚI (Matching Image 2 Form) ── */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  Tạo Tài Liệu Pháp Lý Mới
                </h3>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateDocumentSubmit} className="space-y-4 text-xs font-semibold">
                <div className="space-y-1">
                  <label className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                    Tên tài liệu pháp lý <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    placeholder="Ví dụ: HĐMB - CH009 - Nguyễn Thị Hạnh"
                    value={newDocForm.title}
                    onChange={e => setNewDocForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                      Loại tài liệu
                    </label>
                    <PremiumSelect
                      value={newDocForm.type}
                      onChange={(val) => setNewDocForm(prev => ({ ...prev, type: val }))}
                      options={[
                        { value: "Hợp đồng mua bán", label: "Hợp đồng mua bán" },
                        { value: "Biên bản đặt cọc", label: "Biên bản đặt cọc" },
                        { value: "Phụ lục hợp đồng", label: "Phụ lục hợp đồng" },
                        { value: "Biên bản bàn giao", label: "Biên bản bàn giao" },
                        { value: "Giấy chứng nhận", label: "Giấy chứng nhận" },
                        { value: "Văn bản nghiệm thu", label: "Văn bản nghiệm thu" },
                        { value: "Hợp đồng dịch vụ", label: "Hợp đồng dịch vụ" },
                      ]}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                      Dự án
                    </label>
                    <PremiumSelect
                      value={newDocForm.project}
                      onChange={(val) => setNewDocForm(prev => ({ ...prev, project: val }))}
                      options={[
                        { value: "The Grand Tower", label: "The Grand Tower" },
                        { value: "Riverside Heights", label: "Riverside Heights" },
                        { value: "Sunrise Villa", label: "Sunrise Villa" },
                      ]}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                      Mã căn / Khối
                    </label>
                    <input
                      placeholder="CH-009"
                      value={newDocForm.unitCode}
                      onChange={e => setNewDocForm(prev => ({ ...prev, unitCode: e.target.value }))}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                      Họ tên khách hàng
                    </label>
                    <input
                      placeholder="Nguyễn Thị Hạnh"
                      value={newDocForm.customerName}
                      onChange={e => setNewDocForm(prev => ({ ...prev, customerName: e.target.value }))}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                    Trạng thái ban đầu
                  </label>
                  <PremiumSelect
                    value={newDocForm.status}
                    onChange={(val) => setNewDocForm(prev => ({ ...prev, status: val as LegalDocStatus }))}
                    options={[
                      { value: "draft", label: "Bản nháp" },
                      { value: "pending_approval", label: "Trình duyệt ban quản lý" },
                      { value: "pending_signature", label: "Chờ khách hàng ký số" },
                    ]}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                    Ghi chú / Mô tả chi tiết
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Nhập ghi chú điều khoản đặc biệt hoặc nội dung hợp đồng..."
                    value={newDocForm.description}
                    onChange={e => setNewDocForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none resize-none"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-xs flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    Tạo Tài Liệu
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
